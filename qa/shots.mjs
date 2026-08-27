import { chromium } from 'playwright'
import { makeDb, installMock } from './mock.mjs'
import fs from 'node:fs'

fs.mkdirSync('qa/shots', { recursive: true })
const db = makeDb()
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e)))
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()) })

await installMock(page, db)
await page.route('**/api/strava/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":false,"connected":false}' }))

const B = 'http://localhost:4173'
const shot = async (path, name, prep) => {
  await page.goto(B + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  if (prep) await prep()
  await page.screenshot({ path: `qa/shots/${name}.png`, fullPage: true })
  console.log('shot', name)
}

await shot('/', 'v2-home')
await shot('/history', 'v2-history')
await shot('/runs', 'v2-runs')
await shot('/progress', 'v2-progress')
await shot('/settings', 'v2-settings')
await shot('/programs', 'v2-programs')
await shot('/program/prog-rehab', 'v2-program-rehab')
await shot('/workout/tpl-a', 'v2-workout-edit')
await shot('/session/s1', 'v2-session')
await shot('/report', 'v2-report')

// Rehab session: knee prompts present
await shot('/session/s1', 'v2-finish-rehab', async () => {
  await page.getByRole('button', { name: 'Finish workout' }).click()
  await page.waitForTimeout(500)
})
const rehabKnee = await page.getByText('Knee pain').count()

// Non-rehab session: same sheet, no knee prompts
db.workout_sessions.find(s => s.id === 's1').tracks_knee = false
await shot('/session/s1', 'v2-finish-general', async () => {
  await page.getByRole('button', { name: 'Finish workout' }).click()
  await page.waitForTimeout(500)
})
const generalKnee = await page.getByText('Knee pain').count()
console.log(`knee prompts — rehab session: ${rehabKnee > 0}, general session: ${generalKnee > 0}`)

// Exercise library picker
await shot('/workout/tpl-a', 'v2-picker', async () => {
  await page.getByRole('button', { name: /\+ Add/ }).first().click()
  await page.waitForTimeout(500)
})

console.log('errors:', errors.length ? errors : 'none')
await browser.close()
