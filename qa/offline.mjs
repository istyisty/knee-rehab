import { chromium } from 'playwright'
import { makeDb, installMock } from './mock.mjs'

/**
 * The important one: a session logged on a dead connection must survive.
 * Every write is blocked, then released, and the queue is inspected either side.
 */
const db = makeDb()
let blocked = true
const writes = []

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()

await installMock(page, db)
// Registered last so it runs first: Playwright matches routes newest to oldest.
// Fails every mutation while `blocked`, then falls through to the mock.
await page.route('**/rest/v1/**', async (route, request) => {
  if (request.method() !== 'GET' && blocked) return route.abort('internetdisconnected')
  if (request.method() !== 'GET') writes.push({ method: request.method(), body: request.postData() })
  return route.fallback()
})
await page.route('**/api/strava/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":false,"connected":false}' }))

await page.goto('http://localhost:4173/session/s1', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

const ticks = page.getByRole('button', { name: 'Mark set complete' })
for (let i = 0; i < 3; i++) await ticks.nth(0).click({ timeout: 5000 }).catch(() => {})
await page.waitForTimeout(600)

const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('kr.queue.v1') ?? '[]').length)
const pill = await page.locator('header button:has-text("Saving"), header button:has-text("Offline")').count()
console.log('while offline → queued ops:', queued, '| status pill shown:', pill > 0)

blocked = false
await page.evaluate(() => window.dispatchEvent(new Event('online')))
await page.waitForTimeout(2500)

console.log('after reconnect → queued ops:',
  await page.evaluate(() => JSON.parse(localStorage.getItem('kr.queue.v1') ?? '[]').length),
  '| writes that reached the server:', writes.length)
console.log('cached session copies:',
  await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('kr.cache.session.')).length))
await browser.close()
