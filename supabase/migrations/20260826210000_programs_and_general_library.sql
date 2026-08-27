-- Programs: a named collection of workouts with its own weekly schedule.
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  -- Rehab-specific prompts (knee pain, swelling, limb symmetry) only make
  -- sense for some programs, so each one opts in.
  tracks_knee boolean not null default false,
  schedule jsonb not null default '{}'::jsonb,   -- weekday "0"-"6" -> template id
  run_days jsonb not null default '[]'::jsonb,   -- weekdays that are run days
  archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.programs enable row level security;
create policy anon_all on public.programs for all to anon using (true) with check (true);
create trigger programs_touch before update on public.programs
  for each row execute function public.touch_updated_at();

alter table public.workout_templates
  add column program_id uuid references public.programs(id) on delete cascade,
  add column archived boolean not null default false;

alter table public.workout_sessions
  add column program_id uuid references public.programs(id) on delete set null,
  add column tracks_knee boolean not null default false;

alter table public.workout_templates drop constraint if exists workout_templates_name_key;
create unique index workout_templates_program_name_idx
  on public.workout_templates (program_id, name);

alter table public.exercises
  add column muscle_group text,
  add column equipment text,
  add column is_custom boolean not null default false,
  add column archived boolean not null default false,
  add column default_sets int not null default 3,
  add column default_reps int not null default 10;

-- Cool-downs, and distance/time based work, are normal outside rehab.
alter table public.exercises drop constraint if exists exercises_block_check;
alter table public.exercises add constraint exercises_block_check
  check (block in ('warmup','plyo','main','cooldown'));
alter table public.session_exercises drop constraint if exists session_exercises_block_check;
alter table public.session_exercises add constraint session_exercises_block_check
  check (block in ('warmup','plyo','main','cooldown'));

alter table public.exercises drop constraint if exists exercises_unit_check;
alter table public.exercises add constraint exercises_unit_check
  check (unit in ('reps','seconds','metres'));
alter table public.session_exercises drop constraint if exists session_exercises_unit_check;
alter table public.session_exercises add constraint session_exercises_unit_check
  check (unit in ('reps','seconds','metres'));

create index exercises_muscle_idx on public.exercises (muscle_group);
create index workout_templates_program_idx on public.workout_templates (program_id);
create index workout_sessions_program_idx on public.workout_sessions (program_id);
