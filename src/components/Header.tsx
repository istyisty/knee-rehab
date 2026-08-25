import { Link, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'

export function Header({ title, subtitle, action, back }: {
  title: string; subtitle?: string; action?: ReactNode; back?: string | (() => void)
}) {
  const nav = useNavigate()
  return (
    <header className="sticky top-0 z-30 bg-ink-950/85 backdrop-blur-xl border-b border-ink-800/70 pt-safe">
      <div className="mx-auto max-w-md px-4 h-16 flex items-center gap-3">
        {back != null && (
          <button
            onClick={() => (typeof back === 'string' ? nav(back) : back())}
            aria-label="Back"
            className="h-10 w-10 -ml-1 shrink-0 grid place-items-center rounded-full bg-ink-850 border border-ink-700 text-slate-300 active:scale-95"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-extrabold text-xl leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs text-ink-500 truncate">{subtitle}</p>}
        </div>
        {action ?? (
          <Link to="/settings" aria-label="Settings"
            className="h-10 w-10 shrink-0 grid place-items-center rounded-full bg-ink-850 border border-ink-700 text-ink-500 active:scale-95">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.7 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v0a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1z" />
            </svg>
          </Link>
        )}
      </div>
    </header>
  )
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-md px-4 py-5 space-y-5">{children}</div>
}
