import { useEffect, useState } from 'react'
import { Sheet, Scale10, Stars } from './ui'
import { Stepper } from './Stepper'
import { deleteRun, saveRun } from '../lib/api'
import type { Run } from '../lib/types'
import { todayISO } from '../lib/format'

/** Manual run entry / editing. Distance in km and time in mm:ss, stored in SI. */
export function RunSheet({ open, onClose, onSaved, run }: {
  open: boolean; onClose: () => void; onSaved?: () => void; run?: Run | null
}) {
  const [date, setDate] = useState(todayISO())
  const [name, setName] = useState('')
  const [km, setKm] = useState<number | null>(null)
  const [mins, setMins] = useState<number | null>(null)
  const [secs, setSecs] = useState<number | null>(null)
  const [pain, setPain] = useState<number | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (run) {
      setDate(run.date)
      setName(run.name ?? '')
      setKm(run.distance_m == null ? null : Math.round((run.distance_m / 1000) * 100) / 100)
      const t = run.moving_time_s ?? 0
      setMins(t ? Math.floor(t / 60) : null)
      setSecs(t ? t % 60 : null)
      setPain(run.knee_pain)
      setRating(run.rating)
      setNotes(run.notes ?? '')
    } else {
      setDate(todayISO()); setName(''); setKm(null); setMins(null); setSecs(null)
      setPain(null); setRating(null); setNotes('')
    }
    setErr(null)
  }, [open, run])

  const totalSecs = (mins ?? 0) * 60 + (secs ?? 0)
  const pace = km && totalSecs
    ? (() => { const p = totalSecs / km; return `${Math.floor(p / 60)}:${String(Math.round(p % 60)).padStart(2, '0')} /km` })()
    : null

  const submit = async () => {
    setBusy(true); setErr(null)
    try {
      await saveRun({
        id: run?.id,
        date,
        source: run?.source ?? 'manual',
        name: name.trim() || null,
        distance_m: km == null ? null : Math.round(km * 1000),
        moving_time_s: totalSecs || null,
        knee_pain: pain,
        rating,
        notes: notes.trim() || null,
      })
      onSaved?.()
      onClose()
    } catch (e: any) {
      setErr(e.message ?? 'Could not save that run')
    } finally { setBusy(false) }
  }

  const remove = async () => {
    if (!run) return
    if (!window.confirm('Delete this run?')) return
    setBusy(true)
    try { await deleteRun(run.id); onSaved?.(); onClose() }
    catch (e: any) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <Sheet open={open} onClose={onClose} title={run ? 'Edit run' : 'Log a run'}>
      <div className="space-y-4">
        {run?.source === 'strava' && (
          <p className="text-xs text-ink-500 bg-ink-850 border border-ink-700 rounded-xl px-3 py-2">
            Pulled from Strava. Distance and time will be overwritten on the next sync — knee pain, rating and notes are yours to keep.
          </p>
        )}

        <div>
          <span className="label">Date</span>
          <input type="date" className="field" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <div>
          <span className="label">Name <span className="normal-case font-normal text-ink-600">(optional)</span></span>
          <input className="field" placeholder="Easy loop round the park" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="label">Distance (km)</span>
            <Stepper value={km} onChange={setKm} step={0.5} placeholder="0" />
          </div>
          <div>
            <span className="label">Time</span>
            <div className="grid grid-cols-2 gap-1.5">
              <Stepper value={mins} onChange={setMins} step={1} suffix="m" placeholder="0" />
              <Stepper value={secs} onChange={setSecs} step={5} min={0} max={59} suffix="s" placeholder="0" />
            </div>
          </div>
        </div>

        {pace && (
          <p className="text-center text-sm font-semibold text-mint-400 tabular-nums">{pace}</p>
        )}

        <div>
          <span className="label">Knee pain during / after</span>
          <Scale10 value={pain} onChange={setPain} />
          <div className="flex justify-between mt-1 text-[10px] text-ink-600"><span>None</span><span>Worst</span></div>
        </div>

        <div>
          <span className="label">How did it feel</span>
          <Stars value={rating} onChange={setRating} />
        </div>

        <div>
          <span className="label">Notes</span>
          <textarea className="field min-h-[76px]" placeholder="Surface, terrain, anything the physio should know…"
            value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {err && <p className="text-sm text-rose-400">{err}</p>}

        <div className="flex gap-2">
          {run && <button onClick={remove} disabled={busy} className="btn-danger px-4 py-3">Delete</button>}
          <button onClick={submit} disabled={busy} className="btn-primary flex-1 py-3">
            {busy ? 'Saving…' : run ? 'Save changes' : 'Log run'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
