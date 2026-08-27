-- Everything that existed before programs is the knee rehab programme.
-- Fold it into one so no history is orphaned by the move.
insert into public.programs (name, description, tracks_knee, schedule, run_days, sort_order)
select
  'Knee Rehab',
  'Post-meniscectomy plan prescribed 6 Aug 2026',
  true,
  coalesce((select schedule from public.app_settings where id = 1), '{}'::jsonb),
  '[]'::jsonb,
  0
where not exists (select 1 from public.programs where name = 'Knee Rehab');

update public.workout_templates
set program_id = (select id from public.programs where name = 'Knee Rehab')
where program_id is null;

update public.workout_sessions s
set program_id = t.program_id, tracks_knee = true
from public.workout_templates t
where s.template_id = t.id and s.program_id is null;

update public.workout_sessions
set program_id = (select id from public.programs where name = 'Knee Rehab'), tracks_knee = true
where program_id is null;
