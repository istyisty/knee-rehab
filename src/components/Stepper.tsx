import { useEffect, useState } from 'react'

/**
 * Numeric input with -/+ shoulders. Keeps a local string while focused so
 * clearing the field to type a new value doesn't fight the parent state.
 */
export function Stepper({ value, onChange, step = 1, min = 0, max, suffix, placeholder, compact }: {
  value: number | null
  onChange: (v: number | null) => void
  step?: number
  min?: number
  max?: number
  suffix?: string
  placeholder?: string
  compact?: boolean
}) {
  const [draft, setDraft] = useState<string>(value == null ? '' : String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(value == null ? '' : String(value))
  }, [value, focused])

  const bump = (dir: 1 | -1) => {
    const base = value ?? 0
    let next = Math.round((base + dir * step) * 100) / 100
    if (min != null) next = Math.max(min, next)
    if (max != null) next = Math.min(max, next)
    onChange(next)
  }

  // 44px tall even in compact rows: these get tapped with sweaty hands.
  const h = compact ? 'h-11' : 'h-12'
  // Narrow shoulders but full height: 44px of vertical target is what makes
  // these tappable, and the width is needed by the number itself.
  const shoulder = compact ? 'w-[30px]' : 'w-10'
  return (
    <div className={`flex items-stretch rounded-xl bg-ink-850 border border-ink-700 overflow-hidden ${h}`}>
      <button
        type="button" onClick={() => bump(-1)} aria-label="Decrease"
        className={`${shoulder} shrink-0 grid place-items-center text-lg font-bold text-ink-500 active:bg-ink-800`}
      >−</button>
      <div className="relative flex-1 min-w-0">
        <input
          type="number"
          inputMode="decimal"
          value={draft}
          placeholder={placeholder ?? '–'}
          onFocus={e => { setFocused(true); e.currentTarget.select() }}
          onBlur={() => {
            setFocused(false)
            const n = draft.trim() === '' ? null : Number(draft)
            onChange(n == null || Number.isNaN(n) ? null : n)
          }}
          onChange={e => {
            setDraft(e.target.value)
            const n = e.target.value.trim() === '' ? null : Number(e.target.value)
            if (n == null || !Number.isNaN(n)) onChange(n)
          }}
          className="w-full h-full bg-transparent px-0 text-center font-bold tabular-nums text-slate-100 placeholder:text-ink-600 placeholder:font-medium focus:outline-none"
        />
        {suffix && draft !== '' && (
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-ink-500">{suffix}</span>
        )}
      </div>
      <button
        type="button" onClick={() => bump(1)} aria-label="Increase"
        className={`${shoulder} shrink-0 grid place-items-center text-lg font-bold text-ink-500 active:bg-ink-800`}
      >+</button>
    </div>
  )
}
