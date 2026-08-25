-- Single-leg work is logged per side: rehab after a meniscectomy is about
-- closing the gap between the operated leg and the other one, so the two can
-- never share a row.
alter table public.session_sets
  add column side text not null default 'both'
  check (side in ('both','left','right'));

create index session_sets_side_idx on public.session_sets (session_exercise_id, set_number, side);

-- App-wide preferences. One row, id = 1.
create table public.app_settings (
  id int primary key default 1 check (id = 1),
  operated_side text check (operated_side in ('left','right')),
  surgery_date date,
  schedule jsonb not null default '{}'::jsonb,   -- weekday ("0"–"6") -> template id
  auto_plan_days int not null default 14,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
create policy anon_all on public.app_settings for all to anon using (true) with check (true);

create trigger app_settings_touch before update on public.app_settings
  for each row execute function public.touch_updated_at();

insert into public.app_settings (id) values (1) on conflict (id) do nothing;
