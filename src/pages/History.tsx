import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header, Page } from '../components/Header'
import { Empty, Spinner, StatusPill, Stars, SegmentedControl } from '../components/ui'
import { PlanSheet } from '../components/PlanSheet'
import { OverdueActions } from '../components/Overdue'
import { MonthCalendar } from '../components/MonthCalendar'
import { DaySheet } from '../components/DaySheet'
import { RunSheet } from '../components/RunSheet'
import { getRuns, getSessions } from '../lib/api'
import type { Run, WorkoutSession } from '../lib/types'
import { fromISO, prettyDate, todayISO } from '../lib/format'

type Filter = 'all' | 'planned' | 'completed'
type View = 'list' | 'calendar'

const VIEW_KEY = 'kr.historyView'

export default function History() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [view, setView] = useState<View>(() => (localStorage.getItem(VIEW_KEY) as View) ?? 'calendar')
  const [planOpen, setPlanOpen] = useState(false)

  // Calendar state
  const now = new Date()
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [editingRun, setEditingRun] = useState<Run | null>(null)

  const load = useCallback(async () => {
    const [s, r] = await Promise.all([getSessions(400), getRuns(400)])
    setSessions(s); setRuns(r); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  useEffect(() => { localStorage.setItem(VIEW_KEY, view) }, [view])

  const filtered = useMemo(() => {
    if (filter === 'planned') return sessions.filter(s => s.status === 'planned' || s.status === 'in_progress')
    if (filter === 'completed') return sessions.filter(s => s.status === 'completed')
    return sessions
  }, [sessions, filter])

  const months = useMemo(() => {
    const map = new Map<string, WorkoutSession[]>()
    for (const s of filtered) {
      const key = s.scheduled_date.slice(0, 7)
      map.set(key, [...(map.get(key) ?? []), s])
    }
    return [...map.entries()]
  }, [filtered])

  const step = (delta: number) => setCursor(({ year, month }) => {
    const d = new Date(year, month + delta, 1)
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const daySessions = selectedDay ? sessions.filter(s => s.scheduled_date === selectedDay) : []
  const dayRuns = selectedDay ? runs.filter(r => r.date === selectedDay) : []

  return (
    <>
      <Header
        title="Workouts"
        subtitle={`${sessions.filter(s => s.status === 'completed').length} completed`}
        action={
          <button onClick={() => setPlanOpen(true)} aria-label="Plan a workout"
            className="h-11 w-11 shrink-0 grid place-items-center rounded-full bg-mint-500 text-ink-950 font-bold text-xl active:scale-95">+</button>
        }
      />
      <Page>
        <SegmentedControl
          value={view}
          onChange={setView}
          options={[{ value: 'calendar', label: 'Calendar' }, { value: 'list', label: 'List' }]}
        />

        {loading ? <Spinner /> : view === 'calendar' ? (
          <MonthCalendar
            year={cursor.year}
            month={cursor.month}
            sessions={sessions}
            runs={runs}
            selected={selectedDay}
            onSelect={setSelectedDay}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            onToday={() => setCursor({ year: new Date().getFullYear(), month: new Date().getMonth() })}
          />
        ) : (
          <>
            <SegmentedControl
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'planned', label: 'Upcoming' },
                { value: 'completed', label: 'Done' },
              ]}
            />

            {filtered.length === 0 ? (
              <Empty
                title="Nothing here yet"
                body="Plan Strength A or B and it'll show up in this list."
                action={<button onClick={() => setPlanOpen(true)} className="btn-primary px-5 py-2.5">Plan a workout</button>}
              />
            ) : (
              months.map(([month, items]) => (
                <section key={month}>
                  <h2 className="label">
                    {fromISO(`${month}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </h2>
                  <div className="space-y-2">
                    {items.map(s => <SessionRow key={s.id} session={s} onChanged={load} />)}
                  </div>
                </section>
              ))
            )}
          </>
        )}
      </Page>

      <DaySheet
        iso={selectedDay}
        sessions={daySessions}
        runs={dayRuns}
        onClose={() => setSelectedDay(null)}
        onOpenRun={run => setEditingRun(run)}
      />

      <RunSheet
        open={editingRun != null}
        run={editingRun}
        onClose={() => setEditingRun(null)}
        onSaved={load}
      />

      <PlanSheet open={planOpen} onClose={() => setPlanOpen(false)} onPlanned={load} />
    </>
  )
}

function SessionRow({ session, onChanged }: { session: WorkoutSession; onChanged: () => void }) {
  const past = session.scheduled_date < todayISO()
  const missed = past && session.status === 'planned'
  return (
    <div className="card px-4 py-3.5">
      <Link to={`/session/${session.id}`} className="flex items-center gap-3 active:scale-[.99] transition">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm truncate">{session.name}</p>
          <p className="text-xs text-ink-500 mt-0.5">
            {prettyDate(session.scheduled_date)}
            {missed && <span className="text-rose-400/80"> · missed</span>}
            {session.knee_pain != null && <span> · knee {session.knee_pain}/10</span>}
          </p>
        </div>
        {session.status === 'completed' && session.rating != null
          ? <Stars value={session.rating} size="sm" />
          : <StatusPill status={session.status} />}
      </Link>
      {missed && <OverdueActions session={session} onDone={onChanged} />}
    </div>
  )
}
