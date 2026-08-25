const ex = (id, name, block, unit, unilateral, loadable, cue) =>
  ({ id, name, block, unit, unilateral, loadable, cue })

export const exercises = [
  ex('e1', 'Crab Walk', 'warmup', 'reps', false, false, 'Band above knees, stay low'),
  ex('e2', 'SL Wall Sit', 'warmup', 'seconds', true, false, 'Thigh parallel, hold'),
  ex('e3', 'Inner Range Quads', 'warmup', 'reps', true, false, 'Towel under the knee'),
  ex('e4', 'Pogos', 'plyo', 'reps', false, false, 'Stiff ankles'),
  ex('e5', 'Drop Lands', 'plyo', 'reps', false, false, 'Land soft'),
  ex('e6', 'Squat Jumps', 'plyo', 'reps', false, false, 'Land quietly'),
  ex('e7', 'Bulgarian Split Squat', 'main', 'reps', true, true, 'Torso tall'),
  ex('e8', 'SL RDL', 'main', 'reps', true, true, 'Hinge at the hip'),
  ex('e9', 'Step Up', 'main', 'reps', true, true, 'Drive through the foot'),
  ex('e10', 'Calf Raise', 'main', 'reps', false, true, 'Pause at the top'),
]

export const templates = [
  { id: 't0', name: 'Warm Up', kind: 'warmup', description: 'Common warm up', include_warmup: false, sort_order: 0 },
  { id: 't1', name: 'Strength A', kind: 'strength', description: 'Bulgarian split squat focus', include_warmup: true, sort_order: 1 },
  { id: 't2', name: 'Strength B', kind: 'strength', description: 'Hip thrust and pistol squat focus', include_warmup: true, sort_order: 2 },
]

const iso = d => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10) }

export const sessions = [
  { id: 's1', template_id: 't1', name: 'Strength A', scheduled_date: iso(0), status: 'in_progress', started_at: new Date().toISOString(), completed_at: null, rating: null, difficulty: null, knee_pain: null, swelling: null, notes: null, created_at: '', updated_at: '' },
  { id: 's2', template_id: 't2', name: 'Strength B', scheduled_date: iso(2), status: 'planned', started_at: null, completed_at: null, rating: null, difficulty: null, knee_pain: null, swelling: null, notes: null, created_at: '', updated_at: '' },
  { id: 's3', template_id: 't2', name: 'Strength B', scheduled_date: iso(-3), status: 'completed', started_at: null, completed_at: '', rating: 4, difficulty: 7, knee_pain: 2, swelling: 'mild', notes: 'Felt strong, slight ache on the last set of pistols.', created_at: '', updated_at: '' },
  { id: 's4', template_id: 't1', name: 'Strength A', scheduled_date: iso(-6), status: 'completed', started_at: null, completed_at: '', rating: 3, difficulty: 6, knee_pain: 3, swelling: 'none', notes: null, created_at: '', updated_at: '' },
  { id: 's5', template_id: 't1', name: 'Strength A', scheduled_date: iso(-10), status: 'completed', started_at: null, completed_at: '', rating: 5, difficulty: 5, knee_pain: 4, swelling: 'mild', notes: null, created_at: '', updated_at: '' },
]

const mkSets = (seId, n, target, weight, doneCount, unilateral) => {
  const sides = unilateral ? ['left', 'right'] : ['both']
  return Array.from({ length: n }, (_, i) =>
    sides.map(side => ({
      id: `${seId}-set${i + 1}-${side}`, session_exercise_id: seId, set_number: i + 1, side,
      target_reps: target, reps: i < doneCount ? target : null,
      weight: side === 'right' && weight ? weight : weight,
      completed: i < doneCount, completed_at: null, notes: null,
    }))).flat()
}

const plan = [
  ['x1', 'e1', 'Crab Walk', 'warmup', 'reps', false, false, 2, 15, 0, null, 2],
  ['x2', 'e2', 'SL Wall Sit', 'warmup', 'seconds', true, false, 4, 15, 1, null, 4],
  ['x3', 'e3', 'Inner Range Quads', 'warmup', 'reps', true, false, 2, 12, 2, null, 2],
  ['x4', 'e4', 'Pogos', 'plyo', 'reps', false, false, 2, 20, 3, null, 2],
  ['x5', 'e5', 'Drop Lands', 'plyo', 'reps', false, false, 2, 5, 4, null, 1],
  ['x6', 'e6', 'Squat Jumps', 'plyo', 'reps', false, false, 3, 5, 5, null, 0],
  ['x7', 'e7', 'Bulgarian Split Squat', 'main', 'reps', true, true, 4, 8, 6, 12.5, 0],
  ['x8', 'e8', 'SL RDL', 'main', 'reps', true, true, 3, 8, 7, 16, 0],
  ['x9', 'e9', 'Step Up', 'main', 'reps', true, true, 3, 8, 8, 10, 0],
  ['x10', 'e10', 'Calf Raise', 'main', 'reps', false, true, 3, 20, 9, 20, 0],
]

export const sessionDetail = {
  ...sessions[0],
  session_exercises: plan.map(([id, exId, name, block, unit, uni, load, sets, reps, order, weight, done]) => ({
    id, session_id: 's1', exercise_id: exId, name, block, unit, unilateral: uni, loadable: load,
    target_sets: sets, target_reps: reps, sort_order: order, notes: null,
    session_sets: mkSets(id, sets, reps, weight, done, uni),
  })),
}

export const completedDetail = {
  ...sessions[2],
  session_exercises: plan.slice(0, 8).map(([id, exId, name, block, unit, uni, load, sets, reps, order, weight]) => ({
    id: id + 'c', session_id: 's3', exercise_id: exId, name, block, unit, unilateral: uni, loadable: load,
    target_sets: sets, target_reps: reps, sort_order: order, notes: null,
    session_sets: mkSets(id + 'c', sets, reps, weight, sets, uni),
  })),
}

export const runs = [
  { id: 'r1', date: iso(-1), source: 'strava', strava_activity_id: 111, name: 'Easy morning shakeout', distance_m: 5240, moving_time_s: 1720, elapsed_time_s: 1780, elevation_gain_m: 32, average_heartrate: 142, max_heartrate: 161, knee_pain: 1, rating: 4, notes: 'Knee felt fine on the flat, mild niggle on the downhill.', created_at: '' },
  { id: 'r2', date: iso(-4), source: 'manual', strava_activity_id: null, name: 'Treadmill intervals', distance_m: 4000, moving_time_s: 1380, elapsed_time_s: null, elevation_gain_m: null, average_heartrate: null, max_heartrate: null, knee_pain: 2, rating: 3, notes: null, created_at: '' },
  { id: 'r3', date: iso(-8), source: 'strava', strava_activity_id: 112, name: 'Phoenix Park loop', distance_m: 8120, moving_time_s: 2760, elapsed_time_s: 2810, elevation_gain_m: 58, average_heartrate: 149, max_heartrate: 172, knee_pain: 3, rating: 4, notes: null, created_at: '' },
]

export const settings = {
  id: 1, operated_side: 'right', surgery_date: '2026-06-08',
  schedule: { '2': 't1', '5': 't2' }, auto_plan_days: 14,
}

const symDates = ['2026-07-20', '2026-07-29', '2026-08-08', '2026-08-19', '2026-08-24']
export const symmetryRows = symDates.map((d, i) => ({
  unilateral: true,
  workout_sessions: { scheduled_date: d, status: 'completed' },
  session_sets: [
    { side: 'left', reps: 8, weight: 20, completed: true },
    { side: 'right', reps: 8, weight: [12.5, 14, 15, 17.5, 18][i], completed: true },
  ],
}))
