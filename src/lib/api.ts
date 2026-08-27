import { supabase } from './supabase'
import { enqueue } from './queue'
import { cacheGet, cacheSet } from './cache'
import type {
  AppSettings, Exercise, LastPerformance, Program, Run, SessionExercise, Side,
  TemplateExercise, WorkoutSession, WorkoutTemplate,
} from './types'
import { toISO, todayISO } from './format'

const newId = () =>
  (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`)

/* ---------------- Templates & exercises ---------------- */

export async function getTemplates(programId?: string): Promise<WorkoutTemplate[]> {
  let q = supabase.from('workout_templates').select('*').eq('archived', false)
  if (programId) q = q.eq('program_id', programId)
  const { data, error } = await q.order('sort_order')
  if (error) {
    const cached = cacheGet<WorkoutTemplate[]>('templates')
    if (cached) return cached
    throw error
  }
  cacheSet('templates', data)
  return data as WorkoutTemplate[]
}

export async function getExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises').select('*').eq('archived', false).order('name')
  if (error) {
    const cached = cacheGet<Exercise[]>('exercises')
    if (cached) return cached
    throw error
  }
  cacheSet('exercises', data)
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

/* ---------------- Settings ---------------- */

const DEFAULT_SETTINGS: AppSettings = {
  id: 1, operated_side: null, surgery_date: null, schedule: {}, auto_plan_days: 14,
}

export async function getSettings(): Promise<AppSettings> {
  const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle()
  if (error || !data) {
    return cacheGet<AppSettings>('settings') ?? DEFAULT_SETTINGS
  }
  cacheSet('settings', data)
  return data as AppSettings
}

export async function saveSettings(patch: Partial<AppSettings>) {
  const current = await getSettings()
  cacheSet('settings', { ...current, ...patch })
  enqueue({ table: 'app_settings', kind: 'update', rowId: '1', payload: patch })
}

/* ---------------- Sessions ---------------- */

export async function getSessions(limit = 100): Promise<WorkoutSession[]> {
  const { data, error } = await supabase
    .from('workout_sessions').select('*')
    .order('scheduled_date', { ascending: false })
    .limit(limit)
  if (error) {
    const cached = cacheGet<WorkoutSession[]>('sessions')
    if (cached) return cached
    throw error
  }
  cacheSet('sessions', data)
  return data as WorkoutSession[]
}

export async function getSession(id: string): Promise<WorkoutSession> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*, session_exercises(*, session_sets(*))')
    .eq('id', id)
    .single()

  if (error || !data) {
    // Offline: fall back to the copy taken when the workout was last opened.
    const cached = cacheGet<WorkoutSession>(`session.${id}`)
    if (cached) return cached
    throw error ?? new Error('Workout not found')
  }

  const s = sortSession(data as WorkoutSession)
  cacheSet(`session.${id}`, s)
  return s
}

function sortSession(s: WorkoutSession): WorkoutSession {
  s.session_exercises?.sort((a, b) => a.sort_order - b.sort_order)
  s.session_exercises?.forEach(e =>
    e.session_sets?.sort((a, b) =>
      a.set_number - b.set_number || a.side.localeCompare(b.side)))
  return s
}

/** Keep the offline copy in step with what's on screen. */
export function cacheSession(s: WorkoutSession) {
  cacheSet(`session.${s.id}`, s)
}

export async function planSession(templateId: string, date: string): Promise<string> {
  const templates = await getTemplates()
  const template = templates.find(t => t.id === templateId)
  if (!template) throw new Error('Workout not found')

  const programs = await getPrograms()
  const program = programs.find(p => p.id === template.program_id) ?? null

  const blocks: TemplateExercise[] = []
  if (template.include_warmup) {
    // The shared warm up is per program, so a rehab warm up never leaks into
    // a strength program's session.
    const warm = templates.find(t => t.kind === 'warmup' && t.program_id === template.program_id)
    if (warm) blocks.push(...await getTemplateExercises(warm.id))
  }
  blocks.push(...await getTemplateExercises(templateId))

  const { data: session, error: sErr } = await supabase
    .from('workout_sessions')
    .insert({
      template_id: templateId,
      program_id: template.program_id,
      tracks_knee: program?.tracks_knee ?? false,
      name: template.name,
      scheduled_date: date,
      status: 'planned',
    })
    .select().single()
  if (sErr) throw sErr

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
    target_reps_max: te.target_reps_max ?? null,
    sort_order: i,
  }))

  const { data: inserted, error: eErr } = await supabase
    .from('session_exercises').insert(rows).select()
  if (eErr) throw eErr

  const setRows = (inserted as SessionExercise[]).flatMap(se => {
    // Single-leg work gets a row per side so the two can be compared later.
    const sides: Side[] = se.unilateral ? ['left', 'right'] : ['both']
    return Array.from({ length: se.target_sets }, (_, i) =>
      sides.map(side => ({
        id: newId(),
        session_exercise_id: se.id,
        set_number: i + 1,
        side,
        target_reps: se.target_reps,
        reps: null,
        weight: se.loadable ? (lastWeights[`${se.exercise_id}.${side}`] ?? null) : null,
        completed: false,
      })),
    ).flat()
  })

  const { error: setErr } = await supabase.from('session_sets').insert(setRows)
  if (setErr) throw setErr

  return session.id as string
}

/** Most recent logged weight per exercise and side, so new sessions prefill sensibly. */
export async function getLastWeights(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('session_sets')
    .select('weight, side, session_exercises!inner(exercise_id, workout_sessions!inner(scheduled_date))')
    .not('weight', 'is', null)
    .eq('completed', true)
    .limit(1000)
  if (error) return {}

  const out: Record<string, number> = {}
  const seen: Record<string, string> = {}
  for (const row of data as any[]) {
    const exId = row.session_exercises?.exercise_id
    const date = row.session_exercises?.workout_sessions?.scheduled_date
    if (!exId || !date) continue
    const key = `${exId}.${row.side}`
    if (!seen[key] || date > seen[key]) { seen[key] = date; out[key] = Number(row.weight) }
  }
  return out
}

/**
 * What happened the last time each of these exercises was done, so the workout
 * screen can show you what you're trying to beat.
 */
export async function getLastPerformance(
  exerciseIds: string[], beforeDate: string, excludeSessionId?: string,
): Promise<Record<string, LastPerformance>> {
  if (!exerciseIds.length) return {}

  const { data, error } = await supabase
    .from('session_exercises')
    .select('id, exercise_id, target_sets, target_reps, session_sets(side, reps, weight, completed, target_reps), workout_sessions!inner(id, scheduled_date, status, knee_pain)')
    .in('exercise_id', exerciseIds)
    .eq('workout_sessions.status', 'completed')
    .lte('workout_sessions.scheduled_date', beforeDate)
    .limit(500)
  if (error) return {}

  const best: Record<string, any> = {}
  for (const row of data as any[]) {
    const session = row.workout_sessions
    if (excludeSessionId && session.id === excludeSessionId) continue
    const exId = row.exercise_id
    if (!exId) continue
    if (!best[exId] || session.scheduled_date > best[exId].workout_sessions.scheduled_date) {
      best[exId] = row
    }
  }

  const out: Record<string, LastPerformance> = {}
  for (const [exId, row] of Object.entries<any>(best)) {
    const bySide = new Map<Side, { topWeight: number | null; totalReps: number; setsCompleted: number; setsPlanned: number }>()
    let hitAll = true
    for (const s of row.session_sets ?? []) {
      const side = (s.side ?? 'both') as Side
      const entry = bySide.get(side) ?? { topWeight: null, totalReps: 0, setsCompleted: 0, setsPlanned: 0 }
      entry.setsPlanned++
      if (s.completed) {
        entry.setsCompleted++
        entry.totalReps += Number(s.reps ?? 0)
        const w = s.weight == null ? null : Number(s.weight)
        if (w != null && (entry.topWeight == null || w > entry.topWeight)) entry.topWeight = w
        if (s.target_reps != null && Number(s.reps ?? 0) < Number(s.target_reps)) hitAll = false
      } else {
        hitAll = false
      }
      bySide.set(side, entry)
    }
    out[exId] = {
      date: row.workout_sessions.scheduled_date,
      knee_pain: row.workout_sessions.knee_pain,
      sides: [...bySide.entries()].map(([side, v]) => ({ side, ...v })),
      hitAllTargets: hitAll,
    }
  }
  return out
}

export async function updateSession(id: string, patch: Partial<WorkoutSession>) {
  enqueue({ table: 'workout_sessions', kind: 'update', rowId: id, payload: patch as Record<string, unknown> })
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
  enqueue({ table: 'session_sets', kind: 'update', rowId: id, payload: patch })
}

export function addSet(
  sessionExerciseId: string, setNumber: number, targetReps: number | null,
  weight: number | null, side: Side,
) {
  const row = {
    id: newId(),
    session_exercise_id: sessionExerciseId,
    set_number: setNumber,
    side,
    target_reps: targetReps,
    weight,
    completed: false,
  }
  enqueue({ table: 'session_sets', kind: 'insert', payload: row })
  return row
}

export async function deleteSet(id: string) {
  enqueue({ table: 'session_sets', kind: 'delete', rowId: id })
}

/* ---------------- Runs ---------------- */

export async function getRuns(limit = 100): Promise<Run[]> {
  const { data, error } = await supabase
    .from('runs').select('*').order('date', { ascending: false }).limit(limit)
  if (error) {
    const cached = cacheGet<Run[]>('runs')
    if (cached) return cached
    throw error
  }
  cacheSet('runs', data)
  return data as Run[]
}

export async function saveRun(run: Partial<Run> & { id?: string }) {
  if (run.id) {
    const { id, ...patch } = run
    enqueue({ table: 'runs', kind: 'update', rowId: id, payload: patch as Record<string, unknown> })
    return id
  }
  const id = newId()
  enqueue({ table: 'runs', kind: 'insert', payload: { ...run, id } })
  return id
}

export async function deleteRun(id: string) {
  enqueue({ table: 'runs', kind: 'delete', rowId: id })
}

/* ---------------- Scheduling ---------------- */

/**
 * Materialise planned sessions for the configured weekdays, a fortnight ahead.
 * Idempotent: a date that already has a session of that template is skipped.
 */
export async function ensureScheduledSessions(): Promise<number> {
  const [programs, settings] = await Promise.all([getPrograms(), getSettings()])
  const active = programs.filter(p => !p.archived && Object.keys(p.schedule ?? {}).length > 0)
  if (!active.length) return 0

  const today = todayISO()
  const horizon = new Date()
  horizon.setDate(horizon.getDate() + (settings.auto_plan_days ?? 14))

  const { data: existing } = await supabase
    .from('workout_sessions').select('scheduled_date, template_id')
    .gte('scheduled_date', today)
  const taken = new Set((existing ?? []).map((r: any) => `${r.scheduled_date}.${r.template_id}`))

  let created = 0
  for (let d = new Date(); d <= horizon; d.setDate(d.getDate() + 1)) {
    const iso = toISO(d)
    const weekday = String(d.getDay())
    for (const program of active) {
      const templateId = (program.schedule ?? {})[weekday]
      if (!templateId) continue
      if (taken.has(`${iso}.${templateId}`)) continue
      try { await planSession(templateId, iso); created++; taken.add(`${iso}.${templateId}`) }
      catch { /* offline or a race with another device — try again next launch */ }
    }
  }
  return created
}

/** Weekdays across every active program that are marked as run days. */
export async function runDaysForDate(date: Date, programs: Program[]): Promise<Program[]> {
  const weekday = date.getDay()
  return programs.filter(p => !p.archived && (p.run_days ?? []).includes(weekday))
}

/** Move an overdue workout to today. */
export async function rescheduleSession(id: string, date: string) {
  await updateSession(id, { scheduled_date: date })
}

/* ---------------- Progress ---------------- */

export interface ExerciseHistoryPoint {
  date: string
  topWeight: number | null
  volume: number
  totalReps: number
  left: { topWeight: number | null; volume: number } | null
  right: { topWeight: number | null; volume: number } | null
}

export async function getExerciseHistory(exerciseId: string): Promise<ExerciseHistoryPoint[]> {
  const { data, error } = await supabase
    .from('session_exercises')
    .select('id, exercise_id, session_sets(side, reps, weight, completed), workout_sessions!inner(scheduled_date, status)')
    .eq('exercise_id', exerciseId)
    .eq('workout_sessions.status', 'completed')
  if (error) throw error

  const byDate = new Map<string, ExerciseHistoryPoint>()
  for (const row of data as any[]) {
    const date = row.workout_sessions.scheduled_date
    const point = byDate.get(date) ?? {
      date, topWeight: null, volume: 0, totalReps: 0, left: null, right: null,
    }
    for (const s of row.session_sets ?? []) {
      if (!s.completed) continue
      const reps = Number(s.reps ?? 0)
      const weight = s.weight == null ? null : Number(s.weight)
      const vol = reps * (weight ?? 0)
      point.totalReps += reps
      point.volume += vol
      if (weight != null && (point.topWeight == null || weight > point.topWeight)) point.topWeight = weight

      const side = s.side as Side
      if (side === 'left' || side === 'right') {
        const cur = point[side] ?? { topWeight: null, volume: 0 }
        cur.volume += vol
        if (weight != null && (cur.topWeight == null || weight > cur.topWeight)) cur.topWeight = weight
        point[side] = cur
      }
    }
    byDate.set(date, point)
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export interface SymmetryPoint {
  date: string
  /** operated side as a percentage of the other side, by volume */
  pct: number
  operated: number
  other: number
}

/**
 * The number that matters after a meniscectomy: how close the operated leg is
 * to the other one. Aggregated across every single-leg exercise in a session.
 */
export async function getSymmetryHistory(operatedSide: 'left' | 'right'): Promise<SymmetryPoint[]> {
  const { data, error } = await supabase
    .from('session_exercises')
    .select('unilateral, session_sets(side, reps, weight, completed), workout_sessions!inner(scheduled_date, status)')
    .eq('unilateral', true)
    .eq('workout_sessions.status', 'completed')
    .limit(1000)
  if (error) return []

  const byDate = new Map<string, { left: number; right: number }>()
  for (const row of data as any[]) {
    const date = row.workout_sessions.scheduled_date
    const entry = byDate.get(date) ?? { left: 0, right: 0 }
    for (const s of row.session_sets ?? []) {
      if (!s.completed) continue
      const reps = Number(s.reps ?? 0)
      const weight = s.weight == null ? null : Number(s.weight)
      // Bodyweight single-leg work still counts — reps carry the load there.
      const contribution = weight ? reps * weight : reps
      if (s.side === 'left') entry.left += contribution
      if (s.side === 'right') entry.right += contribution
    }
    byDate.set(date, entry)
  }

  return [...byDate.entries()]
    .map(([date, v]) => {
      const operated = operatedSide === 'left' ? v.left : v.right
      const other = operatedSide === 'left' ? v.right : v.left
      return { date, operated, other, pct: other > 0 ? Math.round((operated / other) * 100) : 0 }
    })
    .filter(p => p.operated > 0 || p.other > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/* ---------------- Programs ---------------- */

export async function getPrograms(includeArchived = false): Promise<Program[]> {
  let q = supabase.from('programs').select('*')
  if (!includeArchived) q = q.eq('archived', false)
  const { data, error } = await q.order('sort_order').order('created_at')
  if (error) {
    const cached = cacheGet<Program[]>('programs')
    if (cached) return cached
    throw error
  }
  cacheSet('programs', data)
  return data as Program[]
}

export async function getProgram(id: string): Promise<Program | null> {
  const { data } = await supabase.from('programs').select('*').eq('id', id).maybeSingle()
  if (data) return data as Program
  return (cacheGet<Program[]>('programs') ?? []).find(p => p.id === id) ?? null
}

export async function createProgram(patch: Partial<Program>): Promise<string> {
  const { data, error } = await supabase
    .from('programs')
    .insert({ name: patch.name ?? 'New program', ...patch })
    .select().single()
  if (error) throw error
  return data.id as string
}

export async function updateProgram(id: string, patch: Partial<Program>) {
  enqueue({ table: 'programs', kind: 'update', rowId: id, payload: patch as Record<string, unknown> })
}

export async function deleteProgram(id: string) {
  const { error } = await supabase.from('programs').delete().eq('id', id)
  if (error) throw error
}

/* ---------------- Workout templates (the builder) ---------------- */

export async function getTemplate(id: string): Promise<WorkoutTemplate | null> {
  const { data } = await supabase.from('workout_templates').select('*').eq('id', id).maybeSingle()
  return (data as WorkoutTemplate) ?? null
}

export async function createTemplate(patch: Partial<WorkoutTemplate>): Promise<string> {
  const { data, error } = await supabase
    .from('workout_templates')
    .insert({
      name: patch.name ?? 'New workout',
      kind: patch.kind ?? 'strength',
      include_warmup: patch.include_warmup ?? false,
      ...patch,
    })
    .select().single()
  if (error) throw error
  return data.id as string
}

export async function updateTemplate(id: string, patch: Partial<WorkoutTemplate>) {
  enqueue({ table: 'workout_templates', kind: 'update', rowId: id, payload: patch as Record<string, unknown> })
}

export async function deleteTemplate(id: string) {
  const { error } = await supabase.from('workout_templates').delete().eq('id', id)
  if (error) throw error
}

export async function addTemplateExercise(
  templateId: string, exercise: Exercise, sets: number, reps: number,
  repsMax: number | null, sortOrder: number,
) {
  const { data, error } = await supabase
    .from('template_exercises')
    .insert({
      template_id: templateId,
      exercise_id: exercise.id,
      target_sets: sets,
      target_reps: reps,
      target_reps_max: repsMax,
      sort_order: sortOrder,
    })
    .select('*, exercises(*)').single()
  if (error) throw error
  return data as TemplateExercise
}

export async function updateTemplateExercise(id: string, patch: Record<string, unknown>) {
  enqueue({ table: 'template_exercises', kind: 'update', rowId: id, payload: patch })
}

export async function removeTemplateExercise(id: string) {
  const { error } = await supabase.from('template_exercises').delete().eq('id', id)
  if (error) throw error
}

/** Persist a whole reordering in one go. */
export async function reorderTemplateExercises(ids: string[]) {
  await Promise.all(ids.map((id, i) =>
    supabase.from('template_exercises').update({ sort_order: i }).eq('id', id)))
}

/* ---------------- Custom exercises ---------------- */

export async function createExercise(patch: Partial<Exercise>): Promise<Exercise> {
  const { data, error } = await supabase
    .from('exercises')
    .insert({
      name: (patch.name ?? '').trim(),
      block: patch.block ?? 'main',
      unit: patch.unit ?? 'reps',
      unilateral: patch.unilateral ?? false,
      loadable: patch.loadable ?? true,
      cue: patch.cue?.trim() || null,
      muscle_group: patch.muscle_group ?? null,
      equipment: patch.equipment ?? null,
      default_sets: patch.default_sets ?? 3,
      default_reps: patch.default_reps ?? 10,
      is_custom: true,
    })
    .select().single()
  if (error) throw error
  return data as Exercise
}

export async function archiveExercise(id: string) {
  enqueue({ table: 'exercises', kind: 'update', rowId: id, payload: { archived: true } })
}
