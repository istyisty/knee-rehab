import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Header } from '../components/Header'
import { Sheet, Scale10, Spinner, Stars, StatusPill } from '../components/ui'
import { Stepper } from '../components/Stepper'
import { RestBar, RestControls } from '../components/RestBar'
import {
  addSet, cacheSession, completeSession, deleteSession, deleteSet, getExercises,
  getLastPerformance, getSession, getSettings, startSession, updateSession, updateSet,
} from '../lib/api'
import { startRest } from '../lib/rest'
import { useWakeLock } from '../lib/hooks'
import type {
  AppSettings, Exercise, LastPerformance, SessionExercise, SessionSet, Side, Swelling, WorkoutSession,
} from '../lib/types'
import { BLOCK_LABEL, UNIT_LABEL, fmtRepTarget, fmtWeight, longDate, prettyDate } from '../lib/format'

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [cues, setCues] = useState<Record<string, string>>({})
  const [last, setLast] = useState<Record<string, LastPerformance>>({})
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [finishOpen, setFinishOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try { setSession(await getSession(id)) }
    catch (e: any) { setErr(e.message ?? 'Could not load that workout') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    getExercises()
      .then((list: Exercise[]) =>
        setCues(Object.fromEntries(list.filter(e => e.cue).map(e => [e.id, e.cue!]))))
      .catch(() => {})
    getSettings().then(setSettings).catch(() => {})
  }, [])

  // What you did last time, so today's numbers have something to beat.
  useEffect(() => {
    if (!session) return
    const ids = (session.session_exercises ?? [])
      .map(e => e.exercise_id).filter(Boolean) as string[]
    getLastPerformance(ids, session.scheduled_date, session.id).then(setLast).catch(() => {})
  }, [session?.id])

  useEffect(() => { if (session) cacheSession(session) }, [session])

  const inProgress = session?.status === 'in_progress'
  useWakeLock(Boolean(inProgress))

  // ?start=1 arrives from the plan sheet's "Start now"
  useEffect(() => {
    if (!session || params.get('start') !== '1') return
    params.delete('start'); setParams(params, { replace: true })
    if (session.status === 'planned') begin()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id])

  const exercises = session?.session_exercises ?? []
  const allSets = exercises.flatMap(e => e.session_sets ?? [])
  const doneSets = allSets.filter(s => s.completed).length
  const pct = allSets.length ? Math.round((doneSets / allSets.length) * 100) : 0

  const grouped = useMemo(() => {
    const order: Array<'warmup' | 'plyo' | 'main'> = ['warmup', 'plyo', 'main']
    return order
      .map(block => ({ block, items: exercises.filter(e => e.block === block) }))
      .filter(g => g.items.length > 0)
  }, [exercises])

  const patchSetLocal = (setId: string, patch: Partial<SessionSet>) => {
    setSession(prev => prev && ({
      ...prev,
      session_exercises: prev.session_exercises!.map(ex => ({
        ...ex,
        session_sets: ex.session_sets!.map(s => (s.id === setId ? { ...s, ...patch } : s)),
      })),
    }))
  }

  const begin = async () => {
    if (!id) return
    await startSession(id)
    setSession(prev => prev && { ...prev, status: 'in_progress', started_at: new Date().toISOString() })
  }

  const removeWorkout = async () => {
    if (!id || !window.confirm('Delete this workout and everything logged in it?')) return
    await deleteSession(id)
    nav('/history', { replace: true })
  }

  if (loading) return <><Header title="Workout" back="/" /><Spinner /></>
  if (err || !session) return (
    <><Header title="Workout" back="/" />
      <div className="mx-auto max-w-md p-4"><p className="card p-5 text-sm text-rose-400">{err ?? 'Not found'}</p></div>
    </>
  )

  const isDone = session.status === 'completed'

  return (
    <>
      <Header
        title={session.name}
        subtitle={longDate(session.scheduled_date)}
        back={() => nav(-1)}
        action={
          <button onClick={() => setEditOpen(true)} aria-label="Workout options"
            className="h-11 w-11 shrink-0 grid place-items-center rounded-full bg-ink-850 border border-ink-700 text-ink-500 active:scale-95">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" /></svg>
          </button>
        }
      />

      <div className="sticky top-16 z-20 bg-ink-950/85 backdrop-blur-xl border-b border-ink-800/70">
        <div className="mx-auto max-w-md px-4 py-2.5 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-ink-800 overflow-hidden">
            <div className="h-full bg-mint-500 transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-bold tabular-nums text-ink-500 shrink-0">{doneSets}/{allSets.length}</span>
          <StatusPill status={session.status} />
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 py-5 space-y-5 pb-56">
        {session.status === 'planned' && (
          <button onClick={begin} className="btn-primary w-full py-4 text-base">Start workout</button>
        )}

        {inProgress && <RestControls />}

        {isDone && <CompletedSummary session={session} onEdit={() => setFinishOpen(true)} />}

        {grouped.map(({ block, items }) => (
          <section key={block}>
            <h2 className="label flex items-center gap-2">
              {BLOCK_LABEL[block]}
              <span className="h-px flex-1 bg-ink-800" />
            </h2>
            <div className="space-y-3">
              {items.map(ex => (
                <ExerciseCard
                  key={ex.id}
                  exercise={ex}
                  cue={ex.exercise_id ? cues[ex.exercise_id] : undefined}
                  last={ex.exercise_id ? last[ex.exercise_id] : undefined}
                  operatedSide={session.tracks_knee ? (settings?.operated_side ?? null) : null}
                  locked={session.status === 'planned'}
                  restOnTick={inProgress}
                  onSetChange={patchSetLocal}
                  onLocalAdd={(exId, set) => setSession(prev => prev && ({
                    ...prev,
                    session_exercises: prev.session_exercises!.map(e =>
                      e.id === exId ? { ...e, session_sets: [...(e.session_sets ?? []), set] } : e),
                  }))}
                  onLocalRemove={(exId, setIds) => setSession(prev => prev && ({
                    ...prev,
                    session_exercises: prev.session_exercises!.map(e =>
                      e.id === exId ? { ...e, session_sets: (e.session_sets ?? []).filter(s => !setIds.includes(s.id)) } : e),
                  }))}
                />
              ))}
            </div>
          </section>
        ))}

        {exercises.length === 0 && (
          <p className="card p-5 text-sm text-ink-500 text-center">This workout has no exercises.</p>
        )}
      </div>

      {/* One dock: the rest timer stacks above the finish button rather than
          floating over it at a hand-calculated offset. */}
      {session.status !== 'planned' && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-ink-950/90 backdrop-blur-xl border-t border-ink-800 pb-dock">
          <div className="mx-auto max-w-md px-4 py-3">
            <RestBar />
            <button onClick={() => setFinishOpen(true)} className={isDone ? 'btn-ghost w-full py-3.5' : 'btn-primary w-full py-3.5'}>
              {isDone ? 'Edit rating & notes' : 'Finish workout'}
            </button>
          </div>
        </div>
      )}

      <FinishSheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        session={session}
        onSaved={s => { setSession(prev => prev && { ...prev, ...s }); setFinishOpen(false) }}
      />

      <EditSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        session={session}
        onSaved={s => { setSession(prev => prev && { ...prev, ...s }); setEditOpen(false) }}
        onDelete={removeWorkout}
      />
    </>
  )
}

/* ---------------- Exercise card ---------------- */

const SIDE_LABEL: Record<Side, string> = { both: '', left: 'L', right: 'R' }

function ExerciseCard({
  exercise, cue, last, operatedSide, locked, restOnTick, onSetChange, onLocalAdd, onLocalRemove,
}: {
  exercise: SessionExercise
  cue?: string
  last?: LastPerformance
  operatedSide: 'left' | 'right' | null
  locked: boolean
  restOnTick: boolean
  onSetChange: (setId: string, patch: Partial<SessionSet>) => void
  onLocalAdd: (exerciseId: string, set: SessionSet) => void
  onLocalRemove: (exerciseId: string, setIds: string[]) => void
}) {
  const sets = exercise.session_sets ?? []
  const done = sets.filter(s => s.completed).length
  const complete = sets.length > 0 && done === sets.length
  const unitLabel = UNIT_LABEL[exercise.unit] ?? 'reps'
  const repTarget = fmtRepTarget(exercise.target_reps, exercise.target_reps_max)
  const sides: Side[] = exercise.unilateral ? ['left', 'right'] : ['both']

  // Group by set number so a single-leg set shows L and R together.
  const setNumbers = [...new Set(sets.map(s => s.set_number))].sort((a, b) => a - b)

  const addAnother = () => {
    const next = (setNumbers[setNumbers.length - 1] ?? 0) + 1
    for (const side of sides) {
      const prev = sets.filter(s => s.side === side).slice(-1)[0]
      const row = addSet(exercise.id, next, exercise.target_reps, prev?.weight ?? null, side)
      onLocalAdd(exercise.id, { ...row, completed_at: null, notes: null } as unknown as SessionSet)
    }
  }

  const dropLast = () => {
    const n = setNumbers[setNumbers.length - 1]
    if (n == null || setNumbers.length <= 1) return
    const doomed = sets.filter(s => s.set_number === n)
    doomed.forEach(s => deleteSet(s.id))
    onLocalRemove(exercise.id, doomed.map(s => s.id))
  }

  return (
    <div className={`card overflow-hidden transition ${complete ? 'border-mint-500/30' : ''}`}>
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <h3 className="font-bold leading-tight flex items-center gap-2">
            {exercise.name}
            {complete && <span className="text-mint-400 text-sm" aria-label="complete">✓</span>}
          </h3>
          <p className="text-xs text-ink-500 mt-0.5">
            {exercise.target_sets} × {repTarget} {unitLabel}
            {exercise.unilateral && ' per side'}
          </p>
          {cue && <p className="text-[11px] text-ink-600 mt-1.5 leading-snug">{cue}</p>}
        </div>
        <span className="chip bg-ink-850 border border-ink-700 text-ink-500 tabular-nums shrink-0">{done}/{sets.length}</span>
      </div>

      {last && <LastTime last={last} loadable={exercise.loadable} unit={unitLabel} />}

      <div className="px-4 pb-4 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-600 px-2">
          <span className="w-6 shrink-0">{exercise.unilateral ? 'Side' : 'Set'}</span>
          <span className="flex-1 text-center">{unitLabel}</span>
          {exercise.loadable && <span className="flex-1 text-center">kg</span>}
          <span className="w-11 shrink-0" />
        </div>

        {setNumbers.map(n => (
          <div key={n} className={exercise.unilateral ? 'rounded-xl bg-ink-950/40 p-0.5' : ''}>
            {sides.map(side => {
              const set = sets.find(s => s.set_number === n && s.side === side)
              if (!set) return null
              return (
                <SetRow
                  key={set.id}
                  set={set}
                  placeholder={repTarget}
                  label={exercise.unilateral ? SIDE_LABEL[side] : String(n)}
                  operated={exercise.unilateral && operatedSide === side}
                  loadable={exercise.loadable}
                  locked={locked}
                  restOnTick={restOnTick}
                  onChange={patch => onSetChange(set.id, patch)}
                />
              )
            })}
          </div>
        ))}

        {!locked && (
          <div className="flex gap-2 pt-1">
            <button onClick={addAnother} className="btn-ghost flex-1 h-11 text-xs">+ Add set</button>
            {setNumbers.length > 1 && (
              <button onClick={dropLast} className="btn-ghost px-3 h-11 text-xs text-ink-500">Remove last</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Last session's numbers for this exercise — the basis for today's decision. */
function LastTime({ last, loadable, unit }: { last: LastPerformance; loadable: boolean; unit: string }) {
  const parts = last.sides.map(s => {
    const label = s.side === 'both' ? '' : `${SIDE_LABEL[s.side]} `
    const load = loadable && s.topWeight != null ? ` @ ${fmtWeight(s.topWeight)}kg` : ''
    return `${label}${s.setsCompleted}×${s.totalReps && s.setsCompleted ? Math.round(s.totalReps / s.setsCompleted) : 0}${load}`
  })

  return (
    <div className="mx-4 mb-3 rounded-xl bg-ink-850/60 border border-ink-800 px-3 py-2">
      <p className="text-[11px] text-ink-500">
        <span className="font-semibold text-slate-400">{prettyDate(last.date)}</span>
        {' · '}{parts.join(' / ')}
        {last.knee_pain != null && <span> · knee {last.knee_pain}/10</span>}
      </p>
      {last.hitAllTargets && (
        <p className="text-[11px] text-mint-400/90 mt-1">
          Every set completed at target {unit} — worth considering a step up.
        </p>
      )}
    </div>
  )
}

function SetRow({ set, label, placeholder, operated, loadable, locked, restOnTick, onChange }: {
  set: SessionSet
  label: string
  placeholder: string
  operated: boolean
  loadable: boolean
  locked: boolean
  restOnTick: boolean
  onChange: (patch: Partial<SessionSet>) => void
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persist = (patch: Record<string, unknown>) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { updateSet(set.id, patch) }, 400)
  }

  const setField = (field: 'reps' | 'weight', v: number | null) => {
    onChange({ [field]: v } as Partial<SessionSet>)
    persist({ [field]: v })
  }

  const toggle = () => {
    const next = !set.completed
    // Include reps/weight: toggling cancels the pending debounced write, so a
    // value typed a moment ago would otherwise be dropped.
    const patch: Partial<SessionSet> = {
      completed: next,
      completed_at: next ? new Date().toISOString() : null,
      reps: next && set.reps == null ? set.target_reps : set.reps,
      weight: set.weight,
    }
    onChange(patch)
    if (timer.current) clearTimeout(timer.current)
    updateSet(set.id, patch as Record<string, unknown>)
    if (next) {
      if (navigator.vibrate) navigator.vibrate(12)
      if (restOnTick) startRest()
    }
  }

  return (
    <div className={`flex items-center gap-1.5 rounded-xl px-1.5 py-1.5 transition ${set.completed ? 'bg-mint-500/[0.07]' : ''}`}>
      <span className={`w-6 shrink-0 text-center text-xs font-bold tabular-nums ${
        set.completed ? 'text-mint-400' : operated ? 'text-amber-400' : 'text-ink-500'
      }`}>
        {label}
      </span>
      <div className="flex-1 min-w-0">
        <Stepper compact value={set.reps} onChange={v => setField('reps', v)}
          placeholder={placeholder} />
      </div>
      {loadable && (
        <div className="flex-1 min-w-0">
          <Stepper compact value={set.weight} onChange={v => setField('weight', v)} step={2.5} placeholder="0" />
        </div>
      )}
      <button
        onClick={toggle}
        disabled={locked}
        aria-label={set.completed ? 'Mark set incomplete' : 'Mark set complete'}
        className={`w-11 h-11 shrink-0 grid place-items-center rounded-xl border transition active:scale-90 disabled:opacity-30 ${
          set.completed
            ? 'bg-mint-500 border-mint-500 text-ink-950'
            : 'bg-ink-850 border-ink-700 text-ink-600'
        }`}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5 10 17.5 19 7" />
        </svg>
      </button>
    </div>
  )
}

/* ---------------- Completed summary ---------------- */

function CompletedSummary({ session, onEdit }: { session: WorkoutSession; onEdit: () => void }) {
  const bits: string[] = []
  if (session.knee_pain != null) bits.push(`Knee ${session.knee_pain}/10`)
  if (session.swelling) bits.push(`${session.swelling} swelling`)
  if (session.difficulty != null) bits.push(`RPE ${session.difficulty}`)
  return (
    <div className="card p-4 border-mint-500/25">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-mint-400">Completed</p>
          <Stars value={session.rating} size="sm" />
        </div>
        <button onClick={onEdit} className="btn-ghost px-3 h-11 text-xs">Edit</button>
      </div>
      {bits.length > 0 && <p className="mt-2 text-xs text-ink-500">{bits.join(' · ')}</p>}
      {session.notes && <p className="mt-2 text-sm text-slate-300 leading-relaxed">{session.notes}</p>}
    </div>
  )
}

/* ---------------- Finish sheet ---------------- */

const SWELLING: { value: Swelling; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
]

function FinishSheet({ open, onClose, session, onSaved }: {
  open: boolean; onClose: () => void; session: WorkoutSession; onSaved: (patch: Partial<WorkoutSession>) => void
}) {
  const [rating, setRating] = useState<number | null>(session.rating)
  const [difficulty, setDifficulty] = useState<number | null>(session.difficulty)
  const [pain, setPain] = useState<number | null>(session.knee_pain)
  const [swelling, setSwelling] = useState<Swelling | null>(session.swelling)
  const [notes, setNotes] = useState(session.notes ?? '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setRating(session.rating); setDifficulty(session.difficulty)
    setPain(session.knee_pain); setSwelling(session.swelling); setNotes(session.notes ?? '')
  }, [open, session])

  const already = session.status === 'completed'

  const save = async () => {
    setBusy(true)
    const patch = { rating, difficulty, knee_pain: pain, swelling, notes: notes.trim() || null }
    try {
      if (already) { await updateSession(session.id, patch); onSaved(patch) }
      else {
        await completeSession(session.id, patch)
        onSaved({ ...patch, status: 'completed', completed_at: new Date().toISOString() })
      }
    } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} onClose={onClose} title={already ? 'Edit workout' : 'Finish workout'}>
      <div className="space-y-5">
        <div>
          <span className="label">How was it</span>
          <Stars value={rating} onChange={setRating} size="lg" />
        </div>

        {session.tracks_knee && (
          <>
            <div>
              <span className="label">Knee pain</span>
              <Scale10 value={pain} onChange={setPain} />
              <div className="flex justify-between mt-1 text-[10px] text-ink-600"><span>None</span><span>Worst</span></div>
            </div>

            <div>
              <span className="label">Swelling afterwards</span>
              <div className="grid grid-cols-4 gap-1.5">
                {SWELLING.map(s => (
                  <button key={s.value} onClick={() => setSwelling(swelling === s.value ? null : s.value)}
                    className={`rounded-lg h-11 text-xs font-semibold border transition active:scale-95 ${
                      swelling === s.value ? 'bg-mint-500 text-ink-950 border-mint-500' : 'bg-ink-850 border-ink-700 text-ink-500'
                    }`}>{s.label}</button>
                ))}
              </div>
            </div>
          </>
        )}

        <div>
          <span className="label">Effort (RPE 1–10)</span>
          <Scale10 value={difficulty} onChange={setDifficulty} />
        </div>

        <div>
          <span className="label">{session.tracks_knee ? 'Notes for the physio' : 'Notes'}</span>
          <textarea className="field min-h-[88px]" placeholder="What felt good, what didn't, anything you changed…"
            value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <button onClick={save} disabled={busy} className="btn-primary w-full py-3.5">
          {busy ? 'Saving…' : already ? 'Save changes' : 'Mark complete'}
        </button>
      </div>
    </Sheet>
  )
}

/* ---------------- Options sheet ---------------- */

function EditSheet({ open, onClose, session, onSaved, onDelete }: {
  open: boolean; onClose: () => void; session: WorkoutSession
  onSaved: (patch: Partial<WorkoutSession>) => void; onDelete: () => void
}) {
  const [date, setDate] = useState(session.scheduled_date)
  const [name, setName] = useState(session.name)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setDate(session.scheduled_date); setName(session.name)
  }, [open, session])

  const save = async () => {
    setBusy(true)
    const patch = { scheduled_date: date, name: name.trim() || session.name }
    try { await updateSession(session.id, patch); onSaved(patch) }
    finally { setBusy(false) }
  }

  const setStatus = async (status: WorkoutSession['status']) => {
    setBusy(true)
    const patch: Partial<WorkoutSession> = status === 'planned'
      ? { status, started_at: null, completed_at: null }
      : { status }
    try { await updateSession(session.id, patch); onSaved(patch) }
    finally { setBusy(false) }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Workout options">
      <div className="space-y-4">
        <div>
          <span className="label">Name</span>
          <input className="field" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <span className="label">Date</span>
          <input type="date" className="field" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <button onClick={save} disabled={busy} className="btn-primary w-full py-3">Save changes</button>

        <div className="pt-2 border-t border-ink-800 space-y-2">
          {session.status !== 'planned' && (
            <button onClick={() => setStatus('planned')} className="btn-ghost w-full py-3 text-sm">Reset to planned</button>
          )}
          {session.status !== 'skipped' && (
            <button onClick={() => setStatus('skipped')} className="btn-ghost w-full py-3 text-sm">Mark as skipped</button>
          )}
          <button onClick={onDelete} className="btn-danger w-full py-3 text-sm">Delete workout</button>
        </div>
      </div>
    </Sheet>
  )
}
