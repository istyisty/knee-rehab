import { chromium } from 'playwright'
import * as F from './fixtures.mjs'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e)))

await page.route('**/rest/v1/**', route => {
  const url = new URL(route.request().url())
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

await page.goto('http://localhost:4173/history', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.screenshot({ path: 'qa/shots/cal-month.png' })
console.log('shot cal-month')

// A day that has both a completed session and a run: yesterday has a Strava run.
const iso = d => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10) }
await page.locator(`button[aria-label="${iso(-3)}"]`).click()
await page.waitForTimeout(500)
await page.screenshot({ path: 'qa/shots/cal-day.png' })
console.log('shot cal-day')

await page.keyboard.press('Escape').catch(() => {})
await page.locator('button[aria-label="Close"]').click().catch(() => {})
await page.waitForTimeout(300)

// Previous month should be empty but navigable.
await page.locator('button[aria-label="Previous month"]').click()
await page.waitForTimeout(400)
await page.locator('button[aria-label="Previous month"]').click()
await page.waitForTimeout(400)
await page.screenshot({ path: 'qa/shots/cal-prev.png' })
console.log('shot cal-prev')

console.log('page errors:', errors.length ? errors : 'none')
await browser.close()
