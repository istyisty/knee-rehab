import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spinner } from '../components/ui'
import {
  getExercises, getRuns, getSessions, getSettings, getSymmetryHistory, type SymmetryPoint,
} from '../lib/api'
import { supabase } from '../lib/supabase'
import type { AppSettings, Exercise, Run, WorkoutSession } from '../lib/types'
import { fmtDistance, fmtDuration, fmtWeight, longDate, toISO } from '../lib/format'

interface ExerciseLoad {
  name: string
  unilateral: boolean
  first: { date: string; left: number | null; right: number | null; both: number | null } | null
  latest: { date: string; left: number | null; right: number | null; both: number | null } | null
}

/**
 * A one-page summary to hand to the physio at a review. Deliberately plain and
 * print-friendly: the whole point is that it reads on paper or a screen without
 * anyone needing the app.
 */
export default function Report() {
  const nav = useNavigate()
  const [weeks, setWeeks] = useState(6)
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [symmetry, setSymmetry] = useState<SymmetryPoint[]>([])
  const [loads, setLoads] = useState<ExerciseLoad[]>([])
  const [loading, setLoading] = useState(true)

  const from = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - weeks * 7); return toISO(d)
  }, [weeks])

  useEffect(() => {
    setLoading(true)
    Promise.all([getSessions(400), getRuns(400), getSettings(), getExercises()])
      .then(async ([s, r, st, exercises]) => {
        setSessions(s); setRuns(r); setSettings(st)
        if (st.operated_side) {
          getSymmetryHistory(st.operated_side).then(setSymmetry).catch(() => {})
        }
        setLoads(await buildLoadTable(exercises, from))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [from])

  const done = sessions.filter(s => s.status === 'completed' && s.scheduled_date >= from)
  const skipped = sessions.filter(s => s.status === 'skipped' && s.scheduled_date >= from)
  const periodRuns = runs.filter(r => r.date >= from)

  const painValues = [
    ...done.filter(s => s.knee_pain != null).map(s => ({ date: s.scheduled_date, v: s.knee_pain! })),
    ...periodRuns.filter(r => r.knee_pain != null).map(r => ({ date: r.date, v: r.knee_pain! })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const avg = (xs: number[]) => xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length) : null
  const half = Math.floor(painValues.length / 2)
  const painEarly = avg(painValues.slice(0, half).map(p => p.v))
  const painLate = avg(painValues.slice(half).map(p => p.v))

  const swellingCounts = done.reduce<Record<string, number>>((acc, s) => {
    if (s.swelling) acc[s.swelling] = (acc[s.swelling] ?? 0) + 1
    return acc
  }, {})

  const latestSymmetry = symmetry[symmetry.length - 1]
  const firstSymmetry = symmetry[0]

  const totalKm = periodRuns.reduce((t, r) => t + (r.distance_m ?? 0), 0) / 1000
  const notes = done.filter(s => s.notes).slice(0, 8)

  if (loading) return <div className="min-h-screen"><Spinner label="Building your summary" /></div>

  return (
    <div className="min-h-screen bg-ink-950 print:bg-white print:text-black">
      {/* Controls — hidden when printed */}
      <div className="print:hidden sticky top-0 z-30 bg-ink-950/90 backdrop-blur-xl border-b border-ink-800 pt-safe">
        <div className="mx-auto max-w-md px-4 h-16 flex items-center gap-3">
          <button onClick={() => nav(-1)} aria-label="Back"
            className="h-11 w-11 -ml-1 shrink-0 grid place-items-center rounded-full bg-ink-850 border border-ink-700 text-slate-300">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <h1 className="font-extrabold text-xl flex-1">Physio summary</h1>
          <button onClick={() => window.print()} className="btn-primary px-4 h-11 text-sm">Save PDF</button>
        </div>
        <div className="mx-auto max-w-md px-4 pb-3 flex gap-1.5">
          {[4, 6, 12, 26].map(w => (
            <button key={w} onClick={() => setWeeks(w)}
              className={`flex-1 rounded-lg h-11 text-xs font-semibold border transition ${
                weeks === w ? 'bg-mint-500 text-ink-950 border-mint-500' : 'bg-ink-850 border-ink-700 text-ink-500'
              }`}>{w} wks</button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 py-6 space-y-6 print:max-w-none print:px-0">
        <header>
          <h2 className="text-2xl font-extrabold print:text-black">Knee rehab summary</h2>
          <p className="text-sm text-ink-500 print:text-gray-600 mt-1">
            {longDate(from)} to {longDate(toISO(new Date()))}
            {settings?.operated_side && ` · ${settings.operated_side} knee`}
            {settings?.surgery_date && ` · surgery ${longDate(settings.surgery_date)}`}
          </p>
        </header>

        <Block title="Adherence">
          <Row label="Sessions completed" value={String(done.length)} />
          <Row label="Sessions skipped" value={String(skipped.length)} />
          <Row label="Runs" value={`${periodRuns.length} · ${totalKm.toFixed(1)} km`} />
          <Row label="Average session rating"
            value={fmtAvg(done.filter(s => s.rating != null).map(s => s.rating!), '/5')} />
          <Row label="Average effort (RPE)"
            value={fmtAvg(done.filter(s => s.difficulty != null).map(s => s.difficulty!), '/10')} />
        </Block>

        <Block title="Knee pain">
          {painValues.length === 0 ? <Empty /> : (
            <>
              <Row label="Readings" value={String(painValues.length)} />
              <Row label="First half average" value={painEarly == null ? '–' : `${painEarly.toFixed(1)}/10`} />
              <Row label="Second half average" value={painLate == null ? '–' : `${painLate.toFixed(1)}/10`} />
              <Row label="Highest" value={`${Math.max(...painValues.map(p => p.v))}/10`} />
              {painEarly != null && painLate != null && (
                <p className="text-xs text-ink-500 print:text-gray-600 mt-2 leading-relaxed">
                  {painLate < painEarly
                    ? `Reported pain is lower in the second half of this period (${painEarly.toFixed(1)} → ${painLate.toFixed(1)}).`
                    : painLate > painEarly
                      ? `Reported pain is higher in the second half of this period (${painEarly.toFixed(1)} → ${painLate.toFixed(1)}).`
                      : 'Reported pain is unchanged across the period.'}
                </p>
              )}
            </>
          )}
        </Block>

        <Block title="Swelling reported after sessions">
          {Object.keys(swellingCounts).length === 0 ? <Empty /> : (
            (['none', 'mild', 'moderate', 'severe'] as const)
              .filter(k => swellingCounts[k])
              .map(k => <Row key={k} label={k[0].toUpperCase() + k.slice(1)} value={String(swellingCounts[k])} />)
          )}
        </Block>

        {settings?.operated_side && (
          <Block title="Limb symmetry">
            {symmetry.length === 0 ? <Empty /> : (
              <>
                <Row label="Latest"
                  value={latestSymmetry ? `${latestSymmetry.pct}% (${longDate(latestSymmetry.date)})` : '–'} />
                <Row label="At the start of this period"
                  value={firstSymmetry ? `${firstSymmetry.pct}%` : '–'} />
                <p className="text-xs text-ink-500 print:text-gray-600 mt-2 leading-relaxed">
                  Operated ({settings.operated_side}) leg work as a percentage of the other leg,
                  summed across all single-leg exercises. 100% is parity.
                </p>
              </>
            )}
          </Block>
        )}

        <Block title="Load progression">
          {loads.length === 0 ? <Empty /> : (
            <div className="space-y-2">
              {loads.map(l => (
                <div key={l.name} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-slate-300 print:text-black truncate">{l.name}</span>
                  <span className="text-ink-500 print:text-gray-700 tabular-nums shrink-0 text-xs">
                    {describeLoad(l)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Block>

        {periodRuns.length > 0 && (
          <Block title="Running">
            {periodRuns.slice(0, 10).map(r => (
              <div key={r.id} className="flex items-baseline justify-between gap-3 text-sm py-0.5">
                <span className="text-slate-300 print:text-black truncate">
                  {longDate(r.date)}
                </span>
                <span className="text-ink-500 print:text-gray-700 tabular-nums shrink-0 text-xs">
                  {fmtDistance(r.distance_m)} · {fmtDuration(r.moving_time_s)}
                  {r.knee_pain != null && ` · knee ${r.knee_pain}/10`}
                </span>
              </div>
            ))}
          </Block>
        )}

        {notes.length > 0 && (
          <Block title="Session notes">
            <div className="space-y-3">
              {notes.map(s => (
                <div key={s.id}>
                  <p className="text-xs font-semibold text-slate-400 print:text-gray-700">
                    {longDate(s.scheduled_date)} · {s.name}
                  </p>
                  <p className="text-sm text-slate-300 print:text-black leading-relaxed">{s.notes}</p>
                </div>
              ))}
            </div>
          </Block>
        )}

        <p className="text-[11px] text-ink-600 print:text-gray-500 text-center pb-8">
          Generated from self-reported training data. Not a clinical assessment.
        </p>
      </div>
    </div>
  )
}

/* ---------------- helpers ---------------- */

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4 print:border print:border-gray-300 print:rounded-none print:break-inside-avoid">
      <h3 className="font-bold text-sm mb-2.5 print:text-black">{title}</h3>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="text-ink-500 print:text-gray-700">{label}</span>
      <span className="font-semibold tabular-nums print:text-black">{value}</span>
    </div>
  )
}

const Empty = () => <p className="text-sm text-ink-600 print:text-gray-500">Nothing recorded in this period.</p>

function fmtAvg(xs: number[], suffix: string): string {
  if (!xs.length) return '–'
  return `${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1)}${suffix}`
}

function describeLoad(l: ExerciseLoad): string {
  const fmt = (p: ExerciseLoad['first']) => {
    if (!p) return '–'
    if (l.unilateral) {
      const bits = [p.left, p.right].map(v => v == null ? '–' : fmtWeight(v))
      return `L ${bits[0]} / R ${bits[1]}`
    }
    return p.both == null ? '–' : `${fmtWeight(p.both)}kg`
  }
  if (!l.first || !l.latest) return fmt(l.latest ?? l.first)
  const a = fmt(l.first), b = fmt(l.latest)
  return a === b ? b : `${a} → ${b}`
}

/** First and latest top-set load per exercise inside the window. */
async function buildLoadTable(exercises: Exercise[], from: string): Promise<ExerciseLoad[]> {
  const { data, error } = await supabase
    .from('session_exercises')
    .select('exercise_id, name, unilateral, session_sets(side, weight, completed), workout_sessions!inner(scheduled_date, status)')
    .eq('workout_sessions.status', 'completed')
    .gte('workout_sessions.scheduled_date', from)
    .limit(1000)
  if (error || !data) return []

  const byExercise = new Map<string, { name: string; unilateral: boolean; days: Map<string, any> }>()
  for (const row of data as any[]) {
    const exId = row.exercise_id
    if (!exId) continue
    const entry = byExercise.get(exId) ?? { name: row.name, unilateral: row.unilateral, days: new Map() }
    const date = row.workout_sessions.scheduled_date
    const day = entry.days.get(date) ?? { date, left: null, right: null, both: null }
    for (const s of row.session_sets ?? []) {
      if (!s.completed || s.weight == null) continue
      const w = Number(s.weight)
      const key = s.side as 'left' | 'right' | 'both'
      if (day[key] == null || w > day[key]) day[key] = w
    }
    entry.days.set(date, day)
    byExercise.set(exId, entry)
  }

  const loadable = new Set(exercises.filter(e => e.loadable).map(e => e.id))

  return [...byExercise.entries()]
    .filter(([id]) => loadable.has(id))
    .map(([, v]) => {
      const days = [...v.days.values()]
        .filter(d => d.left != null || d.right != null || d.both != null)
        .sort((a, b) => a.date.localeCompare(b.date))
      return { name: v.name, unilateral: v.unilateral, first: days[0] ?? null, latest: days[days.length - 1] ?? null }
    })
    .filter(l => l.latest)
    .sort((a, b) => a.name.localeCompare(b.name))
}
