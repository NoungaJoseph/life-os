import { z } from 'zod';

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Use HH:MM');
const uuid = z.string().uuid();
const priority = z.enum(['low', 'medium', 'high']);
const goalType = z.enum(['long_term', 'annual', 'quarterly', 'monthly', 'weekly', 'daily']);
const goalStatus = z.enum(['not_started', 'active', 'paused', 'completed', 'abandoned']);
const measurement = z.enum(['percentage', 'numeric', 'currency', 'time', 'frequency', 'milestones']);

export const uuidParam = z.object({ id: uuid });
export const habitDayParams = z.object({ id: uuid, date: isoDate });
export const milestoneParams = z.object({ id: uuid, milestoneId: uuid });
export const dateQuery = z.object({ date: isoDate.optional() });

// ---- profile / vision / areas
export const updateProfileSchema = z.object({
  display_name: z.string().trim().min(1).max(80),
  timezone: z.string().min(1).max(64).refine((tz) => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } }, 'Unknown time zone'),
  currency: z.string().length(3).toUpperCase(),
  language: z.string().min(2).max(10),
  preferences: z.record(z.unknown()),
  onboarding_completed: z.boolean(),
}).partial().strict();

export const upsertVisionSchema = z.object({
  identity_statement: z.string().trim().max(2000).optional(),
  ideal_life: z.string().trim().max(4000).optional(),
  long_term_ambitions: z.string().trim().max(4000).optional(),
  pillar_priorities: z.record(z.string().max(2000)).optional(),
}).strict();
export const setUserAreaSchema = z.object({ is_active: z.boolean() }).strict();

// ---- goals
const goalFields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000),
  success_criteria: z.string().trim().max(2000),
  notes: z.string().trim().max(4000),
  goal_type: goalType, priority, status: goalStatus,
  parent_goal_id: uuid, pillar_id: uuid, life_area_id: uuid,
  start_date: isoDate, target_date: isoDate,
  measurement_type: measurement, target_value: z.number().min(0), current_value: z.number().min(0), unit: z.string().max(30),
};
export const createGoalSchema = z.object({ ...goalFields, current_value: goalFields.current_value.optional() })
  .partial({ description: true, success_criteria: true, notes: true, priority: true, status: true, parent_goal_id: true, pillar_id: true,
    life_area_id: true, start_date: true, target_date: true, measurement_type: true, target_value: true, unit: true })
  .strict()
  .refine((g) => !g.start_date || !g.target_date || g.target_date >= g.start_date, { message: 'Target date must be after start date', path: ['target_date'] });

const nullable = <T extends z.ZodTypeAny>(s: T) => s.nullable().optional();
export const updateGoalSchema = z.object({
  title: goalFields.title.optional(), description: nullable(goalFields.description), success_criteria: nullable(goalFields.success_criteria),
  notes: nullable(goalFields.notes), goal_type: goalType.optional(), priority: priority.optional(), status: goalStatus.optional(),
  parent_goal_id: nullable(uuid), pillar_id: nullable(uuid), life_area_id: nullable(uuid),
  start_date: nullable(isoDate), target_date: nullable(isoDate), measurement_type: measurement.optional(),
  target_value: nullable(goalFields.target_value), current_value: goalFields.current_value.optional(), unit: nullable(goalFields.unit),
}).strict();

export const listGoalsQuery = z.object({
  goal_type: goalType.optional(), status: goalStatus.optional(), parent_goal_id: uuid.optional(),
  life_area_id: uuid.optional(), pillar_id: uuid.optional(),
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(50),
  sortBy: z.enum(['created_at', 'target_date', 'priority', 'title']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const createMilestoneSchema = z.object({ title: z.string().trim().min(1).max(200), due_date: isoDate.optional() }).strict();
export const updateMilestoneSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(), due_date: nullable(isoDate), completed: z.boolean().optional(),
}).strict();

// ---- tasks
export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200), notes: z.string().trim().max(4000).optional(), priority: priority.optional(),
  due_date: isoDate.optional(), goal_id: uuid.optional(), life_area_id: uuid.optional(),
}).strict();
export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(), notes: nullable(z.string().trim().max(4000)), priority: priority.optional(),
  due_date: nullable(isoDate), goal_id: nullable(uuid), life_area_id: nullable(uuid), completed: z.boolean().optional(),
}).strict();
export const listTasksQuery = z.object({
  from: isoDate.optional(), to: isoDate.optional(), due_date: isoDate.optional(), status: z.enum(['open', 'done']).optional(),
  goal_id: uuid.optional(), life_area_id: uuid.optional(),
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(200).default(100),
});

// ---- habits
const habitFields = {
  name: z.string().trim().min(1).max(120), description: z.string().trim().max(1000),
  frequency: z.enum(['daily', 'weekdays', 'weekly', 'monthly', 'custom']),
  days_of_week: z.array(z.number().int().min(0).max(6)).max(7),
  target_per_period: z.number().int().min(1).max(31), preferred_time: time, start_date: isoDate,
  goal_id: uuid, life_area_id: uuid, reminder_enabled: z.boolean(),
};
export const createHabitSchema = z.object(habitFields).partial({
  description: true, frequency: true, days_of_week: true, target_per_period: true, preferred_time: true, start_date: true,
  goal_id: true, life_area_id: true, reminder_enabled: true,
}).strict().refine((h) => h.frequency !== 'custom' || (h.days_of_week?.length ?? 0) > 0, { message: 'Pick at least one day', path: ['days_of_week'] });
export const updateHabitSchema = z.object({
  name: habitFields.name.optional(), description: nullable(habitFields.description), frequency: habitFields.frequency.optional(),
  days_of_week: nullable(habitFields.days_of_week), target_per_period: habitFields.target_per_period.optional(),
  preferred_time: nullable(time), goal_id: nullable(uuid), life_area_id: nullable(uuid), reminder_enabled: z.boolean().optional(),
  paused: z.boolean().optional(), archived: z.boolean().optional(),
}).strict();
export const completionBody = z.object({ note: z.string().trim().max(500).optional() }).strict();

// ---- journal
export const createJournalSchema = z.object({
  content: z.string().trim().min(1).max(8000), title: z.string().trim().max(200).optional(),
  mood: z.number().int().min(1).max(5).optional(), entry_date: isoDate.optional(), life_area_id: uuid.optional(),
}).strict();
export const updateJournalSchema = z.object({
  content: z.string().trim().min(1).max(8000).optional(), title: nullable(z.string().trim().max(200)),
  mood: nullable(z.number().int().min(1).max(5)), life_area_id: nullable(uuid),
}).strict();
export const listJournalQuery = z.object({
  from: isoDate.optional(), to: isoDate.optional(),
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

// ---- AI
export const coachSchema = z.object({
  message: z.string().trim().min(1).max(2000).optional(), // empty = "give me today's coaching note"
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) })).max(12).default([]),
  lang: z.enum(['en', 'fr']).optional(),
}).strict();
export const breakdownSchema = z.object({
  title: z.string().trim().min(1).max(200), goal_type: goalType,
  description: z.string().trim().max(4000).optional(), target_date: isoDate.optional(), lang: z.enum(['en', 'fr']).optional(),
}).strict();
export const reflectSchema = z.object({ journal_id: uuid, lang: z.enum(['en', 'fr']).optional() }).strict();
