# Workout Manager

A mobile-first PWA for building workouts, grouping them into programs, and
logging what you actually did. It started life as a post-meniscectomy rehab
tracker, and that plan is still in there as one program among others.

## What it does

**Programs and workouts**
- Build a workout from a library of 70+ exercises, filtered by muscle group and
  equipment, or add your own
- Group workouts into a program with its own weekly schedule, including run days
- A shared warm up per program, maintained in one place and pulled into every
  session that asks for it
- Each program decides whether it tracks rehab detail — knee pain, swelling and
  limb symmetry — so a general strength block isn't asking about your knee

**Logging**
- Plan a session for any date; weights prefill from the last time you did it
- Per-side logging for single-leg work, with a symmetry chart for rehab programs
- Rest timer that starts itself when you tick a set, screen wake lock while training
- Last session's numbers under each exercise, flagged when every set hit target
- Manual run logging plus Strava OAuth and sync

**Looking back**
- Month calendar with per-day indicators, and a day summary that opens each item
- Load, pain and weekly mileage charts
- A printable summary for physio reviews

**Reliability**
- Every write goes through a persisted retry queue with visible status
- Service worker plus a local copy of the open workout, so a session survives
  a gym with no signal

## Stack

- **React + Vite + TypeScript**, Tailwind for styling, Recharts for the graphs
- **Supabase** (Postgres) for storage
- **Netlify** for hosting, with serverless functions handling the Strava OAuth
  exchange so the client secret never reaches the browser

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | browser | Publishable key, guarded by RLS |
| `SUPABASE_URL` | functions | Same URL, server side |
| `SUPABASE_SERVICE_ROLE_KEY` | functions | Reads/writes the Strava token row |
| `STRAVA_CLIENT_ID` | functions | From strava.com/settings/api |
| `STRAVA_CLIENT_SECRET` | functions | Never exposed to the browser |

Strava is optional: without the last two the app runs normally and the Runs tab
explains what's missing.

## Strava setup

1. Create an API application at https://www.strava.com/settings/api
2. Set **Authorization Callback Domain** to the site's bare domain — no scheme, no path
3. Add the two Strava variables in Netlify, then redeploy
4. Open the Runs tab and hit Connect

Syncing pulls the last 100 activities and keeps runs only. Re-syncing refreshes
distance, time and heart rate but leaves your knee-pain score, rating and notes
untouched.

## Offline behaviour

`src/lib/queue.ts` is a write-behind queue. Every mutation is applied
optimistically, persisted to `localStorage`, and retried on an interval, on
`online`, and whenever the tab becomes visible. Repeated updates to the same row
are merged, and an op the server keeps rejecting is dropped after six attempts so
it can't block everything behind it. The header shows `Saving` / `Offline` /
`Save failed` — never nothing.

`src/lib/cache.ts` keeps a copy of each opened workout so a session can be worked
through underground and synced when you resurface.

## Local development

```bash
npm install
cp .env.example .env    # fill in the Supabase values
npm run dev
```

`npx netlify dev` runs the Strava functions alongside the app.

## Tests

`qa/` holds Playwright scripts that drive the app against `qa/mock.mjs`, a small
stateful stand-in for PostgREST. They are run by hand:

```bash
npm run build && npx vite preview --port 4173 &
node qa/shots.mjs      # screenshots every screen, checks for console errors
node qa/builder.mjs    # creates a program, builds a workout, schedules it
node qa/calendar.mjs   # calendar navigation and tap-through
node qa/offline.mjs    # writes survive a dead connection
```

## Database

Schema and seed data live in `supabase/migrations`. Row level security is on for
every table. The workout tables allow the anon key through — this is a
single-user app with no login. `strava_tokens` has RLS enabled and **no** anon
policy, so only the Netlify functions (service role) can read it.
