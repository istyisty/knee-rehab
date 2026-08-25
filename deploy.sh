#!/usr/bin/env bash
# One-shot Netlify deploy for Knee Rehab.
#   NETLIFY_AUTH_TOKEN=... ./deploy.sh
# Creates the site if it doesn't exist, sets the environment variables,
# builds and deploys to production.
set -euo pipefail

SITE_NAME="${SITE_NAME:-knee-rehab-ivan}"
SUPABASE_URL="https://huqpuqnxcgikjciguudz.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cXB1cW54Y2dpa2pjaWd1dWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NTE3MDcsImV4cCI6MjEwMzIyNzcwN30.dz3Q3EjmgGj7pNur7m4ZYdx9n5fcBvOVLzS-2GXkrzg"

: "${NETLIFY_AUTH_TOKEN:?Set NETLIFY_AUTH_TOKEN first}"
NL="npx --yes netlify-cli@27"

npm install

if [ ! -f .netlify/state.json ]; then
  echo "Creating Netlify site '$SITE_NAME'…"
  $NL sites:create --name "$SITE_NAME" --manual || true
  $NL link --name "$SITE_NAME"
fi

echo "Setting environment variables…"
$NL env:set VITE_SUPABASE_URL      "$SUPABASE_URL"      --force
$NL env:set VITE_SUPABASE_ANON_KEY "$SUPABASE_ANON_KEY" --force
$NL env:set SUPABASE_URL           "$SUPABASE_URL"      --force

# Optional — only needed once you wire up Strava.
[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ] && $NL env:set SUPABASE_SERVICE_ROLE_KEY "$SUPABASE_SERVICE_ROLE_KEY" --force
[ -n "${STRAVA_CLIENT_ID:-}" ]          && $NL env:set STRAVA_CLIENT_ID          "$STRAVA_CLIENT_ID" --force
[ -n "${STRAVA_CLIENT_SECRET:-}" ]      && $NL env:set STRAVA_CLIENT_SECRET      "$STRAVA_CLIENT_SECRET" --force

echo "Building and deploying…"
npm run build
$NL deploy --prod --dir dist --functions netlify/functions

echo
echo "Done. Open the URL above on your phone and add it to your home screen."
