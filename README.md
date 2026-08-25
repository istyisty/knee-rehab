# Knee Rehab

A mobile-first PWA for working through a post-meniscectomy rehab plan: the two
prescribed strength sessions with their shared warm up, run logging (manual or
pulled from Strava), and the trends that show whether the knee is improving.

## What it does

- Plan, run, edit and rate the two prescribed strength sessions, warm up included
- **Per-side logging** for every single-leg exercise, and a symmetry chart showing
  the operated leg as a percentage of the other — the number that matters most
- **Works without signal.** Writes go through a persisted queue that retries until
  the server confirms them, and save state is always visible rather than silent
- Shows what you did last time under each exercise, and flags when every set was
  completed at target
- Rest timer that starts itself when you tick a set, and a screen wake lock so the
  phone doesn't sleep mid-workout
- Recurring weekly schedule that keeps the next fortnight planned
- Manual run logging plus Strava OAuth and sync
- A printable summary for physio reviews

## Stack

- **React + Vite + TypeScript**, Tailwind for styling, Recharts for the graphs
- **Supabase** (Postgres) for storage
- **Netlify** for hosting, with serverless functions handling the Strava OAuth
  exchange so the client secret never reaches the browser

## The plan it was built from

| | Sets × reps |
|---|---|
| **Warm Up** (added to every strength session) | Crab Walk 2×15 · SL Wall Sit 4×15s · Inner Range Quads 2×12 |
| **Strength A** | Pogos 2×20 · Drop Lands 2×5 · Squat Jumps 3×5 · Bulgarian Split Squat 4×8 · SL RDL 3×8 · Step Up 3×8 · Calf Raise 3×20 |
| **Strength B** | Pogos 2×20 · Drop Lands 2×5 · Squat Jumps 3×5 · Hip Thrust 3×8 · Pistol Squat 4×8 · Hamstring Bridge 3×8 |

Templates live in the database, so adjusting the plan later is a data change,
not a code change.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | browser | Publishable key, guarded by RLS |
| `SUPABASE_URL` | functions | Same URL, server side |
| `SUPABASE_SERVICE_ROLE_KEY` | functions | Reads/writes the Strava token row |
| `STRAVA_CLIENT_ID` | functions | From strava.com/settings/api |
| `STRAVA_CLIENT_SECRET` | functions | Never exposed to the browser |

Strava is optional: without those last two the app runs normally and the Runs
tab shows a "not set up yet" panel instead of a Connect button.

## Strava setup

1. Create an API application at https://www.strava.com/settings/api
2. Set **Authorization Callback Domain** to the site's domain (no scheme, no path)
3. Add `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` in Netlify → Site
   configuration → Environment variables, then redeploy
4. Open the Runs tab and hit Connect

Syncing pulls the last 100 activities and keeps runs only. Re-syncing refreshes
distance, time and heart rate but leaves your knee-pain score, rating and notes
untouched.

## Local development

```bash
npm install
cp .env.example .env    # fill in the Supabase values
npm run dev
```

`npx netlify dev` runs the Strava functions alongside the app.

## Offline behaviour

`src/lib/queue.ts` is a write-behind queue. Every mutation is applied optimistically,
persisted to `localStorage`, and retried on an interval, on `online`, and whenever the
tab becomes visible. Repeated updates to the same row are merged, and an op that the
server keeps rejecting is dropped after six attempts so it can't block everything
behind it. The header shows `Saving` / `Offline` / `Save failed` — never nothing.

`src/lib/cache.ts` keeps a copy of each opened workout, so a session can be worked
through in a basement gym and synced when you resurface. A service worker
(vite-plugin-pwa) precaches the app shell so it opens at all.

## Database

Schema and seed data live in `supabase/migrations`. Row level security is on for
every table. The workout tables allow the anon key through — this is a
single-user app with no login. `strava_tokens` has RLS enabled and **no** anon
policy, so only the Netlify functions (service role) can read it.
