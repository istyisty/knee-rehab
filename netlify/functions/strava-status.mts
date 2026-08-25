import { admin, getTokens, json, stravaConfigured } from './_strava.mts'

export default async function handler(): Promise<Response> {
  if (!stravaConfigured) {
    return json({ configured: false, connected: false, message: 'Strava API credentials are not set' })
  }
  try {
    const row = await getTokens(admin())
    return json({
      configured: true,
      connected: Boolean(row?.refresh_token),
      athlete_name: row?.athlete_name ?? null,
      last_synced_at: row?.last_synced_at ?? null,
    })
  } catch (e: any) {
    return json({ configured: true, connected: false, message: e.message }, 200)
  }
}
