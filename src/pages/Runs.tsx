import { useCallback, useEffect, useState } from 'react'
import { Header, Page } from '../components/Header'
import { Empty, Spinner, Stars } from '../components/ui'
import { RunSheet } from '../components/RunSheet'
import { StravaCard } from '../components/StravaCard'
import { getRuns } from '../lib/api'
import type { Run } from '../lib/types'
import { fmtDistance, fmtDuration, fmtPace, prettyDate } from '../lib/format'

export default function Runs() {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Run | null>(null)

  const load = useCallback(async () => {
    setRuns(await getRuns(200)); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const total = runs.reduce((t, r) => t + (r.distance_m ?? 0), 0) / 1000

  const open = (run: Run | null) => { setEditing(run); setSheetOpen(true) }

  return (
    <>
      <Header
        title="Runs"
        subtitle={runs.length ? `${runs.length} logged · ${total.toFixed(1)} km` : 'Nothing logged yet'}
        action={
          <button onClick={() => open(null)} aria-label="Log a run"
            className="h-10 w-10 shrink-0 grid place-items-center rounded-full bg-mint-500 text-ink-950 font-bold text-xl active:scale-95">+</button>
        }
      />
      <Page>
        <StravaCard onSynced={load} />

        {loading ? <Spinner /> : runs.length === 0 ? (
          <Empty
            title="No runs yet"
            body="Log one by hand, or connect Strava and let them pull in automatically."
            action={<button onClick={() => open(null)} className="btn-primary px-5 py-2.5">Log a run</button>}
          />
        ) : (
          <div className="space-y-2">
            {runs.map(r => (
              <button key={r.id} onClick={() => open(r)}
                className="w-full card px-4 py-3.5 text-left active:scale-[.99] transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{r.name || 'Run'}</p>
                    <p className="text-xs text-ink-500 mt-1 flex items-center gap-2">
                      {prettyDate(r.date)}
                      {r.source === 'strava' && (
                        <span className="chip bg-[#fc4c02]/15 text-[#fc7c42] text-[10px] shrink-0">Strava</span>
                      )}
                    </p>
                  </div>
                  {r.rating != null && <Stars value={r.rating} size="sm" />}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Metric value={fmtDistance(r.distance_m)} label="distance" />
                  <Metric value={fmtDuration(r.moving_time_s)} label="time" />
                  <Metric value={fmtPace(r.distance_m, r.moving_time_s)} label="pace" />
                </div>
                {(r.knee_pain != null || r.notes) && (
                  <div className="mt-3 pt-3 border-t border-ink-800 text-xs text-ink-500">
                    {r.knee_pain != null && <span className="font-semibold">Knee {r.knee_pain}/10</span>}
                    {r.knee_pain != null && r.notes && ' · '}
                    {r.notes}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </Page>

      <RunSheet open={sheetOpen} onClose={() => setSheetOpen(false)} run={editing} onSaved={load} />
    </>
  )
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-bold text-sm tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-ink-600">{label}</p>
    </div>
  )
}
