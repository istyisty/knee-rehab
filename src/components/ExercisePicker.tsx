import { useEffect, useMemo, useState } from 'react'
import { Sheet } from './ui'
import { Stepper } from './Stepper'
import { createExercise, getExercises } from '../lib/api'
import type { Block, Exercise, Unit } from '../lib/types'
import { BLOCK_LABEL, UNIT_LABEL } from '../lib/format'

const MUSCLES = ['quads', 'hamstrings', 'glutes', 'calves', 'chest', 'back', 'shoulders', 'arms', 'core', 'full body', 'cardio']
const EQUIPMENT = ['bodyweight', 'dumbbell', 'barbell', 'machine', 'cable', 'kettlebell', 'band', 'other']

/**
 * Library browser. Search and filters up top, and a fallback for the exercise
 * that isn't in the list — most people have one or two of those.
 */
export function ExercisePicker({ open, onClose, onPick, excludeIds = [] }: {
  open: boolean
  onClose: () => void
  onPick: (exercise: Exercise, sets: number, reps: number) => void
  excludeIds?: string[]
}) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)
  const [equipment, setEquipment] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [chosen, setChosen] = useState<Exercise | null>(null)

  useEffect(() => {
    if (!open) return
    setQuery(''); setMuscle(null); setEquipment(null); setCreating(false); setChosen(null)
    getExercises().then(setExercises).catch(() => {})
  }, [open])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return exercises
      .filter(e => !excludeIds.includes(e.id))
      .filter(e => !muscle || e.muscle_group === muscle)
      .filter(e => !equipment || e.equipment === equipment)
      .filter(e => !q || e.name.toLowerCase().includes(q) || (e.muscle_group ?? '').includes(q))
  }, [exercises, query, muscle, equipment, excludeIds])

  const grouped = useMemo(() => {
    const order: Block[] = ['warmup', 'plyo', 'main', 'cooldown']
    return order
      .map(block => ({ block, items: results.filter(e => e.block === block) }))
      .filter(g => g.items.length > 0)
  }, [results])

  // Guard before the sub-sheets: otherwise closing the picker from the parent
  // leaves the target sheet on screen with its backdrop swallowing every tap.
  if (!open) return null

  if (chosen) {
    return (
      <TargetSheet
        exercise={chosen}
        onBack={() => setChosen(null)}
        onConfirm={(sets, reps) => { onPick(chosen, sets, reps); setChosen(null); onClose() }}
      />
    )
  }

  if (creating) {
    return (
      <NewExerciseSheet
        onBack={() => setCreating(false)}
        onCreated={e => { setExercises(prev => [...prev, e].sort((a, b) => a.name.localeCompare(b.name))); setCreating(false); setChosen(e) }}
      />
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add an exercise">
      <div className="space-y-4">
        <input
          className="field"
          placeholder="Search the library…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        <div className="space-y-2">
          <FilterRow label="Muscle" options={MUSCLES} value={muscle} onChange={setMuscle} />
          <FilterRow label="Kit" options={EQUIPMENT} value={equipment} onChange={setEquipment} />
        </div>

        {grouped.length === 0 ? (
          <p className="text-sm text-ink-500 text-center py-6">
            Nothing matches. Try fewer filters, or add it yourself below.
          </p>
        ) : grouped.map(({ block, items }) => (
          <section key={block}>
            <h3 className="label">{BLOCK_LABEL[block]}</h3>
            <div className="space-y-1.5">
              {items.map(e => (
                <button
                  key={e.id}
                  onClick={() => setChosen(e)}
                  className="w-full text-left rounded-xl bg-ink-850 border border-ink-700 px-3 py-2.5 active:scale-[.99] transition"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold text-sm truncate">{e.name}</span>
                    <span className="text-[10px] text-ink-600 shrink-0 uppercase tracking-wide">{e.equipment}</span>
                  </div>
                  <p className="text-[11px] text-ink-500 mt-0.5">
                    {e.muscle_group}
                    {e.unilateral && ' · per side'}
                    {!e.loadable && ' · bodyweight'}
                    {e.unit !== 'reps' && ` · ${UNIT_LABEL[e.unit]}`}
                  </p>
                </button>
              ))}
            </div>
          </section>
        ))}

        <button onClick={() => setCreating(true)} className="btn-ghost w-full py-3 text-sm">
          + Add an exercise that isn't listed
        </button>
      </div>
    </Sheet>
  )
}

function FilterRow({ label, options, value, onChange }: {
  label: string; options: string[]; value: string | null; onChange: (v: string | null) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="label mb-0 w-14 shrink-0">{label}</span>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1 py-0.5">
        {options.map(o => (
          <button
            key={o}
            onClick={() => onChange(value === o ? null : o)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold border capitalize transition ${
              value === o ? 'bg-mint-500 text-ink-950 border-mint-500' : 'bg-ink-850 border-ink-700 text-ink-500'
            }`}
          >{o}</button>
        ))}
      </div>
    </div>
  )
}

/** Sets and reps for the exercise just chosen, prefilled from its defaults. */
function TargetSheet({ exercise, onBack, onConfirm }: {
  exercise: Exercise; onBack: () => void; onConfirm: (sets: number, reps: number) => void
}) {
  const [sets, setSets] = useState<number | null>(exercise.default_sets)
  const [reps, setReps] = useState<number | null>(exercise.default_reps)

  return (
    <Sheet open onClose={onBack} title={exercise.name}>
      <div className="space-y-5">
        {exercise.cue && <p className="text-sm text-ink-500 leading-relaxed">{exercise.cue}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="label">Sets</span>
            <Stepper value={sets} onChange={setSets} min={1} />
          </div>
          <div>
            <span className="label">{UNIT_LABEL[exercise.unit]}{exercise.unilateral ? ' / side' : ''}</span>
            <Stepper value={reps} onChange={setReps} min={1} step={exercise.unit === 'metres' ? 100 : 1} />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onBack} className="btn-ghost px-4 py-3">Back</button>
          <button
            onClick={() => onConfirm(sets ?? 3, reps ?? 10)}
            className="btn-primary flex-1 py-3"
          >Add to workout</button>
        </div>
      </div>
    </Sheet>
  )
}

const BLOCKS: Block[] = ['warmup', 'plyo', 'main', 'cooldown']
const UNITS: Unit[] = ['reps', 'seconds', 'metres']

function NewExerciseSheet({ onBack, onCreated }: {
  onBack: () => void; onCreated: (e: Exercise) => void
}) {
  const [name, setName] = useState('')
  const [block, setBlock] = useState<Block>('main')
  const [unit, setUnit] = useState<Unit>('reps')
  const [muscle, setMuscle] = useState<string>('full body')
  const [equipment, setEquipment] = useState<string>('bodyweight')
  const [unilateral, setUnilateral] = useState(false)
  const [loadable, setLoadable] = useState(true)
  const [cue, setCue] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    if (!name.trim()) { setErr('Give it a name first'); return }
    setBusy(true); setErr(null)
    try {
      onCreated(await createExercise({
        name, block, unit, muscle_group: muscle, equipment, unilateral, loadable, cue,
      }))
    } catch (e: any) {
      setErr(e.message?.includes('duplicate') ? 'An exercise with that name already exists' : e.message)
    } finally { setBusy(false) }
  }

  return (
    <Sheet open onClose={onBack} title="New exercise">
      <div className="space-y-4">
        <div>
          <span className="label">Name</span>
          <input className="field" value={name} onChange={e => setName(e.target.value)} placeholder="Zercher squat" />
        </div>

        <div>
          <span className="label">Part of the workout</span>
          <div className="grid grid-cols-4 gap-1.5">
            {BLOCKS.map(b => (
              <button key={b} onClick={() => setBlock(b)}
                className={`rounded-lg h-11 text-[11px] font-semibold border transition ${
                  block === b ? 'bg-mint-500 text-ink-950 border-mint-500' : 'bg-ink-850 border-ink-700 text-ink-500'
                }`}>{BLOCK_LABEL[b]}</button>
            ))}
          </div>
        </div>

        <div>
          <span className="label">Measured in</span>
          <div className="grid grid-cols-3 gap-1.5">
            {UNITS.map(u => (
              <button key={u} onClick={() => setUnit(u)}
                className={`rounded-lg h-11 text-xs font-semibold border capitalize transition ${
                  unit === u ? 'bg-mint-500 text-ink-950 border-mint-500' : 'bg-ink-850 border-ink-700 text-ink-500'
                }`}>{UNIT_LABEL[u]}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="label">Muscle</span>
            <select className="field capitalize" value={muscle} onChange={e => setMuscle(e.target.value)}>
              {MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <span className="label">Kit</span>
            <select className="field capitalize" value={equipment} onChange={e => setEquipment(e.target.value)}>
              {EQUIPMENT.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Toggle checked={unilateral} onChange={setUnilateral}
            label="One side at a time" hint="Logs left and right separately" />
          <Toggle checked={loadable} onChange={setLoadable}
            label="Can be loaded" hint="Shows a weight column" />
        </div>

        <div>
          <span className="label">Cue <span className="normal-case font-normal text-ink-600">(optional)</span></span>
          <input className="field" value={cue} onChange={e => setCue(e.target.value)} placeholder="What to remember mid-set" />
        </div>

        {err && <p className="text-sm text-rose-400">{err}</p>}

        <div className="flex gap-2">
          <button onClick={onBack} className="btn-ghost px-4 py-3">Back</button>
          <button onClick={save} disabled={busy} className="btn-primary flex-1 py-3">
            {busy ? 'Saving…' : 'Create exercise'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}

export function Toggle({ checked, onChange, label, hint }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-3 rounded-xl bg-ink-850 border border-ink-700 px-3 py-3 text-left active:scale-[.99] transition"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-[11px] text-ink-500">{hint}</span>}
      </span>
      <span className={`w-11 h-6 rounded-full shrink-0 transition relative ${checked ? 'bg-mint-500' : 'bg-ink-700'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  )
}
