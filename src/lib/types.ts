export type Block = 'warmup' | 'plyo' | 'main' | 'cooldown'
export type Unit = 'reps' | 'seconds' | 'metres'
export type SessionStatus = 'planned' | 'in_progress' | 'completed' | 'skipped'
export type Swelling = 'none' | 'mild' | 'moderate' | 'severe'
export type Side = 'both' | 'left' | 'right'

export interface Exercise {
  id: string
  name: string
  block: Block
  unit: Unit
  unilateral: boolean
  loadable: boolean
  cue: string | null
  muscle_group: string | null
  equipment: string | null
  is_custom: boolean
  archived: boolean
  default_sets: number
  default_reps: number
}

export interface Program {
  id: string
  name: string
  description: string | null
  /** Rehab prompts — knee pain, swelling, limb symmetry — only for programs that want them. */
  tracks_knee: boolean
  /** weekday "0"(Sun)-"6" -> workout template id */
  schedule: Record<string, string>
  /** weekdays that are run days */
  run_days: number[]
  archived: boolean
  sort_order: number
  created_at: string
}

export interface WorkoutTemplate {
  id: string
  program_id: string | null
  name: string
  kind: 'strength' | 'warmup'
  description: string | null
  include_warmup: boolean
  archived: boolean
  sort_order: number
}

export interface TemplateExercise {
  id: string
  template_id: string
  exercise_id: string
  target_sets: number
  /** Lower bound of the prescribed range — the number you have to hit. */
  target_reps: number
  /** Upper bound, when the program prescribes a range. */
  target_reps_max: number | null
  sort_order: number
  exercises?: Exercise
}

export interface SessionSet {
  id: string
  session_exercise_id: string
  set_number: number
  side: Side
  target_reps: number | null
  reps: number | null
  weight: number | null
  completed: boolean
  completed_at: string | null
  notes: string | null
}

export interface SessionExercise {
  id: string
  session_id: string
  exercise_id: string | null
  name: string
  block: Block
  unit: Unit
  unilateral: boolean
  loadable: boolean
  target_sets: number
  target_reps: number
  target_reps_max: number | null
  sort_order: number
  notes: string | null
  session_sets?: SessionSet[]
}

export interface WorkoutSession {
  id: string
  template_id: string | null
  program_id: string | null
  /** Snapshotted from the program so old sessions keep their prompts. */
  tracks_knee: boolean
  name: string
  scheduled_date: string
  status: SessionStatus
  started_at: string | null
  completed_at: string | null
  rating: number | null
  difficulty: number | null
  knee_pain: number | null
  swelling: Swelling | null
  notes: string | null
  created_at: string
  updated_at: string
  session_exercises?: SessionExercise[]
}

export interface Run {
  id: string
  date: string
  source: 'manual' | 'strava'
  strava_activity_id: number | null
  name: string | null
  distance_m: number | null
  moving_time_s: number | null
  elapsed_time_s: number | null
  elevation_gain_m: number | null
  average_heartrate: number | null
  max_heartrate: number | null
  knee_pain: number | null
  rating: number | null
  notes: string | null
  created_at: string
}

export interface AppSettings {
  id: number
  operated_side: 'left' | 'right' | null
  surgery_date: string | null
  /** weekday number (0 = Sunday) -> template id */
  schedule: Record<string, string>
  auto_plan_days: number
}

export interface LastPerformance {
  date: string
  knee_pain: number | null
  /** one entry per side actually logged */
  sides: {
    side: Side
    topWeight: number | null
    totalReps: number
    setsCompleted: number
    setsPlanned: number
  }[]
  /** every prescribed set was completed at the target reps */
  hitAllTargets: boolean
}
