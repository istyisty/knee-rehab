import { useState } from 'react'
import { rescheduleSession, updateSession } from '../lib/api'
import { todayISO } from '../lib/format'
import type { WorkoutSession } from '../lib/types'

/**
 * A planned workout whose date has passed shouldn't just sit there looking
 * accusatory — offer the two things you'd actually want to do with it.
 */
export function OverdueActions({ session, onDone }: { session: WorkoutSession; onDone: () => void }) {
  const [busy, setBusy] = useState(false)

  const move = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    setBusy(true)
    await rescheduleSession(session.id, todayISO())
    onDone()
  }

  const skip = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    setBusy(true)
    await updateSession(session.id, { status: 'skipped' })
    onDone()
  }

  return (
    <div className="flex gap-2 mt-3 pt-3 border-t border-ink-800">
      <button onClick={move} disabled={busy} className="btn-ghost flex-1 h-11 text-xs">Move to today</button>
      <button onClick={skip} disabled={busy} className="btn-ghost px-4 h-11 text-xs text-ink-500">Skip it</button>
    </div>
  )
}
