import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Header, Page } from '../components/Header'
import { Spinner } from '../components/ui'
import { Stepper } from '../components/Stepper'
import { ExercisePicker, Toggle } from '../components/ExercisePicker'
import {
  addTemplateExercise, createTemplate, deleteTemplate, getProgram, getTemplate,
  getTemplateExercises, getTemplates, removeTemplateExercise, reorderTemplateExercises,
  updateTemplate, updateTemplateExercise,
} from '../lib/api'
import type { Program, TemplateExercise, WorkoutTemplate } from '../lib/types'
import { UNIT_LABEL, fmtRepTarget } from '../lib/format'

/** Create or edit one workout: its details and the exercises inside it. */
export default function WorkoutEdit() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const isNew = id === 'new'

  const [template, setTemplate] = useState<WorkoutTemplate | null>(null)
  const [program, setProgram] = useState<Program | null>(null)
  const [items, setItems] = useState<TemplateExercise[]>([])
  const [hasWarmup, setHasWarmup] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const programId = params.get('program') ?? template?.program_id ?? null

  const load = useCallback(async () => {
    if (isNew) { setLoading(false); return }
    const t = await getTemplate(id!)
    setTemplate(t)
    if (t) {
      setItems(await getTemplateExercises(t.id))
      if (t.program_id) {
        const siblings = await getTemplates(t.program_id)
        setHasWarmup(siblings.some(s => s.kind === 'warmup' && s.id !== t.id))
      }
    }
    setLoading(false)
  }, [id, isNew])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (programId) getProgram(programId).then(setProgram).catch(() => {})
  }, [programId])

  // A brand new workout needs a row before exercises can hang off it.
  const create = async (kind: 'strength' | 'warmup') => {
    try {
      const newId = await createTemplate({
        name: kind === 'warmup' ? 'Warm Up' : 'New workout',
        kind,
        program_id: programId,
        include_warmup: kind === 'strength',
        sort_order: Date.now() % 100000,
      })
      nav(`/workout/${newId}`, { replace: true })
    } catch (e: any) {
      setErr(e.message ?? 'Could not create that workout')
    }
  }

  const patch = (p: Partial<WorkoutTemplate>) => {
    setTemplate(prev => prev && { ...prev, ...p })
    if (template) updateTemplate(template.id, p)
  }

  const addExercise = async (exercise: any, sets: number, reps: number, repsMax: number | null) => {
    if (!template) return
    try {
      const row = await addTemplateExercise(template.id, exercise, sets, reps, repsMax, items.length)
      setItems(prev => [...prev, row])
    } catch (e: any) {
      setErr(e.message?.includes('duplicate')
        ? `${exercise.name} is already in this workout`
        : e.message)
    }
  }

  const move = async (index: number, delta: number) => {
    const next = [...items]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setItems(next)
    await reorderTemplateExercises(next.map(i => i.id))
  }

  const remove = async (row: TemplateExercise) => {
    setItems(prev => prev.filter(i => i.id !== row.id))
    await removeTemplateExercise(row.id)
  }

  const destroy = async () => {
    if (!template) return
    if (!window.confirm(`Delete "${template.name}"? Workouts already logged from it are kept.`)) return
    await deleteTemplate(template.id)
    nav(programId ? `/program/${programId}` : '/programs', { replace: true })
  }

  if (loading) return <><Header title="Workout" back={-1 as never} /><Spinner /></>

  if (isNew) {
    return (
      <>
        <Header title="New workout" back={() => nav(-1)} action={<span className="w-11" />} />
        <Page>
          <p className="text-sm text-ink-500 leading-relaxed">
            {program ? `Adding to ${program.name}.` : 'This workout won’t belong to a program yet.'}
          </p>
          <button onClick={() => create('strength')} className="btn-primary w-full py-4">
            Build a workout
          </button>
          <button onClick={() => create('warmup')} className="btn-ghost w-full py-4">
            Build a shared warm up
          </button>
          <p className="text-xs text-ink-600 leading-relaxed">
            A shared warm up gets added automatically to every workout in this program that
            asks for one, so you only maintain it in one place.
          </p>
          {err && <p className="text-sm text-rose-400">{err}</p>}
        </Page>
      </>
    )
  }

  if (!template) return (
    <><Header title="Workout" back={() => nav(-1)} />
      <Page><p className="card p-5 text-sm text-rose-400">That workout no longer exists.</p></Page>
    </>
  )

  const isWarmup = template.kind === 'warmup'

  return (
    <>
      <Header
        title={template.name}
        subtitle={program ? program.name : 'No program'}
        back={() => nav(programId ? `/program/${programId}` : '/programs')}
        action={<span className="w-11" />}
      />
      <Page>
        <section className="card p-4 space-y-4">
          <div>
            <span className="label">Name</span>
            <input className="field" value={template.name}
              onChange={e => patch({ name: e.target.value })} />
          </div>
          <div>
            <span className="label">Description <span className="normal-case font-normal text-ink-600">(optional)</span></span>
            <input className="field" value={template.description ?? ''} placeholder="What this session is for"
              onChange={e => patch({ description: e.target.value || null })} />
          </div>
          {!isWarmup && hasWarmup && (
            <Toggle
              checked={template.include_warmup}
              onChange={v => patch({ include_warmup: v })}
              label="Include the shared warm up"
              hint="Adds this program's warm up to every session"
            />
          )}
        </section>

        <section>
          <div className="flex items-center justify-between gap-3 mb-2">
            <h2 className="label mb-0">
              Exercises <span className="text-ink-600">({items.length})</span>
            </h2>
            <button onClick={() => setPickerOpen(true)} className="btn-ghost px-3 h-9 text-xs">+ Add</button>
          </div>

          {items.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-sm text-ink-500">Nothing in here yet.</p>
              <button onClick={() => setPickerOpen(true)} className="btn-primary mt-4 px-5 py-2.5">
                Pick from the library
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((row, i) => (
                <div key={row.id} className="card p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{row.exercises?.name}</p>
                      <p className="text-[11px] text-ink-500 mt-0.5">
                        {row.target_sets} × {fmtRepTarget(row.target_reps, row.target_reps_max)}{' '}
                        {UNIT_LABEL[row.exercises?.unit ?? 'reps']}
                        {row.exercises?.unilateral && ' per side'}
                        {row.exercises?.muscle_group && ` · ${row.exercises.muscle_group}`}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"
                        className="h-7 w-8 grid place-items-center rounded-lg bg-ink-850 border border-ink-700 text-ink-500 disabled:opacity-25">↑</button>
                      <button onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down"
                        className="h-7 w-8 grid place-items-center rounded-lg bg-ink-850 border border-ink-700 text-ink-500 disabled:opacity-25">↓</button>
                    </div>
                  </div>

                  <div className="flex items-end gap-2 mt-3">
                    <div className="flex-1">
                      <span className="label">Sets</span>
                      <Stepper compact value={row.target_sets} min={1}
                        onChange={v => {
                          const sets = v ?? 1
                          setItems(prev => prev.map(x => x.id === row.id ? { ...x, target_sets: sets } : x))
                          updateTemplateExercise(row.id, { target_sets: sets })
                        }} />
                    </div>
                    <div className="flex-1">
                      <span className="label">
                        {UNIT_LABEL[row.exercises?.unit ?? 'reps']}{row.target_reps_max != null ? ' (min)' : ''}
                      </span>
                      <Stepper compact value={row.target_reps} min={1}
                        step={row.exercises?.unit === 'metres' ? 100 : 1}
                        onChange={v => {
                          const reps = v ?? 1
                          setItems(prev => prev.map(x => x.id === row.id ? { ...x, target_reps: reps } : x))
                          updateTemplateExercise(row.id, { target_reps: reps })
                        }} />
                    </div>
                    {row.target_reps_max != null && (
                      <div className="flex-1">
                        <span className="label">max</span>
                        <Stepper compact value={row.target_reps_max} min={row.target_reps}
                          step={row.exercises?.unit === 'metres' ? 100 : 1}
                          onChange={v => {
                            const max = v ?? row.target_reps
                            setItems(prev => prev.map(x => x.id === row.id ? { ...x, target_reps_max: max } : x))
                            updateTemplateExercise(row.id, { target_reps_max: max })
                          }} />
                      </div>
                    )}
                    <button onClick={() => remove(row)} aria-label="Remove exercise"
                      className="h-11 w-11 shrink-0 grid place-items-center rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 active:scale-90">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      const max = row.target_reps_max == null ? row.target_reps + 2 : null
                      setItems(prev => prev.map(x => x.id === row.id ? { ...x, target_reps_max: max } : x))
                      updateTemplateExercise(row.id, { target_reps_max: max })
                    }}
                    className="mt-2 text-[11px] font-semibold text-ink-500 underline"
                  >
                    {row.target_reps_max == null ? 'Make it a range' : 'Use a fixed target'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {err && <p className="text-sm text-rose-400">{err}</p>}

        <button onClick={destroy} className="btn-danger w-full py-3 text-sm">Delete this workout</button>
      </Page>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addExercise}
        excludeIds={items.map(i => i.exercise_id)}
      />
    </>
  )
}
