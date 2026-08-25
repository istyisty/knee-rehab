import { useSyncStatus } from '../lib/hooks'
import { drain } from '../lib/queue'

/**
 * Honest save status. Silence would be worse: a whole session logged into a
 * dead connection used to look identical to one that saved.
 */
export function SyncPill() {
  const { state, pending, lastError } = useSyncStatus()
  if (state === 'synced') return null

  const map = {
    pending: { text: pending > 1 ? `Saving ${pending}` : 'Saving', tone: 'bg-ink-800 text-slate-400 border-ink-700' },
    offline: { text: pending ? `Offline · ${pending} queued` : 'Offline', tone: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    error: { text: 'Save failed', tone: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
    synced: { text: '', tone: '' },
  }[state]

  return (
    <button
      onClick={() => void drain()}
      title={lastError ?? undefined}
      className={`chip border ${map.tone} shrink-0`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${state === 'pending' ? 'bg-slate-400 animate-pulse' : state === 'offline' ? 'bg-amber-400' : 'bg-rose-400'}`} />
      {map.text}
    </button>
  )
}
