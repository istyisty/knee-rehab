export type Block = 'warmup' | 'plyo' | 'main'
export type Unit = 'reps' | 'seconds'
export type SessionStatus = 'planned' | 'in_progress' | 'completed' | 'skipped'
export type Swelling = 'none' | 'mild' | 'moderate' | 'severe'

export interface Exercise {
  id: string
  name: string
  block: Block
  unit: Unit
  unilateral: boolean
  loadable: boolean
  cue: string | null
}

export interface WorkoutTemplate {
  id: string
  name: string
  kind: 'strength' | 'warmup'
  description: string | null
  include_warmup: boolean
  sort_order: number
}

export interface TemplateExercise {
  id: string
  template_id: string
  exercise_id: string
  target_sets: number
  target_reps: number
  sort_order: number
  exercises?: Exercise
}

export interface SessionSet {
  id: string
  session_exercise_id: string
  set_number: number
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
  sort_order: number
  notes: string | null
  session_sets?: SessionSet[]
}

export interface WorkoutSession {
  id: string
  template_id: string | null
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
