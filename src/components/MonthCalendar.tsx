import { useMemo } from 'react'
import { toISO, todayISO } from '../lib/format'
import type { Run, WorkoutSession } from '../lib/types'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export interface DayEntry {
  iso: string
  inMonth: boolean
  sessions: WorkoutSession[]
  runs: Run[]
}

/** Monday-first grid covering whole weeks, so the month always sits square. */
export function buildMonth(year: number, month: number, sessions: WorkoutSession[], runs: Run[]): DayEntry[] {
  const first = new Date(year, month, 1)
  // getDay() is Sunday-first; shift so Monday is 0.
  const lead = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - lead)

  const byDateSessions = new Map<string, WorkoutSession[]>()
  sessions.forEach(s => byDateSessions.set(s.scheduled_date, [...(byDateSessions.get(s.scheduled_date) ?? []), s]))
  const byDateRuns = new Map<string, Run[]>()
  runs.forEach(r => byDateRuns.set(r.date, [...(byDateRuns.get(r.date) ?? []), r]))

  const days: DayEntry[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const iso = toISO(d)
    days.push({
      iso,
      inMonth: d.getMonth() === month,
      sessions: byDateSessions.get(iso) ?? [],
      runs: byDateRuns.get(iso) ?? [],
    })
    // Stop once the month is finished and the week is complete.
    if (i >= 27 && d.getMonth() !== month && (i + 1) % 7 === 0) break
  }
  return days
}

function dotFor(s: WorkoutSession): string {
  if (s.status === 'completed') return 'bg-mint-500'
  if (s.status === 'in_progress') return 'bg-amber-400'
  if (s.status === 'skipped') return 'bg-rose-500/60'
  return 'bg-ink-600'          // planned
}

export function MonthCalendar({ year, month, sessions, runs, selected, onSelect, onPrev, onNext, onToday }: {
  year: number
  month: number
  sessions: WorkoutSession[]
  runs: Run[]
  selected: string | null
  onSelect: (iso: string) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}) {
  const days = useMemo(() => buildMonth(year, month, sessions, runs), [year, month, sessions, runs])
  const today = todayISO()
  const label = new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const showingCurrent = new Date().getFullYear() === year && new Date().getMonth() === month

  const monthDays = days.filter(d => d.inMonth)
  const doneCount = monthDays.filter(d => d.sessions.some(s => s.status === 'completed')).length
  const runCount = monthDays.reduce((t, d) => t + d.runs.length, 0)

  return (
    <div className="card p-3">
      <div className="flex items-center gap-2 px-1 pb-2">
        <button onClick={onPrev} aria-label="Previous month"
          className="h-11 w-11 shrink-0 grid place-items-center rounded-xl bg-ink-850 border border-ink-700 text-slate-300 active:scale-95">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <div className="flex-1 text-center min-w-0">
          <p className="font-bold truncate">{label}</p>
          <p className="text-[11px] text-ink-500">
            {doneCount} session{doneCount === 1 ? '' : 's'}
            {runCount > 0 && ` · ${runCount} run${runCount === 1 ? '' : 's'}`}
          </p>
        </div>
        <button onClick={onNext} aria-label="Next month"
          className="h-11 w-11 shrink-0 grid place-items-center rounded-xl bg-ink-850 border border-ink-700 text-slate-300 active:scale-95">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 px-1 pb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-bold uppercase text-ink-600 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const isToday = day.iso === today
          const isSelected = day.iso === selected
          const has = day.sessions.length > 0 || day.runs.length > 0
          return (
            <button
              key={day.iso}
              onClick={() => onSelect(day.iso)}
              disabled={!day.inMonth && !has}
              aria-label={day.iso}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-1 border transition active:scale-95 ${
                isSelected
                  ? 'bg-mint-500/15 border-mint-500/50'
                  : isToday
                    ? 'bg-ink-850 border-ink-600'
                    : has && day.inMonth
                      ? 'bg-ink-850/60 border-ink-800'
                      : 'border-transparent'
              } ${day.inMonth ? '' : 'opacity-25'}`}
            >
              <span className={`text-xs font-bold tabular-nums leading-none ${
                isToday ? 'text-mint-400' : day.inMonth ? 'text-slate-300' : 'text-ink-600'
              }`}>
                {Number(day.iso.slice(8, 10))}
              </span>
              <span className="flex items-center gap-0.5 h-1.5">
                {day.sessions.slice(0, 3).map(s => (
                  <span key={s.id} className={`h-1.5 w-1.5 rounded-full ${dotFor(s)}`} />
                ))}
                {day.runs.length > 0 && (
                  <span className="h-1.5 w-1.5 rounded-full border border-[#fc7c42]" />
                )}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-2 mt-3 px-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-500">
          <Legend className="bg-mint-500" label="Done" />
          <Legend className="bg-ink-600" label="Planned" />
          <Legend className="bg-rose-500/60" label="Skipped" />
          <Legend className="border border-[#fc7c42]" label="Run" />
        </div>
        {!showingCurrent && (
          <button onClick={onToday} className="btn-ghost px-3 h-9 text-[11px] shrink-0">Today</button>
        )}
      </div>
    </div>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full ${className}`} />
      {label}
    </span>
  )
}
