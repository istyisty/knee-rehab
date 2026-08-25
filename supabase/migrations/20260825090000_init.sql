-- Knee Rehab schema. Applied to the KneeRehab Supabase project.

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  block text not null default 'main' check (block in ('warmup','plyo','main')),
  unit text not null default 'reps' check (unit in ('reps','seconds')),
  unilateral boolean not null default false,
  loadable boolean not null default true,
  cue text,
  created_at timestamptz not null default now()
);

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null default 'strength' check (kind in ('strength','warmup')),
  description text,
  include_warmup boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.workout_templates(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  target_sets int not null default 3,
  target_reps int not null default 8,
  sort_order int not null default 0,
  unique (template_id, exercise_id)
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.workout_templates(id) on delete set null,
  name text not null,
  scheduled_date date not null,
  status text not null default 'planned' check (status in ('planned','in_progress','completed','skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  rating int check (rating between 1 and 5),
  difficulty int check (difficulty between 1 and 10),
  knee_pain int check (knee_pain between 0 and 10),
  swelling text check (swelling in ('none','mild','moderate','severe')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_sessions_date_idx on public.workout_sessions (scheduled_date desc);

create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  name text not null,
  block text not null default 'main' check (block in ('warmup','plyo','main')),
  unit text not null default 'reps' check (unit in ('reps','seconds')),
  unilateral boolean not null default false,
  loadable boolean not null default true,
  target_sets int not null default 3,
  target_reps int not null default 8,
  sort_order int not null default 0,
  notes text
);
create index session_exercises_session_idx on public.session_exercises (session_id);

create table public.session_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.session_exercises(id) on delete cascade,
  set_number int not null,
  target_reps int,
  reps numeric,
  weight numeric,
  completed boolean not null default false,
  completed_at timestamptz,
  notes text
);
create index session_sets_exercise_idx on public.session_sets (session_exercise_id);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  source text not null default 'manual' check (source in ('manual','strava')),
  strava_activity_id bigint unique,
  name text,
  distance_m numeric,
  moving_time_s int,
  elapsed_time_s int,
  elevation_gain_m numeric,
  average_heartrate numeric,
  max_heartrate numeric,
  knee_pain int check (knee_pain between 0 and 10),
  rating int check (rating between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index runs_date_idx on public.runs (date desc);

create table public.strava_tokens (
  id int primary key default 1 check (id = 1),
  access_token text,
  refresh_token text,
  expires_at bigint,
  athlete_id bigint,
  athlete_name text,
  last_synced_at timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger workout_sessions_touch before update on public.workout_sessions
  for each row execute function public.touch_updated_at();
create trigger runs_touch before update on public.runs
  for each row execute function public.touch_updated_at();
create trigger strava_tokens_touch before update on public.strava_tokens
  for each row execute function public.touch_updated_at();
