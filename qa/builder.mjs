import { chromium } from 'playwright'
import { makeDb, installMock } from './mock.mjs'

const db = makeDb()
const writes = []
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e)))
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()) })

await installMock(page, db, writes)
await page.route('**/api/strava/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"configured":false,"connected":false}' }))

const B = 'http://localhost:4173'
const shot = n => page.screenshot({ path: `qa/shots/${n}.png`, fullPage: true })

// ---------- Programs list ----------
await page.goto(`${B}/programs`, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await shot('gen-programs')
console.log('programs listed:', await page.getByText('Knee Rehab').count() > 0)

// ---------- Create a program ----------
await page.getByLabel('New program').click()
await page.waitForTimeout(400)
await page.locator('input.field').first().fill('Upper / Lower Split')
await page.getByRole('button', { name: 'Create program' }).click()
await page.waitForTimeout(800)
const programId = new URL(page.url()).pathname.split('/').pop()
console.log('created program:', db.programs.length === 2, '| landed on', page.url().includes('/program/'))
await shot('gen-program-new')

// ---------- Build a workout inside it ----------
await page.getByText('Build the first one').click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Build a workout' }).click()
await page.waitForTimeout(800)
console.log('workout created:', db.workout_templates.length === 4)

await page.locator('input.field').first().fill('Upper A')
await page.waitForTimeout(500)

// Add three exercises from the library, using search and a filter.
for (const [name, filter] of [['Bench Press', null], ['Pull Up', null], ['Overhead Press', 'shoulders']]) {
  await page.getByRole('button', { name: /\+ Add/ }).first().click()
  await page.waitForTimeout(400)
  if (filter) await page.getByRole('button', { name: filter, exact: true }).click()
  else await page.getByPlaceholder('Search the library…').fill(name)
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).first().click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Add to workout' }).click()
  await page.waitForTimeout(400)
}
await shot('gen-workout-builder')
const built = db.template_exercises.filter(t => t.template_id === db.workout_templates[3].id)
console.log('exercises added:', built.length, '| names:', built.map(t => db.exercises.find(e => e.id === t.exercise_id).name).join(', '))

// Reorder and confirm it persisted.
await page.getByLabel('Move down').first().click()
await page.waitForTimeout(500)
const after = db.template_exercises
  .filter(t => t.template_id === db.workout_templates[3].id)
  .sort((a, b) => a.sort_order - b.sort_order)
  .map(t => db.exercises.find(e => e.id === t.exercise_id).name)
console.log('after moving the first down:', after.join(', '))

// ---------- Custom exercise ----------
await page.getByRole('button', { name: /\+ Add/ }).first().click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /isn't listed/ }).click()
await page.waitForTimeout(400)
await page.getByPlaceholder('Zercher squat').fill('Zercher Squat')
await shot('gen-new-exercise')
await page.getByRole('button', { name: 'Create exercise' }).click()
await page.waitForTimeout(1000)
await page.screenshot({ path: 'qa/shots/gen-after-create.png' })
console.log('after create, sheet title:', await page.locator('h2').first().innerText().catch(() => '?'))
await page.getByRole('button', { name: 'Add to workout' }).click()
await page.waitForTimeout(500)
const custom = db.exercises.find(e => e.name === 'Zercher Squat')
console.log('custom exercise created:', !!custom, '| flagged custom:', custom?.is_custom === true)

// ---------- Schedule it ----------
await page.goto(`${B}/program/${programId}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await page.screenshot({ path: 'qa/shots/gen-program-page.png', fullPage: true })
console.log('templates in db for program:', db.workout_templates.filter(t => t.program_id === programId).map(t => `${t.name}/${t.kind}`).join(', '))
await page.getByRole('button', { name: /Mon/ }).click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /Wed/ }).click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: /Wed/ }).click()   // cycle past the workout to Run
await page.waitForTimeout(400)
await shot('gen-program-built')
const prog = db.programs.find(p => p.id === programId)
console.log('schedule:', JSON.stringify(prog.schedule), '| run days:', JSON.stringify(prog.run_days))
console.log('tracks_knee default off:', prog.tracks_knee === false)

// ---------- Planning picks it up, grouped by program ----------
await page.goto(`${B}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.getByRole('button', { name: /Plan workout/ }).first().click()
await page.waitForTimeout(600)
await shot('gen-plan-sheet')
console.log('plan sheet groups by program:',
  await page.getByText('Upper / Lower Split').count() > 0 && await page.getByText('Knee Rehab').count() > 0)

console.log('errors:', errors.length ? errors : 'none')
await browser.close()
