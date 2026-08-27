import { chromium } from 'playwright'
import { makeDb, installMock } from './mock.mjs'

const db = makeDb()
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e)))
await installMock(page, db)
await page.route('**/api/strava/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":false,"connected":false}' }))

const B = 'http://localhost:4173'

// The imported program's workout should read as ranges, not single numbers.
await page.goto(`${B}/workout/tpl-pa`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.screenshot({ path: 'qa/shots/v3-workout-ranges.png', fullPage: true })
const body = await page.locator('body').innerText()
console.log('shows 3 × 5–8:', /3 × 5–8/.test(body))
console.log('shows 3 × 8–10:', /3 × 8–10/.test(body))
console.log('min/max steppers present:', (await page.getByText('reps (min)').count()) > 0 && (await page.getByText('max', { exact: true }).count()) > 0)

// Toggling a range off and back on
await page.getByRole('button', { name: 'Use a fixed target' }).first().click()
await page.waitForTimeout(500)
const first = db.template_exercises.find(t => t.template_id === 'tpl-pa' && t.sort_order === 0)
console.log('range cleared in db:', first.target_reps_max === null)
await page.getByRole('button', { name: 'Make it a range' }).first().click()
await page.waitForTimeout(500)
console.log('range restored in db:', first.target_reps_max === 7)

// Program list shows both programs, rehab badge only on the rehab one
await page.goto(`${B}/programs`, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await page.screenshot({ path: 'qa/shots/v3-programs.png', fullPage: true })
const list = await page.locator('body').innerText()
console.log('both programs listed:', list.includes('Knee Rehab') && list.includes('Upper Body - Push/Pull'))
console.log('rehab badge count:', await page.getByText('Rehab', { exact: true }).count())

// Planning a ranged workout carries the range into the session
await page.goto(`${B}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await page.getByRole('button', { name: /Plan workout/ }).first().click()
await page.waitForTimeout(500)
await page.getByText('Push (A) - Heavy Power').click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: 'Start now' }).click()
await page.waitForTimeout(1500)
await page.screenshot({ path: 'qa/shots/v3-session-ranges.png', fullPage: true })
console.log('url:', new URL(page.url()).pathname)
console.log('session_exercises in db:', db.session_exercises.filter(e => e.session_id !== 's1' && e.session_id !== 's3').map(e => `${e.name} ${e.target_sets}x${e.target_reps}-${e.target_reps_max}`).join(' | ') || 'none')
const sess = await page.locator('body').innerText()
// Overhead Press is untouched by the toggle test above, so assert on that one.
console.log('session shows the range:', /3 × 8–10 reps/.test(sess))
const placeholders = await page.locator('input[placeholder="8–10"]').count()
console.log('set inputs hint the range:', placeholders > 0)

console.log('errors:', errors.length ? errors : 'none')
await browser.close()
