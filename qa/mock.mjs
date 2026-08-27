/**
 * A small stateful stand-in for PostgREST, so the builder flows can be driven
 * end to end (insert, read back, patch, delete) rather than against fixtures
 * that never change.
 */
const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 9)}`
const iso = d => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10) }

export function makeDb() {
  const ex = (name, block, unit, uni, load, mg, eq, s, r, cue) => ({
    id: uid('e'), name, block, unit, unilateral: uni, loadable: load, cue: cue ?? null,
    muscle_group: mg, equipment: eq, is_custom: false, archived: false,
    default_sets: s, default_reps: r,
  })

  const exercises = [
    ex('Crab Walk', 'warmup', 'reps', false, false, 'glutes', 'band', 2, 15, 'Band above knees, stay low'),
    ex('SL Wall Sit', 'warmup', 'seconds', true, false, 'quads', 'bodyweight', 4, 15, 'Thigh parallel, hold'),
    ex('Inner Range Quads', 'warmup', 'reps', true, false, 'quads', 'bodyweight', 2, 12, 'Towel under the knee'),
    ex('Pogos', 'plyo', 'reps', false, false, 'calves', 'bodyweight', 2, 20, 'Stiff ankles'),
    ex('Drop Lands', 'plyo', 'reps', false, false, 'full body', 'bodyweight', 2, 5, 'Land soft'),
    ex('Squat Jumps', 'plyo', 'reps', false, false, 'quads', 'bodyweight', 3, 5, 'Land quietly'),
    ex('Bulgarian Split Squat', 'main', 'reps', true, true, 'quads', 'dumbbell', 4, 8, 'Torso tall'),
    ex('SL RDL', 'main', 'reps', true, true, 'hamstrings', 'dumbbell', 3, 8, 'Hinge at the hip'),
    ex('Step Up', 'main', 'reps', true, true, 'glutes', 'dumbbell', 3, 8, 'Drive through the foot'),
    ex('Calf Raise', 'main', 'reps', false, true, 'calves', 'dumbbell', 3, 20, 'Pause at the top'),
    ex('Back Squat', 'main', 'reps', false, true, 'quads', 'barbell', 4, 6, 'Brace, hit depth'),
    ex('Bench Press', 'main', 'reps', false, true, 'chest', 'barbell', 4, 6, 'Shoulder blades back'),
    ex('Pull Up', 'main', 'reps', false, true, 'back', 'bodyweight', 4, 6, 'Full hang'),
    ex('Romanian Deadlift', 'main', 'reps', false, true, 'hamstrings', 'barbell', 4, 8, 'Hinge, flat back'),
    ex('Overhead Press', 'main', 'reps', false, true, 'shoulders', 'barbell', 4, 6, 'Ribs down'),
    ex('Plank', 'main', 'seconds', false, false, 'core', 'bodyweight', 3, 45, 'Ribs down'),
    ex('Farmer Carry', 'main', 'metres', false, true, 'full body', 'dumbbell', 3, 40, 'Tall posture'),
    ex('Couch Stretch', 'cooldown', 'seconds', true, false, 'quads', 'bodyweight', 2, 45, 'Tuck the pelvis'),
  ]

  const rehab = {
    id: 'prog-rehab', name: 'Knee Rehab', description: 'Post-meniscectomy plan prescribed 6 Aug 2026',
    tracks_knee: true, schedule: { '2': 'tpl-a', '4': 'tpl-b' }, run_days: [0],
    archived: false, sort_order: 0, created_at: '2026-08-06',
  }

  const templates = [
    { id: 'tpl-w', program_id: rehab.id, name: 'Warm Up', kind: 'warmup', description: 'Before every session', include_warmup: false, archived: false, sort_order: 0 },
    { id: 'tpl-a', program_id: rehab.id, name: 'Strength A', kind: 'strength', description: 'Bulgarian split squat focus', include_warmup: true, archived: false, sort_order: 1 },
    { id: 'tpl-b', program_id: rehab.id, name: 'Strength B', kind: 'strength', description: 'Hip thrust and pistol squat focus', include_warmup: true, archived: false, sort_order: 2 },
  ]

  const byName = n => exercises.find(e => e.name === n)
  const te = (tpl, name, s, r, o) => ({
    id: uid('te'), template_id: tpl, exercise_id: byName(name).id,
    target_sets: s, target_reps: r, sort_order: o,
  })

  const templateExercises = [
    te('tpl-w', 'Crab Walk', 2, 15, 0),
    te('tpl-w', 'SL Wall Sit', 4, 15, 1),
    te('tpl-w', 'Inner Range Quads', 2, 12, 2),
    te('tpl-a', 'Pogos', 2, 20, 0),
    te('tpl-a', 'Drop Lands', 2, 5, 1),
    te('tpl-a', 'Squat Jumps', 3, 5, 2),
    te('tpl-a', 'Bulgarian Split Squat', 4, 8, 3),
    te('tpl-a', 'SL RDL', 3, 8, 4),
    te('tpl-a', 'Step Up', 3, 8, 5),
    te('tpl-a', 'Calf Raise', 3, 20, 6),
    te('tpl-b', 'Pogos', 2, 20, 0),
    te('tpl-b', 'Squat Jumps', 3, 5, 1),
  ]

  const mk = (id, tpl, name, date, status, extra = {}) => ({
    id, template_id: tpl, program_id: rehab.id, tracks_knee: true, name,
    scheduled_date: date, status, started_at: null, completed_at: null,
    rating: null, difficulty: null, knee_pain: null, swelling: null, notes: null,
    created_at: '', updated_at: '', ...extra,
  })

  const sessions = [
    mk('s1', 'tpl-a', 'Strength A', iso(0), 'in_progress', { started_at: new Date().toISOString() }),
    mk('s2', 'tpl-b', 'Strength B', iso(2), 'planned'),
    mk('s3', 'tpl-b', 'Strength B', iso(-3), 'completed', { rating: 4, difficulty: 7, knee_pain: 2, swelling: 'mild', notes: 'Felt strong, slight ache on the last set of pistols.' }),
    mk('s4', 'tpl-a', 'Strength A', iso(-6), 'completed', { rating: 3, difficulty: 6, knee_pain: 3, swelling: 'none' }),
    mk('s5', 'tpl-a', 'Strength A', iso(-10), 'completed', { rating: 5, difficulty: 5, knee_pain: 4, swelling: 'mild' }),
  ]

  const sessionExercises = []
  const sessionSets = []
  for (const [tplId, sessionId, doneRatio] of [['tpl-a', 's1', 0.45], ['tpl-b', 's3', 1]]) {
    const rows = templateExercises.filter(t => t.template_id === 'tpl-w' && tplId !== 'tpl-w')
      .concat(templateExercises.filter(t => t.template_id === tplId))
    rows.forEach((row, i) => {
      const e = exercises.find(x => x.id === row.exercise_id)
      const seId = uid('se')
      sessionExercises.push({
        id: seId, session_id: sessionId, exercise_id: e.id, name: e.name, block: e.block,
        unit: e.unit, unilateral: e.unilateral, loadable: e.loadable,
        target_sets: row.target_sets, target_reps: row.target_reps, sort_order: i, notes: null,
      })
      const sides = e.unilateral ? ['left', 'right'] : ['both']
      for (let n = 1; n <= row.target_sets; n++) {
        for (const side of sides) {
          const done = n <= Math.round(row.target_sets * doneRatio)
          sessionSets.push({
            id: uid('ss'), session_exercise_id: seId, set_number: n, side,
            target_reps: row.target_reps, reps: done ? row.target_reps : null,
            weight: e.loadable ? (side === 'right' ? 12.5 : 15) : null,
            completed: done, completed_at: null, notes: null,
          })
        }
      }
    })
  }

  const runs = [
    { id: 'r1', date: iso(-1), source: 'strava', strava_activity_id: 111, name: 'Easy morning shakeout', distance_m: 5240, moving_time_s: 1720, elapsed_time_s: 1780, elevation_gain_m: 32, average_heartrate: 142, max_heartrate: 161, knee_pain: 1, rating: 4, notes: 'Knee felt fine on the flat.', created_at: '' },
    { id: 'r2', date: iso(-4), source: 'manual', strava_activity_id: null, name: 'Treadmill intervals', distance_m: 4000, moving_time_s: 1380, elapsed_time_s: null, elevation_gain_m: null, average_heartrate: null, max_heartrate: null, knee_pain: 2, rating: 3, notes: null, created_at: '' },
    { id: 'r3', date: iso(-8), source: 'strava', strava_activity_id: 112, name: 'Phoenix Park loop', distance_m: 8120, moving_time_s: 2760, elapsed_time_s: 2810, elevation_gain_m: 58, average_heartrate: 149, max_heartrate: 172, knee_pain: 3, rating: 4, notes: null, created_at: '' },
  ]

  return {
    exercises, programs: [rehab], workout_templates: templates,
    template_exercises: templateExercises, workout_sessions: sessions,
    session_exercises: sessionExercises, session_sets: sessionSets, runs,
    app_settings: [{ id: 1, operated_side: 'right', surgery_date: '2026-06-08', schedule: {}, auto_plan_days: 14 }],
  }
}

const opValue = v => {
  const [op, ...rest] = v.split('.')
  return [op, rest.join('.')]
}

function matches(row, params) {
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(key)) continue
    if (key.includes('.')) continue                 // filters on embedded tables
    const [op, val] = opValue(raw)
    const cell = row[key]
    if (op === 'eq') { if (String(cell) !== val) return false }
    else if (op === 'neq') { if (String(cell) === val) return false }
    else if (op === 'is') { if (val === 'null' && cell != null) return false }
    else if (op === 'not') { /* not.is.null */ if (cell == null) return false }
    else if (op === 'gte') { if (!(cell >= val)) return false }
    else if (op === 'lte') { if (!(cell <= val)) return false }
    else if (op === 'gt') { if (!(cell > val)) return false }
    else if (op === 'lt') { if (!(cell < val)) return false }
    else if (op === 'in') { if (!val.replace(/[()]/g, '').split(',').includes(String(cell))) return false }
  }
  return true
}

/** Expand the handful of embedded selects the app actually asks for. */
function embed(table, row, select, db) {
  const out = { ...row }
  if (select.includes('exercises(')) {
    out.exercises = db.exercises.find(e => e.id === row.exercise_id) ?? null
  }
  if (table === 'workout_sessions' && select.includes('session_exercises(')) {
    out.session_exercises = db.session_exercises
      .filter(se => se.session_id === row.id)
      .map(se => ({ ...se, session_sets: db.session_sets.filter(s => s.session_exercise_id === se.id) }))
  }
  if (table === 'session_exercises') {
    if (select.includes('session_sets(')) {
      out.session_sets = db.session_sets.filter(s => s.session_exercise_id === row.id)
    }
    if (select.includes('workout_sessions!inner')) {
      out.workout_sessions = db.workout_sessions.find(s => s.id === row.session_id) ?? null
    }
  }
  if (table === 'session_sets' && select.includes('session_exercises!inner')) {
    const se = db.session_exercises.find(e => e.id === row.session_exercise_id)
    out.session_exercises = se
      ? { ...se, workout_sessions: db.workout_sessions.find(s => s.id === se.session_id) ?? null }
      : null
  }
  return out
}

export function installMock(page, db, log) {
  return page.route('**/rest/v1/**', async route => {
    const req = route.request()
    const url = new URL(req.url())
    const table = url.pathname.split('/rest/v1/')[1]
    const params = [...url.searchParams.entries()]
    const select = url.searchParams.get('select') ?? '*'
    const rows = db[table] ?? []
    // PostgREST returns a bare object (not an array) when the client asks for
    // one via .single() / .maybeSingle(); supabase-js relies on that.
    const wantsObject = (req.headers()['accept'] ?? '').includes('pgrst.object')
    const json = (body, status = 200) => {
      if (wantsObject && Array.isArray(body)) {
        if (body.length === 0) return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
        return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body[0]) })
      }
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    }

    if (req.method() === 'GET') {
      let result = rows.filter(r => matches(r, params))
      const order = url.searchParams.get('order')
      if (order) {
        const [col, dir] = order.split('.')
        result = [...result].sort((a, b) =>
          (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === 'desc' ? -1 : 1))
      }
      const limit = url.searchParams.get('limit')
      if (limit) result = result.slice(0, Number(limit))
      // Embedded !inner joins drop rows whose parent is filtered out.
      const expanded = result.map(r => embed(table, r, select, db))
        .filter(r => !select.includes('workout_sessions!inner') || r.workout_sessions)
      return json(expanded)
    }

    const body = req.postDataJSON?.() ?? null

    if (req.method() === 'POST') {
      const incoming = Array.isArray(body) ? body : [body]
      const defaults = {
        programs: { schedule: {}, run_days: [], tracks_knee: false, sort_order: 0, description: null },
        workout_templates: { include_warmup: false, description: null, kind: 'strength', sort_order: 0 },
        exercises: { is_custom: false, default_sets: 3, default_reps: 10 },
      }[table] ?? {}
      const created = incoming.map(r => {
        const row = { id: r.id ?? uid(table.slice(0, 2)), archived: false, ...defaults, ...r }
        const existing = rows.findIndex(x => x.id === row.id)
        if (existing >= 0) rows[existing] = { ...rows[existing], ...row }
        else rows.push(row)
        return embed(table, row, select, db)
      })
      log?.push({ method: 'POST', table, count: created.length })
      return json(created, 201)
    }

    if (req.method() === 'PATCH') {
      const hit = rows.filter(r => matches(r, params))
      hit.forEach(r => Object.assign(r, body))
      log?.push({ method: 'PATCH', table, count: hit.length })
      return json(hit.map(r => embed(table, r, select, db)))
    }

    if (req.method() === 'DELETE') {
      const keep = rows.filter(r => !matches(r, params))
      const removed = rows.length - keep.length
      db[table] = keep
      log?.push({ method: 'DELETE', table, count: removed })
      return json([])
    }

    return json([])
  })
}
