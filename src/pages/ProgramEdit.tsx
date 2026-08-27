import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Header, Page } from '../components/Header'
import { Spinner } from '../components/ui'
import { Toggle } from '../components/ExercisePicker'
import {
  createProgram, deleteProgram, ensureScheduledSessions, getProgram, getTemplates,
  updateProgram,
} from '../lib/api'
import type { Program, WorkoutTemplate } from '../lib/types'
import { WEEKDAY_LABELS } from '../lib/format'

/** Create or edit a program: what's in it, when it happens, what it tracks. */
export default function ProgramEdit() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const isNew = id === 'new'

  const [program, setProgram] = useState<Program | null>(null)
  const [workouts, setWorkouts] = useState<WorkoutTemplate[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [planned, setPlanned] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (isNew) return
    const p = await getProgram(id!)
    setProgram(p)
    if (p) setWorkouts(await getTemplates(p.id))
    setLoading(false)
  }, [id, isNew])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      const newId = await createProgram({ name: name.trim(), sort_order: Date.now() % 100000 })
      nav(`/program/${newId}`, { replace: true })
    } finally { setBusy(false) }
  }

  const patch = (p: Partial<Program>) => {
    setProgram(prev => prev && { ...prev, ...p })
    if (program) updateProgram(program.id, p)
  }

  const strength = workouts.filter(w => w.kind === 'strength')
  const warmup = workouts.find(w => w.kind === 'warmup')

  /** Each tap cycles a day through the program's workouts, then Run, then off. */
  const cycleDay = (day: string) => {
    if (!program) return
    const dayNum = Number(day)
    const schedule = { ...(program.schedule ?? {}) }
    const runDays = [...(program.run_days ?? [])]
    const order: (string | 'run' | null)[] = [...strength.map(w => w.id), 'run', null]
    const current = schedule[day] ?? (runDays.includes(dayNum) ? 'run' : null)
    const next = order[(order.indexOf(current as any) + 1) % order.length]

    delete schedule[day]
    const runIndex = runDays.indexOf(dayNum)
    if (runIndex >= 0) runDays.splice(runIndex, 1)

    if (next === 'run') runDays.push(dayNum)
    else if (next) schedule[day] = next

    patch({ schedule, run_days: runDays })
  }

  const fillDiary = async () => {
    const n = await ensureScheduledSessions()
    setPlanned(n > 0
      ? `Added ${n} session${n === 1 ? '' : 's'} to the diary.`
      : 'Already planned for the next fortnight.')
  }

  const destroy = async () => {
    if (!program) return
    if (!window.confirm(
      `Delete "${program.name}" and its workouts? Sessions you've already logged are kept in your history.`,
    )) return
    await deleteProgram(program.id)
    nav('/programs', { replace: true })
  }

  if (isNew) {
    return (
      <>
        <Header title="New program" back={() => nav('/programs')} action={<span className="w-11" />} />
        <Page>
          <div className="card p-4">
            <span className="label">What's it called</span>
            <input className="field" autoFocus value={name} placeholder="Upper / lower split"
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && create()} />
            <p className="mt-3 text-xs text-ink-500 leading-relaxed">
              A program groups workouts together and can run to a weekly schedule.
              You'll add the workouts next.
            </p>
          </div>
          <button onClick={create} disabled={busy || !name.trim()} className="btn-primary w-full py-4">
            {busy ? 'Creating…' : 'Create program'}
          </button>
        </Page>
      </>
    )
  }

  if (loading) return <><Header title="Program" back={() => nav('/programs')} /><Spinner /></>
  if (!program) return (
    <><Header title="Program" back={() => nav('/programs')} />
      <Page><p className="card p-5 text-sm text-rose-400">That program no longer exists.</p></Page>
    </>
  )

  return (
    <>
      <Header
        title={program.name}
        subtitle={`${strength.length} workout${strength.length === 1 ? '' : 's'}`}
        back={() => nav('/programs')}
        action={<span className="w-11" />}
      />
      <Page>
        <section className="card p-4 space-y-4">
          <div>
            <span className="label">Name</span>
            <input className="field" value={program.name} onChange={e => patch({ name: e.target.value })} />
          </div>
          <div>
            <span className="label">Description <span className="normal-case font-normal text-ink-600">(optional)</span></span>
            <input className="field" value={program.description ?? ''} placeholder="What this program is for"
              onChange={e => patch({ description: e.target.value || null })} />
          </div>
          <Toggle
            checked={program.tracks_knee}
            onChange={v => patch({ tracks_knee: v })}
            label="Track knee pain and swelling"
            hint="Adds rehab prompts when you finish, and limb symmetry to Progress"
          />
        </section>

        <section>
          <div className="flex items-center justify-between gap-3 mb-2">
            <h2 className="label mb-0">Workouts</h2>
            <Link to={`/workout/new?program=${program.id}`} className="btn-ghost px-3 h-9 text-xs grid place-items-center">+ Add</Link>
          </div>

          {workouts.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-sm text-ink-500">No workouts in this program yet.</p>
              <Link to={`/workout/new?program=${program.id}`} className="btn-primary mt-4 px-5 py-2.5 inline-flex">
                Build the first one
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {workouts.map(w => (
                <Link key={w.id} to={`/workout/${w.id}`}
                  className="card px-4 py-3.5 flex items-center justify-between gap-3 active:scale-[.99] transition">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">
                      {w.name}
                      {w.kind === 'warmup' && <span className="ml-2 chip bg-ink-800 border border-ink-700 text-ink-500 text-[10px]">Shared</span>}
                    </p>
                    {w.description && <p className="text-xs text-ink-500 truncate mt-0.5">{w.description}</p>}
                  </div>
                  <span className="text-ink-600 shrink-0" aria-hidden>›</span>
                </Link>
              ))}
            </div>
          )}

          {!warmup && strength.length > 0 && (
            <p className="mt-2 text-[11px] text-ink-600 leading-relaxed">
              Add a shared warm up and every workout here can pull it in automatically.
            </p>
          )}
        </section>

        <section className="card p-4">
          <h2 className="font-bold text-sm">Weekly schedule</h2>
          <p className="mt-1 text-xs text-ink-500 leading-relaxed">
            Tap a day to cycle through this program's workouts, then a run day, then off.
            Scheduled workouts are added to your diary a fortnight ahead.
          </p>

          {strength.length === 0 ? (
            <p className="mt-3 text-xs text-ink-600">Add a workout first and the schedule opens up.</p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-7 gap-1.5">
                {WEEKDAY_LABELS.map(d => {
                  const tid = (program.schedule ?? {})[d.n]
                  const w = strength.find(x => x.id === tid)
                  const isRun = (program.run_days ?? []).includes(Number(d.n))
                  const initials = w
                    ? (w.name.match(/\b[A-Z0-9]/g)?.join('').slice(0, 2) || w.name.slice(0, 2))
                    : null
                  return (
                    <button key={d.n} onClick={() => cycleDay(d.n)}
                      className={`rounded-lg py-2 border transition active:scale-95 ${
                        w ? 'bg-mint-500/15 border-mint-500/40'
                          : isRun ? 'bg-[#fc4c02]/15 border-[#fc4c02]/40'
                          : 'bg-ink-850 border-ink-700'
                      }`}>
                      <span className="block text-[10px] font-semibold text-ink-500">{d.label}</span>
                      <span className={`block text-sm font-extrabold ${
                        w ? 'text-mint-400' : isRun ? 'text-[#fc7c42]' : 'text-ink-700'
                      }`}>
                        {initials ?? (isRun ? 'Run' : '–')}
                      </span>
                    </button>
                  )
                })}
              </div>
              <button onClick={fillDiary} className="btn-ghost w-full h-11 mt-3 text-xs">Fill the diary now</button>
              {planned && <p className="mt-2 text-xs text-mint-400">{planned}</p>}
            </>
          )}
        </section>

        <button onClick={destroy} className="btn-danger w-full py-3 text-sm">Delete this program</button>
      </Page>
    </>
  )
}
