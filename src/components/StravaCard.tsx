import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { stravaConnectUrl, stravaDisconnect, stravaStatus, stravaSync, type StravaStatus } from '../lib/strava'

/** Connect / sync panel. Degrades to a clear "not set up yet" state before the
 *  Strava API credentials are added to the Netlify environment. */
export function StravaCard({ onSynced }: { onSynced?: () => void }) {
  const [status, setStatus] = useState<StravaStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()

  const refresh = () => stravaStatus().then(setStatus).catch(() => setStatus({ configured: false, connected: false }))

  useEffect(() => { refresh() }, [])

  // Bounced back from the OAuth callback
  useEffect(() => {
    const s = params.get('strava')
    if (!s) return
    setMsg(s === 'connected' ? 'Strava connected.' : s === 'denied' ? 'Strava access was declined.' : 'Strava connection failed.')
    params.delete('strava'); setParams(params, { replace: true })
    refresh()
    if (s === 'connected') sync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sync = async () => {
    setBusy(true); setMsg(null)
    try {
      const r = await stravaSync()
      setMsg(r.imported || r.updated
        ? `${r.imported} new, ${r.updated} updated.`
        : `Up to date — nothing new in your last ${r.scanned} activities.`)
      onSynced?.()
      refresh()
    } catch (e: any) { setMsg(e.message) }
    finally { setBusy(false) }
  }

  const disconnect = async () => {
    if (!window.confirm('Disconnect Strava? Runs already imported stay put.')) return
    setBusy(true)
    try { await stravaDisconnect(); setMsg('Disconnected.'); refresh() }
    catch (e: any) { setMsg(e.message) }
    finally { setBusy(false) }
  }

  if (!status) return null

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-[#fc4c02] grid place-items-center">
          <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10.47 0 3.5 13.83h4.17L10.47 8.3l2.8 5.53h4.15L10.47 0Z" />
            <path d="M15.39 17.94 13.3 13.83h-3.07l5.16 10.17 5.15-10.17h-3.06l-2.09 4.11Z" opacity=".6" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm">Strava</p>
          <p className="text-xs text-ink-500 truncate">
            {!status.configured ? 'Not set up yet'
              : status.connected ? `Connected${status.athlete_name ? ` as ${status.athlete_name}` : ''}`
              : 'Ready to connect'}
          </p>
        </div>
        {status.configured && (
          status.connected ? (
            <button onClick={sync} disabled={busy} className="btn-primary px-4 py-2 text-xs">
              {busy ? 'Syncing…' : 'Sync'}
            </button>
          ) : (
            <a href={stravaConnectUrl} className="btn-primary px-4 py-2 text-xs">Connect</a>
          )
        )}
      </div>

      {!status.configured && (
        <p className="mt-3 text-xs text-ink-500 leading-relaxed">
          Add <code className="text-mint-400">STRAVA_CLIENT_ID</code> and <code className="text-mint-400">STRAVA_CLIENT_SECRET</code>{' '}
          in your Netlify environment variables, redeploy, and the Connect button appears here.
        </p>
      )}

      {msg && <p className="mt-3 text-xs text-slate-300">{msg}</p>}

      {status.connected && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-ink-600">
            {status.last_synced_at ? `Last sync ${new Date(status.last_synced_at).toLocaleString()}` : 'Never synced'}
          </p>
          <button onClick={disconnect} className="text-[11px] font-semibold text-ink-500 underline">Disconnect</button>
        </div>
      )}
    </div>
  )
}
