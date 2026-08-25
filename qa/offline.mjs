import { chromium } from 'playwright'
import * as F from './fixtures.mjs'

let blocked = true
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()

const writes = []
await page.route('**/rest/v1/**', async route => {
  const req = route.request()
  if (req.method() !== 'GET') {
    if (blocked) return route.abort('internetdisconnected')
    writes.push({ method: req.method(), url: req.url(), body: req.postData() })
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  }
  const url = new URL(req.url())
  const table = url.pathname.split('/rest/v1/')[1]
  const select = url.searchParams.get('select') ?? ''
  const body =
    table === 'app_settings' ? F.settings :
    table === 'exercises' ? F.exercises :
    table === 'workout_templates' ? F.templates :
    table === 'workout_sessions' ? (select.includes('session_exercises') ? F.sessionDetail : F.sessions) :
    table === 'runs' ? F.runs : []
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
})
await page.route('**/api/strava/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":false,"connected":false}' }))

await page.goto('http://localhost:4173/session/s1', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

// Tick three sets while writes are failing.
const ticks = page.getByRole('button', { name: 'Mark set complete' })
for (let i = 0; i < 3; i++) await ticks.nth(0).click({ timeout: 5000 }).catch(() => {})
await page.waitForTimeout(600)

const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('kr.queue.v1') ?? '[]').length)
const pill = await page.locator('header button:has-text("Saving"), header button:has-text("Offline")').count()
console.log('while offline → queued ops:', queued, '| status pill shown:', pill > 0)
await page.screenshot({ path: 'qa/shots/offline-pill.png' })

// Reconnect and let the queue drain.
blocked = false
await page.evaluate(() => window.dispatchEvent(new Event('online')))
await page.waitForTimeout(2500)

const after = await page.evaluate(() => JSON.parse(localStorage.getItem('kr.queue.v1') ?? '[]').length)
console.log('after reconnect → queued ops:', after, '| writes that reached the server:', writes.length)
console.log('sample write:', writes[0]?.method, (writes[0]?.body ?? '').slice(0, 120))

// The reload path: does the cached copy survive a dead connection?
await page.evaluate(() => localStorage.setItem('kr.__probe', '1'))
const cached = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('kr.cache.session.')).length)
console.log('cached session copies:', cached)

await browser.close()
