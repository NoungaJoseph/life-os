export interface Profile {
  id: string;
  display_name: string | null;
  timezone: string;
  currency: string;
  language: string;
  preferences: Preferences;
  onboarding_completed: boolean;
}

export interface Preferences {
  tutorial?: { tour_seen?: boolean; seen?: Record<string, boolean> };
  challenges?: { obstacles?: string; distractions?: string; improve?: string };
  planning?: { daily: boolean; weekly: boolean; monthly: boolean };
  routine?: {
    work_start?: string;
    work_end?: string;
    reading_time?: string;
    exercise_days?: number[];
    exercise_time?: string;
  };
}

export interface LifeVision {
  identity_statement: string | null;
  ideal_life: string | null;
  long_term_ambitions: string | null;
  pillar_priorities: Record<string, string>;
}

export interface Pillar { id: string; slug: string; name: string; purpose: string | null }
export interface LifeArea { id: string; slug: string; name: string; description: string | null }
export interface UserLifeArea { life_area_id: string; is_active: boolean }
export interface Goal { id: string; title: string; goal_type: string; status: string }

export interface HabitStats {
  streak: number; streak_unit: 'days' | 'weeks' | 'months'; longest: number; rate30: number;
  completed_today: boolean; due_today: boolean; best_weekday: string | null; lapse_risk: number | null;
}
export interface Insight {
  id: string; kind: 'prediction' | 'pattern' | 'warning' | 'win'; title: string; body: string; priority: number;
  code?: string; params?: Record<string, string | number>;
  entity?: { type: 'habit' | 'goal' | 'task' | 'pillar'; id: string };
}
export interface GoalProjection {
  status: 'completed' | 'on_track' | 'at_risk' | 'behind' | 'no_deadline' | 'not_started';
  progress: number; elapsed_fraction: number | null; projected_completion: string | null;
  days_late: number | null; days_remaining: number | null;
}
export interface GoalView {
  id: string; title: string; description: string | null; goal_type: string; status: string; priority: string;
  parent_goal_id: string | null; pillar_id: string | null; life_area_id: string | null; target_date: string | null;
  measurement_type: string; target_value: number | null; current_value: number; unit: string | null;
  child_count: number; progress: number; projection: GoalProjection;
}
export interface Task {
  id: string; title: string; notes?: string | null; priority: 'low' | 'medium' | 'high'; due_date: string | null;
  completed_at: string | null; goal_id: string | null; overdue?: boolean;
}
export interface DashboardHabit {
  id: string; name: string; frequency: string; stats: HabitStats;
}
export interface PillarBalance { pillar_id: string; name: string; events: number; score: number; neglected: boolean }
export interface Dashboard {
  date: string; display_name: string | null; momentum: number | null; ai_enabled: boolean;
  summary: { tasks_open: number; tasks_done_today: number; habits_due: number; habits_done: number };
  priorities: Task[]; habits: DashboardHabit[]; goals: GoalView[];
  balance: { pillars: PillarBalance[]; total_events: number }; insights: Insight[];
}
export interface InsightsPayload {
  momentum: number | null; insights: Insight[]; balance: Dashboard['balance'];
  behavior: {
    completion_rate: number | null; overdue_open: number; avg_days_late: number | null; best_weekday: string | null;
    peak_hour: number | null; avg_daily_completions: number; open_today: number;
  };
  habits: ({ id: string; name: string } & HabitStats)[];
}
export interface Milestone { id: string; title: string; due_date: string | null; completed_at: string | null }
export interface JournalEntry { id: string; entry_date: string; mood: number | null; content: string; created_at: string }
