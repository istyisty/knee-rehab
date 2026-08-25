import { useEffect, useRef, useState } from 'react'

const PRESETS = [45, 60, 90, 120, 180]

function beep() {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext)
    if (!Ctx) return
    const ctx = new Ctx()
    const now = ctx.currentTime
    ;[0, 0.22, 0.44].forEach((offset, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = i === 2 ? 1046 : 784
      gain.gain.setValueAtTime(0.0001, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.35, now + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + offset)
      osc.stop(now + offset + 0.2)
    })
    setTimeout(() => ctx.close(), 1200)
  } catch { /* audio is a nicety, never a blocker */ }
  if (navigator.vibrate) navigator.vibrate([180, 90, 180])
}

/**
 * Rest countdown. Anchored to a wall-clock deadline rather than a tick counter so
 * it stays accurate when the phone screen locks mid-set.
 */
export function RestTimer({ defaultSeconds = 90 }: { defaultSeconds?: number }) {
  const [duration, setDuration] = useState(defaultSeconds)
  const [deadline, setDeadline] = useState<number | null>(null)
  const [remaining, setRemaining] = useState(defaultSeconds)
  const fired = useRef(false)

  useEffect(() => {
    if (deadline == null) return
    const tick = () => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0 && !fired.current) { fired.current = true; beep(); setDeadline(null) }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [deadline])

  const running = deadline != null
  const pct = duration > 0 ? (remaining / duration) * 100 : 0
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60

  const start = (s: number) => {
    fired.current = false
    setDuration(s)
    setRemaining(s)
    setDeadline(Date.now() + s * 1000)
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-14 shrink-0">
            <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#2a313d" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.5" fill="none"
                stroke={remaining === 0 ? '#22c98a' : '#f5a524'} strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * 97.4} 97.4`}
                style={{ transition: 'stroke-dasharray .25s linear' }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-sm font-bold tabular-nums">
              {mins}:{String(secs).padStart(2, '0')}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Rest timer</p>
            <p className="text-sm text-slate-300">
              {running ? 'Counting down' : remaining === 0 ? 'Time — next set' : 'Pick a rest length'}
            </p>
          </div>
        </div>
        {running ? (
          <button onClick={() => { setDeadline(null); setRemaining(duration) }} className="btn-ghost px-4 py-2 text-sm">Stop</button>
        ) : (
          <button onClick={() => start(duration)} className="btn-primary px-4 py-2 text-sm">Start</button>
        )}
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
        {PRESETS.map(p => (
          <button
            key={p}
            onClick={() => start(p)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold border transition active:scale-95 ${
              duration === p && running ? 'bg-amber-500/15 border-amber-500/40 text-amber-400' : 'bg-ink-850 border-ink-700 text-ink-500'
            }`}
          >{p < 60 ? `${p}s` : `${p / 60}m`}</button>
        ))}
      </div>
    </div>
  )
}
