-- The plan as prescribed on 6 Aug 2026.

insert into public.exercises (name, block, unit, unilateral, loadable, cue) values
  ('Crab Walk',            'warmup', 'reps',    false, false, 'Band above knees, stay low, small controlled steps'),
  ('SL Wall Sit',          'warmup', 'seconds', true,  false, 'Single leg, thigh parallel, hold the position'),
  ('Inner Range Quads',    'warmup', 'reps',    true,  false, 'Towel under the knee, drive the heel down and straighten'),
  ('Pogos',                'plyo',   'reps',    false, false, 'Stiff ankles, quick ground contacts, minimal knee bend'),
  ('Drop Lands',           'plyo',   'reps',    false, false, 'Step off, land soft and absorb, stick the landing'),
  ('Squat Jumps',          'plyo',   'reps',    false, false, 'Jump tall, land quietly into a controlled squat'),
  ('Bulgarian Split Squat','main',   'reps',    true,  true,  'Rear foot elevated, torso tall, control the descent'),
  ('SL RDL',               'main',   'reps',    true,  true,  'Hinge at the hip, flat back, feel the hamstring'),
  ('Step Up',              'main',   'reps',    true,  true,  'Drive through the whole foot, no push off the back leg'),
  ('Calf Raise',           'main',   'reps',    false, true,  'Full range, pause at the top, lower slowly'),
  ('Hip Thrust',           'main',   'reps',    false, true,  'Shoulders on bench, ribs down, squeeze at the top'),
  ('Pistol Squat',         'main',   'reps',    true,  true,  'Use support as needed, control all the way down'),
  ('Hamstring Bridge',     'main',   'reps',    false, true,  'Heels on a bench or ball, drive hips up, hold briefly');

insert into public.workout_templates (name, kind, description, include_warmup, sort_order) values
  ('Warm Up',    'warmup',   'Common warm up performed before every strength session', false, 0),
  ('Strength A', 'strength', 'Bulgarian split squat focus', true, 1),
  ('Strength B', 'strength', 'Hip thrust and pistol squat focus', true, 2);

insert into public.template_exercises (template_id, exercise_id, target_sets, target_reps, sort_order)
select t.id, e.id, v.sets, v.reps, v.ord
from (values
  ('Warm Up',    'Crab Walk', 2, 15, 0),
  ('Warm Up',    'SL Wall Sit', 4, 15, 1),
  ('Warm Up',    'Inner Range Quads', 2, 12, 2),
  ('Strength A', 'Pogos', 2, 20, 0),
  ('Strength A', 'Drop Lands', 2, 5, 1),
  ('Strength A', 'Squat Jumps', 3, 5, 2),
  ('Strength A', 'Bulgarian Split Squat', 4, 8, 3),
  ('Strength A', 'SL RDL', 3, 8, 4),
  ('Strength A', 'Step Up', 3, 8, 5),
  ('Strength A', 'Calf Raise', 3, 20, 6),
  ('Strength B', 'Pogos', 2, 20, 0),
  ('Strength B', 'Drop Lands', 2, 5, 1),
  ('Strength B', 'Squat Jumps', 3, 5, 2),
  ('Strength B', 'Hip Thrust', 3, 8, 3),
  ('Strength B', 'Pistol Squat', 4, 8, 4),
  ('Strength B', 'Hamstring Bridge', 3, 8, 5)
) as v(tpl, ex, sets, reps, ord)
join public.workout_templates t on t.name = v.tpl
join public.exercises e on e.name = v.ex;
