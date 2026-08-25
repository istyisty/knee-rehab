import { extendRest, startRest, stopRest, preferredRest, setPreferredRest } from '../lib/rest'
import { useRest } from '../lib/hooks'

const PRESETS = [45, 60, 90, 120, 180]

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** Pinned countdown, shown only while resting. Sits above the finish bar. */
export function RestBar({ bottomOffset }: { bottomOffset: string }) {
  const { running, remaining, duration } = useRest()
  if (!running) return null
  const pct = duration > 0 ? (remaining / duration) * 100 : 0

  return (
    <div className="fixed inset-x-0 z-30 px-4 animate-slideup" style={{ bottom: bottomOffset }}>
      <div className="mx-auto max-w-md rounded-2xl bg-ink-850/95 backdrop-blur-xl border border-amber-500/30 shadow-lift overflow-hidden">
        <div className="h-1 bg-ink-800">
          <div className="h-full bg-amber-500 transition-all duration-200" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center gap-3 px-3 py-2.5">
          <span className="text-lg font-extrabold tabular-nums text-amber-400 w-14">{mmss(remaining)}</span>
          <span className="text-xs text-ink-500 flex-1">Resting</span>
          <button onClick={() => extendRest(30)}
            className="btn-ghost h-11 px-3 text-xs">+30s</button>
          <button onClick={stopRest}
            className="btn-primary h-11 px-4 text-xs">Skip</button>
        </div>
      </div>
    </div>
  )
}

/** Manual controls, shown in the workout header area. */
export function RestControls() {
  const { running } = useRest()
  const current = preferredRest()
  return (
    <div className="card p-3">
      <div className="flex items-center gap-2">
        <span className="label mb-0 shrink-0">Rest</span>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1">
          {PRESETS.map(p => (
            <button
              key={p}
              onClick={() => { setPreferredRest(p); startRest(p) }}
              className={`shrink-0 rounded-lg px-3 h-11 text-xs font-semibold border transition active:scale-95 ${
                current === p ? 'bg-amber-500/15 border-amber-500/40 text-amber-400' : 'bg-ink-850 border-ink-700 text-ink-500'
              }`}
            >{p < 60 ? `${p}s` : `${p / 60}m`}</button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-ink-600">
        {running ? 'Counting down.' : `Starts automatically for ${current < 60 ? `${current}s` : `${current / 60} min`} each time you tick a set.`}
      </p>
    </div>
  )
}
