import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header, Page } from '../components/Header'
import { Spinner, StatusPill, Stars } from '../components/ui'
import { PlanSheet } from '../components/PlanSheet'
import { RunSheet } from '../components/RunSheet'
import { ensureScheduledSessions, getRuns, getSessions } from '../lib/api'
import { OverdueActions } from '../components/Overdue'
import type { Run, WorkoutSession } from '../lib/types'
import { fmtDistance, fmtPace, longDate, prettyDate, todayISO } from '../lib/format'

export default function Home() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [planOpen, setPlanOpen] = useState(false)
  const [runOpen, setRunOpen] = useState(false)

  const load = useCallback(async () => {
    const [s, r] = await Promise.all([getSessions(60), getRuns(10)])
    setSessions(s); setRuns(r); setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Top the diary up from the recurring schedule, if one is set.
  useEffect(() => {
    ensureScheduledSessions().then(n => { if (n > 0) load() }).catch(() => {})
  }, [load])

  const today = todayISO()
  const live = sessions.find(s => s.status === 'in_progress')
  const todays = sessions.filter(s => s.scheduled_date === today && s.status !== 'completed' && s.id !== live?.id)
  const upcoming = sessions
    .filter(s => s.scheduled_date > today && (s.status === 'planned' || s.status === 'in_progress'))
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
  const next = live ?? todays[0] ?? upcoming[0]

  const overdue = sessions
    .filter(s => s.scheduled_date < today && s.status === 'planned')
    .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))

  const done = sessions.filter(s => s.status === 'completed')
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6)
  const weekISO = weekStart.toISOString().slice(0, 10)
  const thisWeek = done.filter(s => s.scheduled_date >= weekISO).length
  const runsThisWeek = runs.filter(r => r.date >= weekISO)
  const kmThisWeek = runsThisWeek.reduce((t, r) => t + (r.distance_m ?? 0), 0) / 1000

  const recent = [
    ...done.slice(0, 6).map(s => ({ kind: 'session' as const, date: s.scheduled_date, item: s })),
    ...runs.slice(0, 6).map(r => ({ kind: 'run' as const, date: r.date, item: r })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)

  return (
    <>
      <Header title="Knee Rehab" subtitle={longDate(today)} />
      <Page>
        {loading ? <Spinner label="Loading your plan" /> : (
          <>
            {/* Next up */}
            {next ? (
              <Link to={`/session/${next.id}`} className="block card p-5 active:scale-[.99] transition">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                      {next.status === 'in_progress' ? 'In progress' : next.scheduled_date === today ? 'Today' : prettyDate(next.scheduled_date)}
                    </p>
                    <h2 className="mt-1 text-2xl font-extrabold">{next.name}</h2>
                  </div>
                  <StatusPill status={next.status} />
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-mint-400">
                  {next.status === 'in_progress' ? 'Continue workout' : 'Open workout'}
                  <span aria-hidden>→</span>
                </div>
              </Link>
            ) : (
              <div className="card p-5">
                <h2 className="text-lg font-bold">Nothing planned</h2>
                <p className="mt-1 text-sm text-ink-500">Pick Strength A or B and get it in the diary.</p>
                <button onClick={() => setPlanOpen(true)} className="btn-primary mt-4 w-full py-3">Plan a workout</button>
              </div>
            )}

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setPlanOpen(true)} className="card p-4 text-left active:scale-[.98] transition">
                <div className="h-9 w-9 rounded-xl bg-mint-500/15 text-mint-400 grid place-items-center font-bold text-lg">+</div>
                <p className="mt-2.5 font-bold text-sm">Plan workout</p>
                <p className="text-xs text-ink-500">Strength A or B</p>
              </button>
              <button onClick={() => setRunOpen(true)} className="card p-4 text-left active:scale-[.98] transition">
                <div className="h-9 w-9 rounded-xl bg-amber-500/15 text-amber-400 grid place-items-center">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="14.5" cy="4.5" r="1.9" />
                    <path d="M12.8 8.4 9.5 10.7l1.9 3.1-1.2 5.6M11.4 13.8l3.6 1.4 1.5 4.2M12.8 8.4l3.4-.6 2.3 3.2 2.3.5M9.5 10.7 6.4 11l-1.3 2.6" />
                  </svg>
                </div>
                <p className="mt-2.5 font-bold text-sm">Log a run</p>
                <p className="text-xs text-ink-500">Manual entry</p>
              </button>
            </div>

            {/* This week */}
            <div className="card p-4">
              <p className="label mb-3">Last 7 days</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <Stat value={String(thisWeek)} label={thisWeek === 1 ? 'session' : 'sessions'} />
                <Stat value={String(runsThisWeek.length)} label={runsThisWeek.length === 1 ? 'run' : 'runs'} />
                <Stat value={kmThisWeek.toFixed(1)} label="km" />
              </div>
            </div>

            {/* Overdue */}
            {overdue.length > 0 && (
              <section>
                <h3 className="label">Missed</h3>
                <div className="space-y-2">
                  {overdue.slice(0, 3).map(s => (
                    <div key={s.id} className="card px-4 py-3.5">
                      <Link to={`/session/${s.id}`} className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sm">{s.name}</p>
                          <p className="text-xs text-ink-500">Planned for {prettyDate(s.scheduled_date)}</p>
                        </div>
                        <span className="chip bg-rose-500/10 text-rose-400/80 border border-rose-500/20">Missed</span>
                      </Link>
                      <OverdueActions session={s} onDone={load} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <section>
                <h3 className="label">Coming up</h3>
                <div className="space-y-2">
                  {upcoming.slice(0, 4).map(s => (
                    <Link key={s.id} to={`/session/${s.id}`} className="card px-4 py-3 flex items-center justify-between active:scale-[.99] transition">
                      <div>
                        <p className="font-semibold text-sm">{s.name}</p>
                        <p className="text-xs text-ink-500">{prettyDate(s.scheduled_date)}</p>
                      </div>
                      <StatusPill status={s.status} />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Recent */}
            {recent.length > 0 && (
              <section>
                <h3 className="label">Recently</h3>
                <div className="space-y-2">
                  {recent.map(r => r.kind === 'session' ? (
                    <Link key={r.item.id} to={`/session/${r.item.id}`} className="card px-4 py-3 flex items-center justify-between gap-3 active:scale-[.99] transition">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{(r.item as WorkoutSession).name}</p>
                        <p className="text-xs text-ink-500">{prettyDate(r.date)}</p>
                      </div>
                      <Stars value={(r.item as WorkoutSession).rating} size="sm" />
                    </Link>
                  ) : (
                    <Link key={r.item.id} to="/runs" className="card px-4 py-3 flex items-center justify-between gap-3 active:scale-[.99] transition">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{(r.item as Run).name || 'Run'}</p>
                        <p className="text-xs text-ink-500 flex items-center gap-1.5">
                          {prettyDate(r.date)} · {fmtDistance((r.item as Run).distance_m)}
                          {(r.item as Run).source === 'strava' && (
                            <span className="chip bg-[#fc4c02]/15 text-[#fc7c42] text-[9px] px-1.5 py-0">Strava</span>
                          )}
                        </p>
                      </div>
                      <p className="text-xs font-semibold text-ink-500 shrink-0">
                        {fmtPace((r.item as Run).distance_m, (r.item as Run).moving_time_s)}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </Page>

      <PlanSheet open={planOpen} onClose={() => setPlanOpen(false)} onPlanned={load} />
      <RunSheet open={runOpen} onClose={() => setRunOpen(false)} onSaved={load} />
    </>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="text-xs text-ink-500">{label}</p>
    </div>
  )
}
