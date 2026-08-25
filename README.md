# Knee Rehab

A mobile-first PWA for working through a post-meniscectomy rehab plan: the two
prescribed strength sessions with their shared warm up, run logging (manual or
pulled from Strava), and the trends that show whether the knee is improving.

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

## Database

Schema and seed data live in `supabase/migrations`. Row level security is on for
every table. The workout tables allow the anon key through — this is a
single-user app with no login. `strava_tokens` has RLS enabled and **no** anon
policy, so only the Netlify functions (service role) can read it.
