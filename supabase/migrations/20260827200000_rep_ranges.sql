-- Programs are usually prescribed as a range ("3 × 5-8"), not a single number.
-- target_reps stays the lower bound — the number you have to hit — and the
-- upper bound is optional, so everything already stored keeps working.
alter table public.template_exercises add column target_reps_max int;
alter table public.session_exercises add column target_reps_max int;

alter table public.template_exercises
  add constraint template_exercises_rep_range_check
  check (target_reps_max is null or target_reps_max >= target_reps);

alter table public.session_exercises
  add constraint session_exercises_rep_range_check
  check (target_reps_max is null or target_reps_max >= target_reps);
