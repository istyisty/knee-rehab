import { admin, freshAccessToken, json, saveTokens, stravaConfigured } from './_strava.mts'

const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun'])

/**
 * Pull recent running activities into the runs table.
 * Existing rows are updated in place so your own knee-pain score, rating and
 * notes survive a re-sync — only the objective metrics are overwritten.
 */
export default async function handler(): Promise<Response> {
  if (!stravaConfigured) return json({ error: 'Strava is not configured' }, 503)

  try {
    const db = admin()
    const token = await freshAccessToken(db)

    const res = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=100', {
      headers: { authorization: `Bearer ${token}` },
    })
    const activities = await res.json()
    if (!res.ok) return json({ error: activities.message ?? 'Strava rejected the request' }, 502)

    const runs = (activities as any[]).filter(a => RUN_TYPES.has(a.type) || RUN_TYPES.has(a.sport_type))

    const { data: existing } = await db
      .from('runs').select('id, strava_activity_id').not('strava_activity_id', 'is', null)
    const known = new Map<number, string>((existing ?? []).map((r: any) => [Number(r.strava_activity_id), r.id]))

    let imported = 0
    let updated = 0

    for (const a of runs) {
      const metrics = {
        date: String(a.start_date_local).slice(0, 10),
        name: a.name ?? null,
        distance_m: a.distance ?? null,
        moving_time_s: a.moving_time ?? null,
        elapsed_time_s: a.elapsed_time ?? null,
        elevation_gain_m: a.total_elevation_gain ?? null,
        average_heartrate: a.average_heartrate ?? null,
        max_heartrate: a.max_heartrate ?? null,
      }
      const id = known.get(Number(a.id))
      if (id) {
        await db.from('runs').update(metrics).eq('id', id)
        updated++
      } else {
        await db.from('runs').insert({ ...metrics, source: 'strava', strava_activity_id: a.id })
        imported++
      }
    }

    await saveTokens(db, { last_synced_at: new Date().toISOString() })
    return json({ imported, updated, scanned: (activities as any[]).length })
  } catch (e: any) {
    return json({ error: e.message ?? 'Sync failed' }, 500)
  }
}
