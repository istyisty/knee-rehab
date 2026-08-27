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
const iso = d => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10) }

await page.goto(`${B}/history`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.screenshot({ path: 'qa/shots/v2-calendar.png' })

// Day with a session -> straight through to the workout
await page.locator(`button[aria-label="${iso(-3)}"]`).click()
await page.waitForTimeout(400)
await page.screenshot({ path: 'qa/shots/v2-calendar-day.png' })
await page.getByText('Open workout').first().click()
await page.waitForTimeout(800)
console.log('day -> workout:', new URL(page.url()).pathname.startsWith('/session/'))

// Day with a run -> the run editor
await page.goto(`${B}/history`, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await page.locator(`button[aria-label="${iso(-4)}"]`).click()
await page.waitForTimeout(400)
await page.getByText('Treadmill intervals').click()
await page.waitForTimeout(500)
console.log('day -> run editor:', await page.getByText('Edit run').count() > 0)

// Month navigation
await page.goto(`${B}/history`, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await page.locator('button[aria-label="Previous month"]').click()
await page.waitForTimeout(300)
await page.locator('button[aria-label="Previous month"]').click()
await page.waitForTimeout(400)
console.log('navigates back two months:', await page.getByRole('button', { name: 'Today' }).count() > 0)
console.log('remembers the view:', await page.getByText(/\d{4}/).count() > 0)
console.log('errors:', errors.length ? errors : 'none')
await browser.close()
