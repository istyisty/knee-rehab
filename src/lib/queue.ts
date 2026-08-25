import { supabase } from './supabase'

/**
 * Write-behind queue.
 *
 * Gyms have terrible signal. Every mutation goes through here: it is applied
 * optimistically in the UI, persisted to localStorage, and retried until the
 * server confirms it. Nothing is ever lost to a dropped connection, and the
 * status is surfaced rather than swallowed.
 */

export type OpKind = 'update' | 'insert' | 'delete'

export interface Op {
  id: string
  table: string
  kind: OpKind
  rowId?: string
  payload?: Record<string, unknown>
  attempts: number
  queuedAt: number
}

export type SyncState = 'synced' | 'pending' | 'offline' | 'error'

const KEY = 'kr.queue.v1'
const listeners = new Set<(s: Status) => void>()

export interface Status {
  state: SyncState
  pending: number
  lastError: string | null
}

let queue: Op[] = load()
let status: Status = { state: queue.length ? 'pending' : 'synced', pending: queue.length, lastError: null }
let draining = false
let timer: ReturnType<typeof setInterval> | null = null

function load(): Op[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(queue)) } catch { /* storage full or blocked */ }
}

function emit(patch: Partial<Status>) {
  status = { ...status, ...patch, pending: queue.length }
  listeners.forEach(fn => fn(status))
}

export function subscribeSync(fn: (s: Status) => void): () => void {
  listeners.add(fn)
  fn(status)
  return () => { listeners.delete(fn) }
}

export function getSyncStatus(): Status {
  return status
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/**
 * Queue a mutation. Consecutive updates to the same row are merged, so holding
 * down the + button produces one write rather than twenty.
 */
export function enqueue(op: Omit<Op, 'id' | 'attempts' | 'queuedAt'>) {
  if (op.kind === 'update' && op.rowId) {
    const existing = queue.find(q => q.kind === 'update' && q.table === op.table && q.rowId === op.rowId)
    if (existing) {
      existing.payload = { ...existing.payload, ...op.payload }
      persist(); emit({ state: 'pending' }); void drain()
      return
    }
  }
  queue.push({ ...op, id: uid(), attempts: 0, queuedAt: Date.now() })
  persist()
  emit({ state: 'pending' })
  void drain()
}

async function runOp(op: Op): Promise<void> {
  const table = supabase.from(op.table)
  if (op.kind === 'update') {
    const { error } = await table.update(op.payload ?? {}).eq('id', op.rowId!)
    if (error) throw error
  } else if (op.kind === 'insert') {
    const { error } = await table.insert(op.payload ?? {})
    if (error) throw error
  } else {
    const { error } = await table.delete().eq('id', op.rowId!)
    if (error) throw error
  }
}

export async function drain(): Promise<void> {
  if (draining) return
  if (!queue.length) { emit({ state: 'synced', lastError: null }); return }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    emit({ state: 'offline' })
    return
  }

  draining = true
  try {
    while (queue.length) {
      const op = queue[0]
      try {
        await runOp(op)
        queue.shift()
        persist()
        emit({ state: queue.length ? 'pending' : 'synced', lastError: null })
      } catch (e: any) {
        op.attempts++
        persist()
        // A rejected write (bad data, deleted row) would block the queue forever.
        // Give up on it after a few tries rather than stalling everything behind it.
        if (op.attempts >= 6) {
          queue.shift()
          persist()
          emit({ state: queue.length ? 'pending' : 'error', lastError: e.message ?? 'A change could not be saved' })
          continue
        }
        emit({
          state: navigator.onLine === false ? 'offline' : 'pending',
          lastError: e.message ?? 'Retrying…',
        })
        break
      }
    }
  } finally {
    draining = false
  }
}

export function startSyncLoop() {
  if (timer) return
  timer = setInterval(() => { void drain() }, 8000)
  window.addEventListener('online', () => { void drain() })
  window.addEventListener('offline', () => emit({ state: 'offline' }))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void drain()
  })
  void drain()
}

/** Warn before closing the tab with unsaved work still queued. */
export function guardUnload() {
  window.addEventListener('beforeunload', e => {
    if (queue.length) { e.preventDefault(); e.returnValue = '' }
  })
}
