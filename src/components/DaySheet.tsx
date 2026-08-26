import { useNavigate } from 'react-router-dom'
import { Sheet, Stars, StatusPill } from './ui'
import { fmtDistance, fmtDuration, fmtPace, longDate } from '../lib/format'
import type { Run, WorkoutSession } from '../lib/types'

/** What happened on one day: every session and run, each a tap from its detail. */
export function DaySheet({ iso, sessions, runs, onClose, onOpenRun }: {
  iso: string | null
  sessions: WorkoutSession[]
  runs: Run[]
  onClose: () => void
  onOpenRun?: (run: Run) => void
}) {
  const nav = useNavigate()
  if (!iso) return null
  const empty = sessions.length === 0 && runs.length === 0

  return (
    <Sheet open onClose={onClose} title={longDate(iso)}>
      <div className="space-y-3">
        {empty && (
          <p className="text-sm text-ink-500 text-center py-6">
            Nothing logged on this day.
          </p>
        )}

        {sessions.map(s => (
          <button
            key={s.id}
            onClick={() => { onClose(); nav(`/session/${s.id}`) }}
            className="w-full card p-4 text-left active:scale-[.99] transition"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{s.name}</p>
                {s.status === 'completed' && s.rating != null && (
                  <div className="mt-1"><Stars value={s.rating} size="sm" /></div>
                )}
              </div>
              <StatusPill status={s.status} />
            </div>

            {(s.knee_pain != null || s.swelling || s.difficulty != null) && (
              <p className="mt-2.5 text-xs text-ink-500">
                {[
                  s.knee_pain != null && `Knee ${s.knee_pain}/10`,
                  s.swelling && `${s.swelling} swelling`,
                  s.difficulty != null && `RPE ${s.difficulty}`,
                ].filter(Boolean).join(' · ')}
              </p>
            )}

            {s.notes && (
              <p className="mt-2 text-sm text-slate-300 leading-relaxed line-clamp-3">{s.notes}</p>
            )}

            <p className="mt-3 text-xs font-semibold text-mint-400">Open workout →</p>
          </button>
        ))}

        {runs.map(r => (
          <button
            key={r.id}
            onClick={() => { onClose(); onOpenRun?.(r) }}
            className="w-full card p-4 text-left active:scale-[.99] transition"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{r.name || 'Run'}</p>
                {r.source === 'strava' && (
                  <span className="chip bg-[#fc4c02]/15 text-[#fc7c42] text-[10px] mt-1">Strava</span>
                )}
              </div>
              {r.rating != null && <Stars value={r.rating} size="sm" />}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Metric value={fmtDistance(r.distance_m)} label="distance" />
              <Metric value={fmtDuration(r.moving_time_s)} label="time" />
              <Metric value={fmtPace(r.distance_m, r.moving_time_s)} label="pace" />
            </div>

            {r.knee_pain != null && (
              <p className="mt-2.5 text-xs text-ink-500">Knee {r.knee_pain}/10</p>
            )}
          </button>
        ))}
      </div>
    </Sheet>
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
