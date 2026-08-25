import { useEffect, useState } from 'react'
import { subscribeRest, type RestState } from './rest'
import { subscribeSync, type Status } from './queue'

/**
 * Hold the screen awake while a workout is in progress. Re-acquires after the
 * phone is unlocked, because the lock is dropped whenever the tab is hidden.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const nav = navigator as any
    if (!nav.wakeLock?.request) return

    let sentinel: any = null
    let cancelled = false

    const acquire = async () => {
      try {
        if (document.visibilityState !== 'visible') return
        sentinel = await nav.wakeLock.request('screen')
        if (cancelled) { sentinel?.release?.(); sentinel = null }
      } catch { /* denied, low battery, or unsupported — not worth surfacing */ }
    }

    const onVisible = () => { if (document.visibilityState === 'visible') void acquire() }

    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      sentinel?.release?.().catch(() => {})
    }
  }, [active])
}

export function useRest(): RestState {
  const [state, setState] = useState<RestState>({ running: false, remaining: 0, duration: 90 })
  useEffect(() => subscribeRest(setState), [])
  return state
}

export function useSyncStatus(): Status {
  const [state, setState] = useState<Status>({ state: 'synced', pending: 0, lastError: null })
  useEffect(() => subscribeSync(setState), [])
  return state
}
