/**
 * Small localStorage cache so a workout that was opened while online can still
 * be worked through in a basement gym with no signal.
 */

const PREFIX = 'kr.cache.'

export function cacheSet<T>(key: string, value: T) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), value })) }
  catch { /* nothing we can do, and nothing worth interrupting the user for */ }
}

export function cacheGet<T>(key: string, maxAgeMs = 1000 * 60 * 60 * 24 * 14): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const { at, value } = JSON.parse(raw)
    if (Date.now() - at > maxAgeMs) return null
    return value as T
  } catch { return null }
}

export function cacheDrop(key: string) {
  try { localStorage.removeItem(PREFIX + key) } catch { /* ignore */ }
}
