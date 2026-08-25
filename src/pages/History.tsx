import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header, Page } from '../components/Header'
import { Empty, Spinner, StatusPill, Stars, SegmentedControl } from '../components/ui'
import { PlanSheet } from '../components/PlanSheet'
import { getSessions } from '../lib/api'
import { OverdueActions } from '../components/Overdue'
import type { WorkoutSession } from '../lib/types'
import { fromISO, prettyDate, todayISO } from '../lib/format'

type Filter = 'all' | 'planned' | 'completed'

export default function History() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [planOpen, setPlanOpen] = useState(false)

  const load = useCallback(async () => {
    setSessions(await getSessions(200)); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (filter === 'planned') return sessions.filter(s => s.status === 'planned' || s.status === 'in_progress')
    if (filter === 'completed') return sessions.filter(s => s.status === 'completed')
    return sessions
  }, [sessions, filter])

  // Group by month so a long rehab block stays readable
  const months = useMemo(() => {
    const map = new Map<string, WorkoutSession[]>()
    for (const s of filtered) {
      const key = s.scheduled_date.slice(0, 7)
      map.set(key, [...(map.get(key) ?? []), s])
    }
    return [...map.entries()]
  }, [filtered])

  return (
    <>
      <Header
        title="Workouts"
        subtitle={`${sessions.filter(s => s.status === 'completed').length} completed`}
        action={
          <button onClick={() => setPlanOpen(true)} aria-label="Plan a workout"
            className="h-10 w-10 shrink-0 grid place-items-center rounded-full bg-mint-500 text-ink-950 font-bold text-xl active:scale-95">+</button>
        }
      />
      <Page>
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'planned', label: 'Upcoming' },
            { value: 'completed', label: 'Done' },
          ]}
        />

        {loading ? <Spinner /> : filtered.length === 0 ? (
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
      </Page>
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
