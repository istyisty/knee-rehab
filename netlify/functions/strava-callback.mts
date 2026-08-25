import { CLIENT_ID, CLIENT_SECRET, admin, saveTokens, siteUrl } from './_strava.mts'

/** Exchange the one-time code for tokens and stash them server side. */
export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const site = siteUrl(req)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error || !code) return Response.redirect(`${site}/runs?strava=denied`, 302)

  try {
    const res = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.message ?? 'Token exchange failed')

    const athlete = body.athlete ?? {}
    await saveTokens(admin(), {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      expires_at: body.expires_at,
      athlete_id: athlete.id ?? null,
      athlete_name: [athlete.firstname, athlete.lastname].filter(Boolean).join(' ') || null,
    })
    return Response.redirect(`${site}/runs?strava=connected`, 302)
  } catch {
    return Response.redirect(`${site}/runs?strava=failed`, 302)
  }
}
