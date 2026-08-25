export interface StravaStatus {
  configured: boolean          // client id/secret present on the server
  connected: boolean           // we hold a valid token for an athlete
  athlete_name?: string | null
  last_synced_at?: string | null
  message?: string
}

export interface SyncResult {
  imported: number
  updated: number
  scanned: number
  error?: string
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/strava/${path}`, init)
  const text = await res.text()
  let body: any = {}
  try { body = text ? JSON.parse(text) : {} } catch { body = { error: text } }
  if (!res.ok) throw new Error(body.error || `Strava request failed (${res.status})`)
  return body as T
}

export const stravaStatus = () => call<StravaStatus>('status')
export const stravaSync = () => call<SyncResult>('sync', { method: 'POST' })
export const stravaDisconnect = () => call<{ ok: boolean }>('disconnect', { method: 'POST' })
export const stravaConnectUrl = '/api/strava/auth'
