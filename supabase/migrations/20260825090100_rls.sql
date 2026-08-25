alter table public.exercises          enable row level security;
alter table public.workout_templates  enable row level security;
alter table public.template_exercises enable row level security;
alter table public.workout_sessions   enable row level security;
alter table public.session_exercises  enable row level security;
alter table public.session_sets       enable row level security;
alter table public.runs               enable row level security;
alter table public.strava_tokens      enable row level security;

-- Single-user app with no login: the anon key may read/write workout data.
create policy anon_all on public.exercises          for all to anon using (true) with check (true);
create policy anon_all on public.workout_templates  for all to anon using (true) with check (true);
create policy anon_all on public.template_exercises for all to anon using (true) with check (true);
create policy anon_all on public.workout_sessions   for all to anon using (true) with check (true);
create policy anon_all on public.session_exercises  for all to anon using (true) with check (true);
create policy anon_all on public.session_sets       for all to anon using (true) with check (true);
create policy anon_all on public.runs               for all to anon using (true) with check (true);

-- strava_tokens deliberately has NO anon policy: RLS denies the browser entirely.
-- Only Netlify functions using the service role key can touch it.
