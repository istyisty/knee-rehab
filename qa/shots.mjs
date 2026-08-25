import { chromium } from 'playwright'
import * as F from './fixtures.mjs'
import fs from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:4173'
fs.mkdirSync('qa/shots', { recursive: true })

function respond(route, body) {
  return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/*' }, body: JSON.stringify(body) })
}

async function mock(page) {
  await page.route('**/rest/v1/**', async route => {
    const req = route.request()
    const url = new URL(req.url())
    const table = url.pathname.split('/rest/v1/')[1]
    const select = url.searchParams.get('select') ?? ''

    if (req.method() !== 'GET') return respond(route, {})

    if (table === 'app_settings') return respond(route, F.settings)
    if (table === 'exercises') return respond(route, F.exercises)
    if (table === 'workout_templates') return respond(route, F.templates)
    if (table === 'template_exercises') {
      const tid = (url.searchParams.get('template_id') ?? '').replace('eq.', '')
      const pick = tid === 't0' ? ['e1', 'e2', 'e3'] : tid === 't1' ? ['e4','e5','e6','e7','e8','e9','e10'] : ['e4','e5','e6']
      return respond(route, pick.map((exId, i) => ({
        id: `te-${tid}-${i}`, template_id: tid, exercise_id: exId,
        target_sets: 3, target_reps: 8, sort_order: i,
        exercises: F.exercises.find(e => e.id === exId),
      })))
    }
    if (table === 'workout_sessions') {
      if (select.includes('session_exercises')) {
        const id = (url.searchParams.get('id') ?? '').replace('eq.', '')
        return respond(route, id === 's3' ? F.completedDetail : F.sessionDetail)
      }
      return respond(route, F.sessions)
    }
    if (table === 'runs') return respond(route, F.runs)
    if (table === 'session_exercises') {
      if (select.includes('unilateral')) return respond(route, F.symmetryRows)
      if (select.includes('target_sets')) {
        // last-performance lookup
        return respond(route, [{
          id: 'lp1', exercise_id: 'e7', target_sets: 4, target_reps: 8,
          session_sets: [
            { side: 'left', reps: 8, weight: 10, completed: true, target_reps: 8 },
            { side: 'left', reps: 8, weight: 10, completed: true, target_reps: 8 },
            { side: 'right', reps: 8, weight: 10, completed: true, target_reps: 8 },
            { side: 'right', reps: 8, weight: 10, completed: true, target_reps: 8 },
          ],
          workout_sessions: { id: 's9', scheduled_date: '2026-08-19', status: 'completed', knee_pain: 2 },
        }])
      }
      // progress history
      return respond(route, [
        { id: 'h1', exercise_id: 'e7', name: 'Bulgarian Split Squat', unilateral: true, session_sets: [{ side: 'left', reps: 8, weight: 12.5, completed: true }, { side: 'right', reps: 8, weight: 10, completed: true }], workout_sessions: { scheduled_date: '2026-07-20', status: 'completed' } },
        { id: 'h2', exercise_id: 'e7', name: 'Bulgarian Split Squat', unilateral: true, session_sets: [{ side: 'left', reps: 8, weight: 15, completed: true }, { side: 'right', reps: 8, weight: 12.5, completed: true }], workout_sessions: { scheduled_date: '2026-07-29', status: 'completed' } },
        { id: 'h3', exercise_id: 'e7', name: 'Bulgarian Split Squat', unilateral: true, session_sets: [{ side: 'left', reps: 8, weight: 17.5, completed: true }, { side: 'right', reps: 8, weight: 15, completed: true }], workout_sessions: { scheduled_date: '2026-08-08', status: 'completed' } },
        { id: 'h4', exercise_id: 'e7', name: 'Bulgarian Split Squat', unilateral: true, session_sets: [{ side: 'left', reps: 8, weight: 20, completed: true }, { side: 'right', reps: 8, weight: 17.5, completed: true }], workout_sessions: { scheduled_date: '2026-08-19', status: 'completed' } },
      ])
    }
    if (table === 'session_sets') return respond(route, [])
    return respond(route, [])
  })
  await page.route('**/api/strava/**', route => {
    if (route.request().url().endsWith('/status')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configured: false, connected: false }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
}

const errors = []
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push(String(e)))
await mock(page)

const shot = async (path, name, prep) => {
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  if (prep) await prep()
  await page.screenshot({ path: `qa/shots/${name}.png`, fullPage: true })
  console.log('shot', name)
}

await shot('/', 'home')
await shot('/history', 'history')
await shot('/runs', 'runs')
await shot('/progress', 'progress')
await shot('/session/s1', 'session-active')
await shot('/session/s3', 'session-done')
await shot('/settings', 'settings')
await shot('/report', 'report')
await shot('/', 'sheet-plan', async () => {
  await page.getByRole('button', { name: /Plan workout/i }).first().click()
  await page.waitForTimeout(400)
})
await shot('/', 'sheet-run', async () => {
  await page.getByRole('button', { name: /Log a run/i }).first().click()
  await page.waitForTimeout(400)
})
await shot('/session/s1', 'sheet-finish', async () => {
  await page.getByRole('button', { name: /Finish workout/i }).click()
  await page.waitForTimeout(400)
})

console.log('\nCONSOLE ERRORS:', errors.length ? errors : 'none')
await browser.close()
