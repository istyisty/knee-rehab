import { chromium } from 'playwright'
import { makeDb, installMock } from './mock.mjs'

/**
 * The rest timer used to be positioned with a hand-calculated offset that did
 * not match the finish bar's real height, so it sat underneath it. This asserts
 * on actual geometry rather than eyeballing a screenshot.
 */
const db = makeDb()
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e)))
await installMock(page, db)
await page.route('**/api/strava/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":false,"connected":false}' }))

await page.goto('http://localhost:4173/session/s1', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

// Ticking a set auto-starts the rest timer.
await page.getByRole('button', { name: 'Mark set complete' }).first().click()
await page.waitForTimeout(700)

const finish = page.getByRole('button', { name: 'Finish workout' })
const timer = page.getByText('Resting')
console.log('rest timer visible:', await timer.count() > 0)

const fb = await finish.boundingBox()
const tb = await page.locator('div:has-text("Resting")').last().boundingBox()
const overlap = !(tb.y + tb.height <= fb.y || fb.y + fb.height <= tb.y)
console.log(`timer bottom ${Math.round(tb.y + tb.height)} / finish top ${Math.round(fb.y)} → overlap: ${overlap}`)

// Both must be reachable, not just visually clear.
const hitTimer = await page.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Skip')
  if (!el) return 'no skip button'
  const r = el.getBoundingClientRect()
  const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
  return el.contains(top) || top === el ? 'reachable' : `blocked by ${top?.className ?? top?.tagName}`
})
const hitFinish = await page.evaluate(() => {
  const el = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Finish workout')
  const r = el.getBoundingClientRect()
  const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
  return el.contains(top) || top === el ? 'reachable' : `blocked by ${top?.className ?? top?.tagName}`
})
console.log('Skip button:', hitTimer)
console.log('Finish button:', hitFinish)

// Nothing in the scroll area should be permanently hidden behind the taller dock.
const lastCard = await page.evaluate(() => {
  const cards = document.querySelectorAll('.card')
  const last = cards[cards.length - 1]
  window.scrollTo(0, document.body.scrollHeight)
  const r = last.getBoundingClientRect()
  const dock = document.querySelector('.pb-dock').getBoundingClientRect()
  return { lastBottom: Math.round(r.bottom), dockTop: Math.round(dock.top) }
})
await page.waitForTimeout(300)
console.log(`after scrolling to the end: last card bottom ${lastCard.lastBottom}, dock top ${lastCard.dockTop} → clear: ${lastCard.lastBottom <= lastCard.dockTop}`)

await page.screenshot({ path: 'qa/shots/v3-restbar.png' })
console.log('errors:', errors.length ? errors : 'none')
await browser.close()
