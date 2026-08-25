import { chromium } from 'playwright'
import * as F from './fixtures.mjs'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
await page.route('**/rest/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(
  r.request().url().includes('workout_templates') ? F.templates :
  r.request().url().includes('session_exercises') ? F.sessionDetail :
  r.request().url().includes('workout_sessions') ? (r.request().url().includes('session_exercises') ? F.sessionDetail : F.sessions) :
  r.request().url().includes('runs') ? F.runs : F.exercises) }))
await page.route('**/api/strava/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":false,"connected":false}' }))

// Stand-in for the Netlify badge so the clearance can be judged honestly.
const badge = `<div style="position:fixed;right:0;bottom:0;z-index:2147483647;background:#111;color:#fff;font:600 11px system-ui;padding:8px 12px;border-radius:6px 0 0 0;opacity:.92">⬡ Powered by Netlify</div>`

for (const [path, name] of [['/', 'nav-home'], ['/session/s1', 'nav-session']]) {
  await page.goto('http://localhost:4173' + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.evaluate(html => document.body.insertAdjacentHTML('beforeend', html), badge)
  await page.screenshot({ path: `qa/shots/${name}.png` })
  console.log('shot', name)
}
await browser.close()
