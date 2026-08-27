import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPrograms, getTemplates, planSession } from '../lib/api'
import type { Program, WorkoutTemplate } from '../lib/types'
import { Sheet } from './ui'
import { todayISO, toISO, prettyDate } from '../lib/format'

/** Pick a workout + a date, and materialise a planned session from the template. */
export function PlanSheet({ open, onClose, defaultDate, onPlanned }: {
  open: boolean; onClose: () => void; defaultDate?: string; onPlanned?: () => void
}) {
  const nav = useNavigate()
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [templateId, setTemplateId] = useState<string>('')
  const [date, setDate] = useState(defaultDate ?? todayISO())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { if (open) setDate(defaultDate ?? todayISO()) }, [open, defaultDate])

  useEffect(() => {
    if (!open) return
    Promise.all([getTemplates(), getPrograms()]).then(([t, p]) => {
      const strength = t.filter(x => x.kind === 'strength')
      setTemplates(strength)
      setPrograms(p)
      setTemplateId(prev => (prev && strength.some(x => x.id === prev)) ? prev : strength[0]?.id || '')
    }).catch(e => setErr(e.message))
  }, [open])

  const quickDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i); return toISO(d)
  })

  const submit = async (startNow: boolean) => {
    if (!templateId) return
    setBusy(true); setErr(null)
    try {
      const id = await planSession(templateId, date)
      onPlanned?.()
      onClose()
      if (startNow) nav(`/session/${id}?start=1`)
      else nav(`/session/${id}`)
    } catch (e: any) {
      setErr(e.message ?? 'Could not plan that workout')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Plan a workout">
      <div className="space-y-5">
        <div>
          <span className="label">Workout</span>
          {templates.length === 0 ? (
            <p className="text-sm text-ink-500 leading-relaxed">
              No workouts yet — build one in Settings → Programs and workouts.
            </p>
          ) : (
            <div className="space-y-4">
              {programs
                .filter(p => templates.some(t => t.program_id === p.id))
                .map(program => (
                  <section key={program.id}>
                    <h3 className="label">{program.name}</h3>
                    <div className="space-y-2">
                      {templates.filter(t => t.program_id === program.id).map(t => (
                        <TemplateOption key={t.id} template={t} selected={templateId === t.id}
                          onSelect={() => setTemplateId(t.id)} />
                      ))}
                    </div>
                  </section>
                ))}

              {templates.some(t => !t.program_id) && (
                <section>
                  <h3 className="label">Not in a program</h3>
                  <div className="space-y-2">
                    {templates.filter(t => !t.program_id).map(t => (
                      <TemplateOption key={t.id} template={t} selected={templateId === t.id}
                        onSelect={() => setTemplateId(t.id)} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        <div>
          <span className="label">Date</span>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-2">
            {quickDates.map(d => (
              <button
                key={d}
                onClick={() => setDate(d)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold border transition ${
                  date === d ? 'bg-mint-500 text-ink-950 border-mint-500' : 'bg-ink-850 border-ink-700 text-ink-500'
                }`}
              >{d === todayISO() ? 'Today' : prettyDate(d)}</button>
            ))}
          </div>
          <input type="date" className="field" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        {err && <p className="text-sm text-rose-400">{err}</p>}

        <div className="grid grid-cols-2 gap-2">
          <button className="btn-ghost py-3" disabled={busy} onClick={() => submit(false)}>Save for later</button>
          <button className="btn-primary py-3" disabled={busy || !templateId} onClick={() => submit(true)}>
            {busy ? 'Working…' : 'Start now'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}

function TemplateOption({ template, selected, onSelect }: {
  template: WorkoutTemplate; selected: boolean; onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl border px-4 py-3 transition active:scale-[.99] ${
        selected ? 'bg-mint-500/10 border-mint-500/40' : 'bg-ink-850 border-ink-700'
      }`}
    >
      <p className={`font-bold ${selected ? 'text-mint-400' : 'text-slate-200'}`}>{template.name}</p>
      {template.description && <p className="text-xs text-ink-500 mt-0.5">{template.description}</p>}
      {template.include_warmup && <p className="text-[11px] text-ink-500 mt-1">Includes the warm up</p>}
    </button>
  )
}
