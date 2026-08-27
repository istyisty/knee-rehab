import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header, Page } from '../components/Header'
import { Empty, Spinner } from '../components/ui'
import { getPrograms, getTemplates } from '../lib/api'
import type { Program, WorkoutTemplate } from '../lib/types'
import { WEEKDAY_LABELS } from '../lib/format'

export default function Programs() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [workouts, setWorkouts] = useState<Record<string, WorkoutTemplate[]>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const ps = await getPrograms()
    setPrograms(ps)
    const all = await getTemplates()
    const grouped: Record<string, WorkoutTemplate[]> = {}
    all.forEach(t => {
      if (!t.program_id) return
      grouped[t.program_id] = [...(grouped[t.program_id] ?? []), t]
    })
    setWorkouts(grouped)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <>
      <Header
        title="Programs"
        subtitle="Your training, grouped"
        back="/settings"
        action={
          <Link to="/program/new" aria-label="New program"
            className="h-11 w-11 shrink-0 grid place-items-center rounded-full bg-mint-500 text-ink-950 font-bold text-xl active:scale-95">+</Link>
        }
      />
      <Page>
        {loading ? <Spinner /> : programs.length === 0 ? (
          <Empty
            title="No programs yet"
            body="A program is a set of workouts you run to a schedule — a rehab block, a strength split, whatever you're doing."
            action={<Link to="/program/new" className="btn-primary px-5 py-2.5 inline-flex">Create one</Link>}
          />
        ) : (
          <div className="space-y-3">
            {programs.map(p => {
              const items = workouts[p.id] ?? []
              const strength = items.filter(w => w.kind === 'strength')
              const days = WEEKDAY_LABELS.filter(d =>
                (p.schedule ?? {})[d.n] || (p.run_days ?? []).includes(Number(d.n)))
              return (
                <Link key={p.id} to={`/program/${p.id}`}
                  className="card p-4 block active:scale-[.99] transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-bold truncate">{p.name}</h2>
                      {p.description && <p className="text-xs text-ink-500 mt-0.5 truncate">{p.description}</p>}
                    </div>
                    {p.tracks_knee && (
                      <span className="chip bg-mint-500/15 text-mint-400 border border-mint-500/30 shrink-0">Rehab</span>
                    )}
                  </div>

                  <p className="mt-3 text-xs text-ink-500">
                    {strength.length} workout{strength.length === 1 ? '' : 's'}
                    {days.length > 0 && ` · ${days.map(d => d.label).join(', ')}`}
                  </p>
                </Link>
              )
            })}
          </div>
        )}

        <p className="text-center text-[11px] text-ink-600 leading-relaxed pb-4">
          Deleting a program keeps everything you've already logged — history is never rewritten.
        </p>
      </Page>
    </>
  )
}
