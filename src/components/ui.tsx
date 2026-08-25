import type { ReactNode } from 'react'

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-500">
      <div className="h-7 w-7 rounded-full border-2 border-ink-700 border-t-mint-500 animate-spin" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  )
}

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card p-8 text-center">
      {icon && <div className="mb-3 flex justify-center text-ink-600">{icon}</div>}
      <h3 className="font-semibold text-slate-200">{title}</h3>
      {body && <p className="mt-1.5 text-sm text-ink-500 leading-relaxed">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Sheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md max-h-[88vh] overflow-y-auto bg-ink-900 border-t sm:border border-ink-800 rounded-t-3xl sm:rounded-2xl shadow-lift animate-slideup pb-safe">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-ink-900/95 backdrop-blur px-5 py-4 border-b border-ink-800">
          <h2 className="font-bold text-lg">{title}</h2>
          <button onClick={onClose} aria-label="Close"
            className="h-9 w-9 grid place-items-center rounded-full bg-ink-850 border border-ink-700 text-ink-500">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    planned: 'bg-ink-800 text-slate-400 border border-ink-700',
    in_progress: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    completed: 'bg-mint-500/15 text-mint-400 border border-mint-500/30',
    skipped: 'bg-rose-500/10 text-rose-400/80 border border-rose-500/20',
  }
  const label: Record<string, string> = {
    planned: 'Planned', in_progress: 'In progress', completed: 'Done', skipped: 'Skipped',
  }
  return <span className={`chip ${map[status] ?? map.planned}`}>{label[status] ?? status}</span>
}

export function Stars({ value, onChange, size = 'md' }: {
  value: number | null; onChange?: (v: number) => void; size?: 'sm' | 'md' | 'lg'
}) {
  const dims = { sm: 'text-base', md: 'text-2xl', lg: 'text-4xl' }[size]
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className={`${dims} leading-none transition ${onChange ? 'active:scale-90' : 'cursor-default'} ${
            value != null && n <= value ? 'text-amber-400' : 'text-ink-700'
          }`}
        >★</button>
      ))}
    </div>
  )
}

/** 0–10 scale used for knee pain. Big tap targets, colour-graded. */
export function Scale10({ value, onChange, invert }: {
  value: number | null; onChange: (v: number) => void; invert?: boolean
}) {
  return (
    <div className="grid grid-cols-11 gap-1">
      {Array.from({ length: 11 }, (_, n) => {
        const active = value === n
        const hue = invert ? 10 - n : n
        const tone = hue <= 2 ? 'bg-mint-500 text-ink-950' : hue <= 5 ? 'bg-amber-500 text-ink-950' : 'bg-rose-500 text-white'
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-10 rounded-lg text-sm font-bold transition active:scale-90 ${
              active ? tone : 'bg-ink-850 border border-ink-700 text-ink-500'
            }`}
          >{n}</button>
        )
      })}
    </div>
  )
}

export function SegmentedControl<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-ink-850 border border-ink-700">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
            value === o.value ? 'bg-mint-500 text-ink-950' : 'text-ink-500'
          }`}
        >{o.label}</button>
      ))}
    </div>
  )
}
