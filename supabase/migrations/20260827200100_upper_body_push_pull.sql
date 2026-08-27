-- Exercises needed by the imported push/pull plan that weren't in the library.
insert into public.exercises (name, block, unit, unilateral, loadable, cue, muscle_group, equipment, default_sets, default_reps)
values
  ('Dumbbell Incline Fly','main','reps',false,true,'Soft elbows, wide arc, squeeze at the top','chest','dumbbell',3,12),
  ('Dumbbell Tricep Extension','main','reps',false,true,'Elbows tight and pointing forward, full stretch overhead','arms','dumbbell',3,10),
  ('Dumbbell Shrug','main','reps',false,true,'Straight up and down, pause at the top, no rolling','back','dumbbell',3,15),
  ('Dumbbell Arnold Press','main','reps',false,true,'Start palms in, rotate out as you press','shoulders','dumbbell',3,12),
  ('Dumbbell Incline Lateral Raise','main','reps',true,true,'Chest on the incline bench, lead with the elbow','shoulders','dumbbell',3,16),
  ('Dumbbell Kickback','main','reps',true,true,'Upper arm still and parallel to the floor','arms','dumbbell',3,16),
  ('Kettlebell Upright Row','main','reps',false,true,'Elbows lead, stop at chest height','shoulders','kettlebell',3,14),
  ('Resistance Band Wide Grip Lat Pulldown','main','reps',false,false,'Wide grip, drive the elbows down and back','back','band',3,20),
  ('Banded Face Pull','main','reps',false,false,'Pull to the forehead, thumbs back, squeeze the rear delts','shoulders','band',3,20),
  ('Barbell Underhand Bent-Over Row','main','reps',false,true,'Underhand grip, hinge to 45 degrees, pull to the navel','back','barbell',3,14)
on conflict (name) do nothing;

insert into public.programs (name, description, tracks_knee, schedule, run_days, sort_order)
select 'Upper Body - Push/Pull', 'Push/pull split, heavy power and hypertrophy days', false, '{}'::jsonb, '[]'::jsonb, 1
where not exists (select 1 from public.programs where name = 'Upper Body - Push/Pull');

insert into public.workout_templates (program_id, name, kind, description, include_warmup, sort_order)
select p.id, v.name, 'strength', v.descr, false, v.ord
from (values
  ('Push (A) - Heavy Power', 'Heavy pressing, low reps', 0),
  ('Pull (A) - Heavy Power', 'Heavy pulling, low reps',  1),
  ('Push (B) - Hypertrophy', 'Dumbbell volume work',     2),
  ('Pull (B) - Hypertrophy', 'Bands and dumbbells, high reps', 3)
) as v(name, descr, ord)
cross join (select id from public.programs where name = 'Upper Body - Push/Pull') p
on conflict (program_id, name) do nothing;

insert into public.template_exercises (template_id, exercise_id, target_sets, target_reps, target_reps_max, sort_order)
select t.id, e.id, v.sets, v.lo, v.hi, v.ord
from (values
  ('Push (A) - Heavy Power', 'Bench Press',                            3,  5,  8, 0),
  ('Push (A) - Heavy Power', 'Overhead Press',                         3,  8, 10, 1),
  ('Push (A) - Heavy Power', 'Dumbbell Incline Fly',                   3, 10, 12, 2),
  ('Push (A) - Heavy Power', 'Lateral Raise',                          4, 10, 15, 3),
  ('Push (A) - Heavy Power', 'Dumbbell Tricep Extension',              3,  8, 10, 4),
  ('Pull (A) - Heavy Power', 'Pull Up',                                3,  5,  8, 0),
  ('Pull (A) - Heavy Power', 'Barbell Row',                            3,  8, 10, 1),
  ('Pull (A) - Heavy Power', 'Dumbbell Shrug',                         3, 12, 15, 2),
  ('Pull (A) - Heavy Power', 'Barbell Curl',                           3,  8, 10, 3),
  ('Push (B) - Hypertrophy', 'Incline Dumbbell Press',                 3, 10, 12, 0),
  ('Push (B) - Hypertrophy', 'Dumbbell Arnold Press',                  3, 10, 12, 1),
  ('Push (B) - Hypertrophy', 'Dumbbell Incline Lateral Raise',         3, 15, 16, 2),
  ('Push (B) - Hypertrophy', 'Dumbbell Kickback',                      3, 15, 16, 3),
  ('Pull (B) - Hypertrophy', 'Kettlebell Upright Row',                 3, 12, 14, 0),
  ('Pull (B) - Hypertrophy', 'Resistance Band Wide Grip Lat Pulldown', 3, 15, 20, 1),
  ('Pull (B) - Hypertrophy', 'Banded Face Pull',                       3, 18, 20, 2),
  ('Pull (B) - Hypertrophy', 'Hammer Curl',                            3, 12, 14, 3),
  ('Pull (B) - Hypertrophy', 'Barbell Underhand Bent-Over Row',        3, 12, 14, 4)
) as v(tpl, ex, sets, lo, hi, ord)
join public.workout_templates t
  on t.name = v.tpl
 and t.program_id = (select id from public.programs where name = 'Upper Body - Push/Pull')
join public.exercises e on e.name = v.ex
on conflict (template_id, exercise_id) do nothing;
