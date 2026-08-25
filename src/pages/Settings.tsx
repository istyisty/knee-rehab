import { useEffect, useState } from 'react'
import { Header, Page } from '../components/Header'
import { StravaCard } from '../components/StravaCard'
import { Spinner } from '../components/ui'
import { getTemplateExercises, getTemplates } from '../lib/api'
import type { TemplateExercise, WorkoutTemplate } from '../lib/types'
import { BLOCK_LABEL } from '../lib/format'

export default function Settings() {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [detail, setDetail] = useState<Record<string, TemplateExercise[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTemplates().then(async ts => {
      setTemplates(ts)
      const entries = await Promise.all(ts.map(async t => [t.id, await getTemplateExercises(t.id)] as const))
      setDetail(Object.fromEntries(entries))
      setLoading(false)
    })
  }, [])

  return (
    <>
      <Header title="Settings" subtitle="Your plan and connections" action={<span className="w-10" />} />
      <Page>
        <StravaCard />

        <section>
          <h2 className="label">Your physio plan</h2>
          {loading ? <Spinner /> : (
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
                        <span className="text-slate-300 truncate">{te.exercises?.name}</span>
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
          )}
        </section>

        <section className="card p-4">
          <h2 className="font-bold text-sm">Add to your home screen</h2>
          <p className="mt-1.5 text-xs text-ink-500 leading-relaxed">
            On iPhone: tap Share, then <strong className="text-slate-300">Add to Home Screen</strong>. It opens
            full screen like a normal app and keeps you signed into the same data.
          </p>
        </section>

        <p className="text-center text-[11px] text-ink-600 pb-4">
          Knee Rehab · built from your 6 Aug plan
        </p>
      </Page>
    </>
  )
}
