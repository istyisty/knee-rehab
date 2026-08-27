export const BLOCK_LABEL: Record<string, string> = {
  warmup: 'Warm Up',
  plyo: 'Plyometrics',
  main: 'Main',
  cooldown: 'Cool Down',
}

export const UNIT_LABEL: Record<string, string> = {
  reps: 'reps',
  seconds: 'secs',
  metres: 'metres',
}

export const WEEKDAY_LABELS: { n: string; label: string }[] = [
  { n: '1', label: 'Mon' }, { n: '2', label: 'Tue' }, { n: '3', label: 'Wed' },
  { n: '4', label: 'Thu' }, { n: '5', label: 'Fri' }, { n: '6', label: 'Sat' }, { n: '0', label: 'Sun' },
]

export function todayISO(): string {
  return toISO(new Date())
}

export function toISO(d: Date): string {
  const tzOffset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10)
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function prettyDate(iso: string): string {
  const d = fromISO(iso)
  const today = fromISO(todayISO())
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function longDate(iso: string): string {
  return fromISO(iso).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

/** "8" or "5-8", using an en dash so it reads as a range not a minus. */
export function fmtRepTarget(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null) return '-'
  if (max == null || max <= min) return String(min)
  return `${min}\u2013${max}`
}

export function fmtDuration(secs: number | null | undefined): string {
  if (secs == null) return '–'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function fmtDistance(metres: number | null | undefined): string {
  if (metres == null) return '–'
  return `${(metres / 1000).toFixed(2)} km`
}

export function fmtPace(metres: number | null | undefined, secs: number | null | undefined): string {
  if (!metres || !secs) return '–'
  const perKm = secs / (metres / 1000)
  const m = Math.floor(perKm / 60)
  const s = Math.round(perKm % 60)
  return `${m}:${String(s).padStart(2, '0')} /km`
}

export function fmtWeight(kg: number | null | undefined): string {
  if (kg == null) return ''
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(1)
}

/** Total load moved in a session, kg·reps. Bodyweight moves count as reps only. */
export function sessionVolume(sets: { reps: number | null; weight: number | null; completed: boolean }[]): number {
  return sets.filter(s => s.completed).reduce((t, s) => t + (s.reps ?? 0) * (s.weight ?? 0), 0)
}
