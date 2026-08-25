import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header, Page } from '../components/Header'
import { StravaCard } from '../components/StravaCard'
import { Spinner } from '../components/ui'
import { ensureScheduledSessions, getSettings, getTemplateExercises, getTemplates, saveSettings } from '../lib/api'
import type { AppSettings, TemplateExercise, WorkoutTemplate } from '../lib/types'
import { BLOCK_LABEL } from '../lib/format'

const DAYS = [
  { n: '1', label: 'Mon' }, { n: '2', label: 'Tue' }, { n: '3', label: 'Wed' },
  { n: '4', label: 'Thu' }, { n: '5', label: 'Fri' }, { n: '6', label: 'Sat' }, { n: '0', label: 'Sun' },
]

export default function Settings() {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [detail, setDetail] = useState<Record<string, TemplateExercise[]>>({})
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [planned, setPlanned] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getTemplates(), getSettings()]).then(async ([ts, st]) => {
      setTemplates(ts)
      setSettings(st)
      const entries = await Promise.all(ts.map(async t => [t.id, await getTemplateExercises(t.id)] as const))
      setDetail(Object.fromEntries(entries))
      setLoading(false)
    })
  }, [])

  const patch = (p: Partial<AppSettings>) => {
    setSettings(prev => prev && { ...prev, ...p })
    saveSettings(p)
  }

  const strength = templates.filter(t => t.kind === 'strength')

  const cycleDay = (day: string) => {
    if (!settings) return
    const current = settings.schedule[day]
    const order = [undefined, ...strength.map(t => t.id)]
    const idx = order.indexOf(current as any)
    const next = order[(idx + 1) % order.length]
    const schedule = { ...settings.schedule }
    if (next) schedule[day] = next
    else delete schedule[day]
    patch({ schedule })
  }

  const fillDiary = async () => {
    const n = await ensureScheduledSessions()
    setPlanned(n > 0 ? `Added ${n} session${n === 1 ? '' : 's'} to the diary.` : 'Diary is already full for the next fortnight.')
  }

  return (
    <>
      <Header title="Settings" subtitle="Your plan and connections" action={<span className="w-11" />} />
      <Page>
        {loading || !settings ? <Spinner /> : (
          <>
            {/* Operated side */}
            <section className="card p-4">
              <h2 className="font-bold text-sm">Which knee was operated on?</h2>
              <p className="mt-1 text-xs text-ink-500 leading-relaxed">
                Single-leg exercises are logged per side. Telling the app which leg is the
                rehab one lets it chart how the gap is closing.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(['left', 'right'] as const).map(side => (
                  <button key={side} onClick={() => patch({ operated_side: side })}
                    className={`rounded-xl h-12 text-sm font-semibold border transition active:scale-95 ${
                      settings.operated_side === side
                        ? 'bg-mint-500 text-ink-950 border-mint-500'
                        : 'bg-ink-850 border-ink-700 text-ink-500'
                    }`}>{side === 'left' ? 'Left' : 'Right'}</button>
                ))}
              </div>
              <div className="mt-4">
                <span className="label">Surgery date <span className="normal-case font-normal text-ink-600">(optional)</span></span>
                <input type="date" className="field" value={settings.surgery_date ?? ''}
                  onChange={e => patch({ surgery_date: e.target.value || null })} />
              </div>
            </section>

            {/* Schedule */}
            <section className="card p-4">
              <h2 className="font-bold text-sm">Weekly schedule</h2>
              <p className="mt-1 text-xs text-ink-500 leading-relaxed">
                Tap a day to cycle through {strength.map(t => t.name).join(', ')} and off. The app
                keeps the next fortnight planned for you.
              </p>
              <div className="mt-3 grid grid-cols-7 gap-1.5">
                {DAYS.map(d => {
                  const tid = settings.schedule[d.n]
                  const t = strength.find(x => x.id === tid)
                  const letter = t ? t.name.replace(/[^AB]/g, '') || t.name[0] : null
                  return (
                    <button key={d.n} onClick={() => cycleDay(d.n)}
                      className={`rounded-lg py-2 border transition active:scale-95 ${
                        t ? 'bg-mint-500/15 border-mint-500/40' : 'bg-ink-850 border-ink-700'
                      }`}>
                      <span className="block text-[10px] font-semibold text-ink-500">{d.label}</span>
                      <span className={`block text-sm font-extrabold ${t ? 'text-mint-400' : 'text-ink-700'}`}>
                        {letter ?? '–'}
                      </span>
                    </button>
                  )
                })}
              </div>
              <button onClick={fillDiary} className="btn-ghost w-full h-11 mt-3 text-xs">Fill the diary now</button>
              {planned && <p className="mt-2 text-xs text-mint-400">{planned}</p>}
            </section>

            <StravaCard />

            {/* Physio report */}
            <Link to="/report" className="card p-4 flex items-center justify-between gap-3 active:scale-[.99] transition">
              <div>
                <h2 className="font-bold text-sm">Summary for your physio</h2>
                <p className="text-xs text-ink-500 mt-0.5">Loading, pain, swelling and symmetry over time</p>
              </div>
              <span className="text-mint-400" aria-hidden>→</span>
            </Link>

            {/* The plan */}
            <section>
              <h2 className="label">Your physio plan</h2>
              <div className="space-y-3">
                {templates.map(t => (
                  <div key={t.id} className="card p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-bold">{t.name}</h3>
                      <span className="text-[11px] text-ink-600">{BLOCK_LABEL[t.kind === 'warmup' ? 'warmup' : 'main']}</span>
                    </div>
                    {t.description && <p className="text-xs text-ink-500 mt-0.5">{t.description}</p>}
                    <div className="mt-3 space-y-1.5">
                      {(detail[t.id] ?? []).map(te => (
                        <div key={te.id} className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="text-slate-300 truncate">
                            {te.exercises?.name}
                            {te.exercises?.unilateral && <span className="text-ink-600 text-xs"> · per side</span>}
                          </span>
                          <span className="text-ink-500 tabular-nums shrink-0 text-xs">
                            {te.target_sets} × {te.target_reps}{te.exercises?.unit === 'seconds' ? 's' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                    {t.include_warmup && (
                      <p className="mt-3 pt-3 border-t border-ink-800 text-[11px] text-ink-600">
                        The warm up is added automatically when you plan this session.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="card p-4">
              <h2 className="font-bold text-sm">Add to your home screen</h2>
              <p className="mt-1.5 text-xs text-ink-500 leading-relaxed">
                On iPhone: tap Share, then <strong className="text-slate-300">Add to Home Screen</strong>. It opens
                full screen, keeps the screen awake during a workout, and works without signal.
              </p>
            </section>

            <p className="text-center text-[11px] text-ink-600 pb-4">
              Knee Rehab · built from your 6 Aug plan
            </p>
          </>
        )}
      </Page>
    </>
  )
}
