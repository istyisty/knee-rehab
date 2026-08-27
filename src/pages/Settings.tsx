import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header, Page } from '../components/Header'
import { StravaCard } from '../components/StravaCard'
import { Spinner } from '../components/ui'
import { getPrograms, getSettings, saveSettings } from '../lib/api'
import type { AppSettings, Program } from '../lib/types'

export default function Settings() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getPrograms(), getSettings()]).then(([ps, st]) => {
      setPrograms(ps); setSettings(st); setLoading(false)
    })
  }, [])

  const patch = (p: Partial<AppSettings>) => {
    setSettings(prev => prev && { ...prev, ...p })
    saveSettings(p)
  }

  const anyRehab = programs.some(p => p.tracks_knee)

  return (
    <>
      <Header title="Settings" action={<span className="w-11" />} />
      <Page>
        {loading || !settings ? <Spinner /> : (
          <>
            <Link to="/programs" className="card p-4 flex items-center justify-between gap-3 active:scale-[.99] transition">
              <div className="min-w-0">
                <h2 className="font-bold text-sm">Programs and workouts</h2>
                <p className="text-xs text-ink-500 mt-0.5 truncate">
                  {programs.length === 0
                    ? 'Build your first program'
                    : programs.map(p => p.name).join(' · ')}
                </p>
              </div>
              <span className="text-mint-400 shrink-0" aria-hidden>→</span>
            </Link>

            {/* Only relevant while something is actually rehabbing. */}
            {anyRehab && (
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
            )}

            <StravaCard />

            <Link to="/report" className="card p-4 flex items-center justify-between gap-3 active:scale-[.99] transition">
              <div>
                <h2 className="font-bold text-sm">Summary for your physio</h2>
                <p className="text-xs text-ink-500 mt-0.5">Loading, pain, swelling and symmetry over time</p>
              </div>
              <span className="text-mint-400" aria-hidden>→</span>
            </Link>

            <section className="card p-4">
              <h2 className="font-bold text-sm">Add to your home screen</h2>
              <p className="mt-1.5 text-xs text-ink-500 leading-relaxed">
                On iPhone: tap Share, then <strong className="text-slate-300">Add to Home Screen</strong>. It opens
                full screen, keeps the screen awake during a workout, and works without signal.
              </p>
            </section>

            <p className="text-center text-[11px] text-ink-600 pb-4">Workout Manager</p>
          </>
        )}
      </Page>
    </>
  )
}
