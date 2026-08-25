import { supabase } from './supabase'
import type {
  Exercise, WorkoutTemplate, TemplateExercise, WorkoutSession, SessionExercise, Run,
} from './types'

/* ---------------- Templates & exercises ---------------- */

export async function getTemplates(): Promise<WorkoutTemplate[]> {
  const { data, error } = await supabase
    .from('workout_templates').select('*').order('sort_order')
  if (error) throw error
  return data as WorkoutTemplate[]
}

export async function getExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase.from('exercises').select('*').order('name')
  if (error) throw error
  return data as Exercise[]
}

export async function getTemplateExercises(templateId: string): Promise<TemplateExercise[]> {
  const { data, error } = await supabase
    .from('template_exercises')
    .select('*, exercises(*)')
    .eq('template_id', templateId)
    .order('sort_order')
  if (error) throw error
  return data as TemplateExercise[]
}

/* ---------------- Sessions ---------------- */

export async function getSessions(limit = 100): Promise<WorkoutSession[]> {
  const { data, error } = await supabase
    .from('workout_sessions').select('*')
    .order('scheduled_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as WorkoutSession[]
}

export async function getSession(id: string): Promise<WorkoutSession> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*, session_exercises(*, session_sets(*))')
    .eq('id', id)
    .single()
  if (error) throw error
  const s = data as WorkoutSession
  s.session_exercises?.sort((a, b) => a.sort_order - b.sort_order)
  s.session_exercises?.forEach(e => e.session_sets?.sort((a, b) => a.set_number - b.set_number))
  return s
}

/**
 * Build a dated session from a template. The warm up block is pulled in from the
 * shared Warm Up template so it stays in one place, and every prescribed set is
 * materialised up front so the workout screen is just tapping through rows.
 */
export async function planSession(templateId: string, date: string): Promise<string> {
  const templates = await getTemplates()
  const template = templates.find(t => t.id === templateId)
  if (!template) throw new Error('Template not found')

  const blocks: TemplateExercise[] = []
  if (template.include_warmup) {
    const warm = templates.find(t => t.kind === 'warmup')
    if (warm) blocks.push(...await getTemplateExercises(warm.id))
  }
  blocks.push(...await getTemplateExercises(templateId))

  const { data: session, error: sErr } = await supabase
    .from('workout_sessions')
    .insert({ template_id: templateId, name: template.name, scheduled_date: date, status: 'planned' })
    .select().single()
  if (sErr) throw sErr

  // Carry the last used weight for each exercise forward so you start where you left off.
  const lastWeights = await getLastWeights()

  const rows = blocks.map((te, i) => ({
    session_id: session.id,
    exercise_id: te.exercise_id,
    name: te.exercises!.name,
    block: te.exercises!.block,
    unit: te.exercises!.unit,
    unilateral: te.exercises!.unilateral,
    loadable: te.exercises!.loadable,
    target_sets: te.target_sets,
    target_reps: te.target_reps,
    sort_order: i,
  }))

  const { data: inserted, error: eErr } = await supabase
    .from('session_exercises').insert(rows).select()
  if (eErr) throw eErr

  const setRows = (inserted as SessionExercise[]).flatMap(se =>
    Array.from({ length: se.target_sets }, (_, i) => ({
      session_exercise_id: se.id,
      set_number: i + 1,
      target_reps: se.target_reps,
      reps: null,
      weight: se.loadable ? (lastWeights[se.exercise_id ?? ''] ?? null) : null,
      completed: false,
    })),
  )
  const { error: setErr } = await supabase.from('session_sets').insert(setRows)
  if (setErr) throw setErr

  return session.id as string
}

/** Most recent logged weight per exercise, so new sessions prefill sensibly. */
export async function getLastWeights(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('session_sets')
    .select('weight, session_exercises!inner(exercise_id, workout_sessions!inner(scheduled_date))')
    .not('weight', 'is', null)
    .eq('completed', true)
    .order('id', { ascending: false })
    .limit(500)
  if (error) return {}
  const out: Record<string, number> = {}
  const seen: Record<string, string> = {}
  for (const row of data as any[]) {
    const exId = row.session_exercises?.exercise_id
    const date = row.session_exercises?.workout_sessions?.scheduled_date
    if (!exId || !date) continue
    if (!seen[exId] || date > seen[exId]) { seen[exId] = date; out[exId] = Number(row.weight) }
  }
  return out
}

export async function updateSession(id: string, patch: Partial<WorkoutSession>) {
  const { error } = await supabase.from('workout_sessions').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteSession(id: string) {
  const { error } = await supabase.from('workout_sessions').delete().eq('id', id)
  if (error) throw error
}

export async function startSession(id: string) {
  await updateSession(id, { status: 'in_progress', started_at: new Date().toISOString() })
}

export async function completeSession(id: string, patch: Partial<WorkoutSession> = {}) {
  await updateSession(id, {
    status: 'completed',
    completed_at: new Date().toISOString(),
    ...patch,
  })
}

/* ---------------- Sets ---------------- */

export async function updateSet(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from('session_sets').update(patch).eq('id', id)
  if (error) throw error
}

export async function addSet(sessionExerciseId: string, setNumber: number, targetReps: number | null, weight: number | null) {
  const { data, error } = await supabase.from('session_sets')
    .insert({ session_exercise_id: sessionExerciseId, set_number: setNumber, target_reps: targetReps, weight })
    .select().single()
  if (error) throw error
  return data
}

export async function deleteSet(id: string) {
  const { error } = await supabase.from('session_sets').delete().eq('id', id)
  if (error) throw error
}

export async function updateSessionExercise(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from('session_exercises').update(patch).eq('id', id)
  if (error) throw error
}

export async function removeSessionExercise(id: string) {
  const { error } = await supabase.from('session_exercises').delete().eq('id', id)
  if (error) throw error
}

/** Add an extra exercise into an existing session (e.g. physio added something). */
export async function addExerciseToSession(sessionId: string, exercise: Exercise, sets: number, reps: number, sortOrder: number) {
  const { data, error } = await supabase.from('session_exercises').insert({
    session_id: sessionId,
    exercise_id: exercise.id,
    name: exercise.name,
    block: exercise.block,
    unit: exercise.unit,
    unilateral: exercise.unilateral,
    loadable: exercise.loadable,
    target_sets: sets,
    target_reps: reps,
    sort_order: sortOrder,
  }).select().single()
  if (error) throw error
  const setRows = Array.from({ length: sets }, (_, i) => ({
    session_exercise_id: data.id, set_number: i + 1, target_reps: reps, completed: false,
  }))
  await supabase.from('session_sets').insert(setRows)
  return data
}

/* ---------------- Runs ---------------- */

export async function getRuns(limit = 100): Promise<Run[]> {
  const { data, error } = await supabase
    .from('runs').select('*').order('date', { ascending: false }).limit(limit)
  if (error) throw error
  return data as Run[]
}

export async function saveRun(run: Partial<Run> & { id?: string }) {
  if (run.id) {
    const { id, ...patch } = run
    const { error } = await supabase.from('runs').update(patch).eq('id', id)
    if (error) throw error
    return id
  }
  const { data, error } = await supabase.from('runs').insert(run).select().single()
  if (error) throw error
  return data.id as string
}

export async function deleteRun(id: string) {
  const { error } = await supabase.from('runs').delete().eq('id', id)
  if (error) throw error
}

/* ---------------- Progress ---------------- */

export interface ExerciseHistoryPoint {
  date: string
  topWeight: number | null
  volume: number
  totalReps: number
}

export async function getExerciseHistory(exerciseId: string): Promise<ExerciseHistoryPoint[]> {
  const { data, error } = await supabase
    .from('session_exercises')
    .select('id, exercise_id, session_sets(reps, weight, completed), workout_sessions!inner(scheduled_date, status)')
    .eq('exercise_id', exerciseId)
    .eq('workout_sessions.status', 'completed')
  if (error) throw error

  const byDate = new Map<string, ExerciseHistoryPoint>()
  for (const row of data as any[]) {
    const date = row.workout_sessions.scheduled_date
    const point = byDate.get(date) ?? { date, topWeight: null, volume: 0, totalReps: 0 }
    for (const s of row.session_sets ?? []) {
      if (!s.completed) continue
      const reps = Number(s.reps ?? 0)
      const weight = s.weight == null ? null : Number(s.weight)
      point.totalReps += reps
      point.volume += reps * (weight ?? 0)
      if (weight != null && (point.topWeight == null || weight > point.topWeight)) point.topWeight = weight
    }
    byDate.set(date, point)
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}
