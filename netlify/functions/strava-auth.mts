import { CLIENT_ID, siteUrl, stravaConfigured } from './_strava.mts'

/** Kick off the OAuth dance. */
export default async function handler(req: Request): Promise<Response> {
  if (!stravaConfigured) {
    return new Response('Strava API credentials are not configured on this site.', { status: 503 })
  }
  const redirectUri = `${siteUrl(req)}/api/strava/callback`
  const url = new URL('https://www.strava.com/oauth/authorize')
  url.searchParams.set('client_id', CLIENT_ID)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('approval_prompt', 'auto')
  url.searchParams.set('scope', 'read,activity:read_all')
  return Response.redirect(url.toString(), 302)
}
