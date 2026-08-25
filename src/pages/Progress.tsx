import { useEffect, useMemo, useState } from 'react'
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Header, Page } from '../components/Header'
import { Empty, Spinner } from '../components/ui'
import {
  getExerciseHistory, getExercises, getRuns, getSessions, getSettings, getSymmetryHistory,
  type ExerciseHistoryPoint, type SymmetryPoint,
} from '../lib/api'
import type { AppSettings, Exercise, Run, WorkoutSession } from '../lib/types'
import { Link } from 'react-router-dom'
import { fromISO } from '../lib/format'

const MINT = '#22c98a'
const AMBER = '#f5a524'
const ROSE = '#fb7185'
const GRID = '#232a34'
const AXIS = '#5a6474'

const shortDate = (iso: string) =>
  fromISO(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

export default function Progress() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [selected, setSelected] = useState<string>('')
  const [history, setHistory] = useState<ExerciseHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingEx, setLoadingEx] = useState(false)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [symmetry, setSymmetry] = useState<SymmetryPoint[]>([])

  useEffect(() => {
    Promise.all([getExercises(), getSessions(200), getRuns(200), getSettings()]).then(([e, s, r, st]) => {
      const loadable = e.filter(x => x.loadable)
      setExercises(loadable)
      setSessions(s); setRuns(r); setSettings(st)
      setSelected(prev => prev || localStorage.getItem('kr.progressExercise') || loadable[0]?.id || '')
      setLoading(false)
      if (st.operated_side) getSymmetryHistory(st.operated_side).then(setSymmetry).catch(() => {})
    })
  }, [])

  useEffect(() => {
    if (!selected) return
    localStorage.setItem('kr.progressExercise', selected)
    setLoadingEx(true)
    getExerciseHistory(selected).then(h => { setHistory(h); setLoadingEx(false) })
  }, [selected])

  const done = useMemo(() => sessions.filter(s => s.status === 'completed'), [sessions])

  /** Knee pain across everything you've logged, sessions and runs together. */
  const painSeries = useMemo(() => {
    const points = [
      ...done.filter(s => s.knee_pain != null).map(s => ({ date: s.scheduled_date, pain: s.knee_pain! })),
      ...runs.filter(r => r.knee_pain != null).map(r => ({ date: r.date, pain: r.knee_pain! })),
    ]
    const byDate = new Map<string, number[]>()
    points.forEach(p => byDate.set(p.date, [...(byDate.get(p.date) ?? []), p.pain]))
    return [...byDate.entries()]
      .map(([date, v]) => ({ date, pain: Math.max(...v) }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30)
  }, [done, runs])

  /** Weekly running volume for the last 12 weeks. */
  const weeklyKm = useMemo(() => {
    const weeks = new Map<string, number>()
    for (const r of runs) {
      const d = fromISO(r.date)
      const monday = new Date(d)
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      const key = monday.toISOString().slice(0, 10)
      weeks.set(key, (weeks.get(key) ?? 0) + (r.distance_m ?? 0) / 1000)
    }
    return [...weeks.entries()]
      .map(([date, km]) => ({ date, km: Math.round(km * 10) / 10 }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-12)
  }, [runs])

  const totalVolume = done.length
  const avgRating = done.filter(s => s.rating != null)
  const avg = avgRating.length
    ? (avgRating.reduce((t, s) => t + s.rating!, 0) / avgRating.length).toFixed(1) : '–'

  if (loading) return <><Header title="Progress" /><Spinner /></>

  return (
    <>
      <Header title="Progress" subtitle="How the rehab is trending" />
      <Page>
        <div className="grid grid-cols-3 gap-3">
          <Tile value={String(totalVolume)} label="sessions" />
          <Tile value={String(runs.length)} label="runs" />
          <Tile value={avg} label="avg rating" />
        </div>

        {/* Symmetry — the number that matters after a meniscectomy */}
        <section className="card p-4">
          <h2 className="font-bold text-sm">Operated leg vs the other</h2>
          {!settings?.operated_side ? (
            <p className="mt-2 text-sm text-ink-500 leading-relaxed">
              Tell the app which knee was operated on in{' '}
              <Link to="/settings" className="text-mint-400 font-semibold">Settings</Link>{' '}
              and this chart will track how the gap is closing.
            </p>
          ) : symmetry.length === 0 ? (
            <p className="mt-2 text-sm text-ink-500 leading-relaxed">
              Complete a session with single-leg work logged on both sides and the comparison starts here.
            </p>
          ) : (
            <>
              <p className="text-xs text-ink-500 mt-0.5 mb-3">
                {settings.operated_side === 'left' ? 'Left' : 'Right'} leg as a share of the other, across all single-leg work
              </p>
              <div className="h-44 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={symmetry} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="sym" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={MINT} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={MINT} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 120]} ticks={[0, 50, 100]} stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} width={32} />
                    <ReferenceLine y={100} stroke={AXIS} strokeDasharray="4 4" />
                    <Tooltip content={<ChartTip suffix="%" />} />
                    <Area type="monotone" dataKey="pct" name="Symmetry" stroke={MINT} strokeWidth={2.5} fill="url(#sym)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-ink-600 text-center mt-1">
                100% means both legs are doing the same work — the dashed line is the target
              </p>
            </>
          )}
        </section>

        {/* Per-exercise loading */}
        <section className="card p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-bold text-sm">Loading by exercise</h2>
          </div>
          <select className="field mb-4" value={selected} onChange={e => setSelected(e.target.value)}>
            {exercises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>

          {loadingEx ? <Spinner /> : history.length < 1 ? (
            <p className="text-sm text-ink-500 text-center py-8">
              Nothing logged for this exercise yet. Complete a session with a weight against it and the trend shows here.
            </p>
          ) : (
            <>
              <div className="h-52 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} width={34} />
                    <Tooltip content={<ChartTip suffix=" kg" />} />
                    <Line type="monotone" dataKey="topWeight" name="Top set" stroke={MINT} strokeWidth={2.5}
                      dot={{ r: 3, fill: MINT, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
                    {history.some(h => h.left || h.right) && <>
                      <Line type="monotone" dataKey="left.topWeight" name="Left" stroke={AXIS} strokeWidth={1.5}
                        strokeDasharray="4 3" dot={false} connectNulls />
                      <Line type="monotone" dataKey="right.topWeight" name="Right" stroke={AMBER} strokeWidth={1.5}
                        strokeDasharray="4 3" dot={false} connectNulls />
                    </>}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-ink-600 text-center mt-1">Heaviest set each session, kg</p>

              <div className="h-40 -ml-2 mt-5">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={AMBER} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={AMBER} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} width={34} />
                    <Tooltip content={<ChartTip suffix=" kg·reps" />} />
                    <Area type="monotone" dataKey="volume" name="Volume" stroke={AMBER} strokeWidth={2} fill="url(#vol)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-ink-600 text-center mt-1">Total volume per session, weight × reps</p>
            </>
          )}
        </section>

        {/* Knee pain */}
        <section className="card p-4">
          <h2 className="font-bold text-sm mb-3">Knee pain</h2>
          {painSeries.length === 0 ? (
            <p className="text-sm text-ink-500 text-center py-6">
              Rate your knee when you finish a session or log a run and the trend builds up here.
            </p>
          ) : (
            <>
              <div className="h-44 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={painSeries} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} width={24} />
                    <Tooltip content={<ChartTip suffix=" / 10" />} />
                    <Line type="monotone" dataKey="pain" name="Knee pain" stroke={ROSE} strokeWidth={2.5}
                      dot={{ r: 3, fill: ROSE, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-ink-600 text-center mt-1">Worst score reported each day — lower is better</p>
            </>
          )}
        </section>

        {/* Weekly running */}
        <section className="card p-4">
          <h2 className="font-bold text-sm mb-3">Weekly running volume</h2>
          {weeklyKm.length === 0 ? (
            <Empty title="No runs logged" body="Log a run or sync Strava to see your weekly mileage." />
          ) : (
            <>
              <div className="h-44 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyKm} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="km" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={MINT} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={MINT} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} width={30} />
                    <Tooltip content={<ChartTip suffix=" km" />} />
                    <Area type="monotone" dataKey="km" name="Distance" stroke={MINT} strokeWidth={2} fill="url(#km)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-ink-600 text-center mt-1">Week beginning — build gradually</p>
            </>
          )}
        </section>
      </Page>
    </>
  )
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="card p-4 text-center">
      <p className="text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="text-[11px] text-ink-500">{label}</p>
    </div>
  )
}

function ChartTip({ active, payload, label, suffix }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl bg-ink-850 border border-ink-700 px-3 py-2 shadow-lift">
      <p className="text-[11px] text-ink-500">{shortDate(label)}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-sm font-bold" style={{ color: p.stroke }}>
          {p.value?.toLocaleString?.() ?? p.value}{suffix}
        </p>
      ))}
    </div>
  )
}
