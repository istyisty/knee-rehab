import { admin, getTokens, json } from './_strava.mts'

export default async function handler(): Promise<Response> {
  try {
    const db = admin()
    const row = await getTokens(db)
    // Best effort: tell Strava too, so the app disappears from the athlete's settings.
    if (row?.access_token) {
      await fetch('https://www.strava.com/oauth/deauthorize', {
        method: 'POST',
        headers: { authorization: `Bearer ${row.access_token}` },
      }).catch(() => {})
    }
    await db.from('strava_tokens').delete().eq('id', 1)
    return json({ ok: true })
  } catch (e: any) {
    return json({ error: e.message }, 500)
  }
}
