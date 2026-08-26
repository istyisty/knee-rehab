import { chromium } from 'playwright'
import * as F from './fixtures.mjs'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const errors = []; page.on('pageerror', e => errors.push(String(e)))
await page.route('**/rest/v1/**', route => {
  const url = new URL(route.request().url())
  const table = url.pathname.split('/rest/v1/')[1]
  const select = url.searchParams.get('select') ?? ''
  const body = table === 'app_settings' ? F.settings : table === 'exercises' ? F.exercises
    : table === 'workout_templates' ? F.templates
    : table === 'workout_sessions' ? (select.includes('session_exercises') ? F.completedDetail : F.sessions)
    : table === 'runs' ? F.runs : []
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
})
await page.route('**/api/strava/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":false,"connected":false}' }))

const iso = d => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10) }
await page.goto('http://localhost:4173/history', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)

// day → sheet → workout
await page.locator(`button[aria-label="${iso(-3)}"]`).click(); await page.waitForTimeout(400)
await page.getByText('Open workout').first().click(); await page.waitForTimeout(900)
console.log('after tapping through:', new URL(page.url()).pathname)

// back to history, tap a run day
await page.goto('http://localhost:4173/history', { waitUntil: 'networkidle' }); await page.waitForTimeout(700)
await page.locator(`button[aria-label="${iso(-4)}"]`).click().catch(() => {})
await page.waitForTimeout(400)
await page.screenshot({ path: 'qa/shots/cal-run-sheet.png' })
await page.getByText('Treadmill intervals').click()
await page.waitForTimeout(600)
const runSheet = await page.getByText('Edit run').count()
console.log('run day opens the run editor:', runSheet > 0)
await page.screenshot({ path: 'qa/shots/cal-run.png' })

// view preference remembered
await page.goto('http://localhost:4173/history', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
console.log('remembers calendar view:', await page.getByText('August 2026').count() > 0)
console.log('page errors:', errors.length ? errors : 'none')
await browser.close()
