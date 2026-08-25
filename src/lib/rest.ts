/**
 * Rest timer state, kept outside React so ticking a set anywhere in the
 * workout can start it and the pinned bar can render it.
 */

const listeners = new Set<(s: RestState) => void>()

export interface RestState {
  running: boolean
  remaining: number
  duration: number
}

let deadline: number | null = null
let duration = 90
let remaining = 0
let ticker: ReturnType<typeof setInterval> | null = null

const PREF_KEY = 'kr.restSeconds'

export function preferredRest(): number {
  const raw = Number(localStorage.getItem(PREF_KEY))
  return Number.isFinite(raw) && raw > 0 ? raw : 90
}

export function setPreferredRest(s: number) {
  try { localStorage.setItem(PREF_KEY, String(s)) } catch { /* ignore */ }
}

function emit() {
  const state: RestState = { running: deadline != null, remaining, duration }
  listeners.forEach(fn => fn(state))
}

export function subscribeRest(fn: (s: RestState) => void): () => void {
  listeners.add(fn)
  fn({ running: deadline != null, remaining, duration })
  return () => { listeners.delete(fn) }
}

function chime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const now = ctx.currentTime
    ;[0, 0.22, 0.44].forEach((offset, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = i === 2 ? 1046 : 784
      gain.gain.setValueAtTime(0.0001, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.35, now + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + offset)
      osc.stop(now + offset + 0.2)
    })
    setTimeout(() => ctx.close(), 1200)
  } catch { /* audio is a nicety, never a blocker */ }
  if (navigator.vibrate) navigator.vibrate([180, 90, 180])
}

function tick() {
  if (deadline == null) return
  // Anchored to wall clock, so a locked screen doesn't drift the countdown.
  remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000))
  if (remaining === 0) {
    deadline = null
    if (ticker) { clearInterval(ticker); ticker = null }
    chime()
  }
  emit()
}

export function startRest(seconds = preferredRest()) {
  duration = seconds
  remaining = seconds
  deadline = Date.now() + seconds * 1000
  if (ticker) clearInterval(ticker)
  ticker = setInterval(tick, 250)
  emit()
}

export function extendRest(seconds: number) {
  if (deadline == null) return startRest(seconds)
  deadline += seconds * 1000
  duration += seconds
  tick()
}

export function stopRest() {
  deadline = null
  remaining = 0
  if (ticker) { clearInterval(ticker); ticker = null }
  emit()
}
