import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface TokenRow {
  id: number
  access_token: string | null
  refresh_token: string | null
  expires_at: number | null
  athlete_id: number | null
  athlete_name: string | null
  last_synced_at: string | null
}

export const CLIENT_ID = process.env.STRAVA_CLIENT_ID ?? ''
export const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET ?? ''
export const stravaConfigured = Boolean(CLIENT_ID && CLIENT_SECRET)

/**
 * Service-role client. Strava tokens live in a table with RLS and no anon
 * policy, so only these functions can read or write them.
 */
export function admin(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service credentials are not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

export async function getTokens(db: SupabaseClient): Promise<TokenRow | null> {
  const { data } = await db.from('strava_tokens').select('*').eq('id', 1).maybeSingle()
  return (data as TokenRow) ?? null
}

export async function saveTokens(db: SupabaseClient, patch: Partial<TokenRow>) {
  await db.from('strava_tokens').upsert({ id: 1, ...patch }, { onConflict: 'id' })
}

/** Returns a valid access token, refreshing it first if it's within 5 minutes of expiry. */
export async function freshAccessToken(db: SupabaseClient): Promise<string> {
  const row = await getTokens(db)
  if (!row?.refresh_token) throw new Error('Strava is not connected')

  const stillGood = row.access_token && row.expires_at && row.expires_at - 300 > Math.floor(Date.now() / 1000)
  if (stillGood) return row.access_token!

  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token,
    }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.message ?? 'Could not refresh the Strava token')

  await saveTokens(db, {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: body.expires_at,
  })
  return body.access_token as string
}

export function siteUrl(req: Request): string {
  return process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? new URL(req.url).origin
}
