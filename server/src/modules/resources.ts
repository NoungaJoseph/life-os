import { z } from 'zod';
import { isoDate } from '../validators/schemas';
import type { ResourceCfg } from './crud';

const S = (n = 200) => z.string().trim().min(1).max(n);
const T = (n = 4000) => z.string().trim().max(n);
const N = z.number().min(0).max(1e12);
const I = (min = 0, max = 1_000_000) => z.number().int().min(min).max(max);
const D = isoDate;
const U = z.string().uuid();
const B = z.boolean();
const CUR = z.string().length(3).transform((s) => s.toUpperCase());
const TS = z.string().datetime({ offset: true });
const E = <V extends [string, ...string[]]>(...v: V) => z.enum(v);
const MEAL = E('breakfast', 'lunch', 'dinner', 'snack');
const PRIORITY = E('low', 'medium', 'high');
const FIRST_OF_MONTH = z.string().regex(/^\d{4}-\d{2}-01$/, 'Use the first day of the month, YYYY-MM-01');
const nowIso = () => new Date().toISOString();
const todayUtc = () => new Date().toISOString().slice(0, 10);

/** Every simple user-owned resource. Each gets list / create / update / delete with validation, ownership checks and pagination. */
export const resources: ResourceCfg[] = [
  // ---- Projects and businesses
  { path: 'projects', table: 'projects', label: 'Project', order: [['created_at', false]], filters: ['status', 'kind'], required: ['name'],
    shape: { name: S(120), description: T(2000), kind: E('project', 'business', 'app', 'other'), status: E('idea', 'active', 'paused', 'completed', 'archived'), target_date: D, notes: T(), goal_id: U },
    refs: { goal_id: 'goals' } },
  { path: 'project-tasks', table: 'project_tasks', label: 'Project', order: [['due_date', true], ['created_at', false]], filters: ['project_id', 'status', 'kind'], required: ['project_id', 'title'],
    shape: { project_id: U, title: S(200), status: E('todo', 'doing', 'done'), priority: PRIORITY, kind: E('task', 'follow_up', 'customer', 'improvement', 'milestone'), due_date: D, notes: T() },
    refs: { project_id: 'projects' },
    onUpdate: (p) => { if (p.status === 'done') p.completed_at = nowIso(); else if (p.status) p.completed_at = null; } },
  { path: 'project-metrics', table: 'project_metrics', label: 'Project', order: [['recorded_on', false]], filters: ['project_id', 'metric'], dateCol: 'recorded_on', required: ['project_id', 'metric', 'value'],
    shape: { project_id: U, metric: S(80), value: z.number().min(-1e12).max(1e12), unit: T(20), recorded_on: D }, refs: { project_id: 'projects' } },

  // ---- Finance
  { path: 'income', table: 'income_records', label: 'Income record', order: [['received_on', false], ['created_at', false]], filters: ['project_id', 'category'], dateCol: 'received_on', required: ['amount'],
    shape: { amount: N, currency: CUR, source: T(120), category: T(60), received_on: D, notes: T(1000), project_id: U }, refs: { project_id: 'projects' } },
  { path: 'expenses', table: 'expense_records', label: 'Expense', order: [['spent_on', false], ['created_at', false]], filters: ['category', 'project_id'], dateCol: 'spent_on', required: ['amount'],
    shape: { amount: N, currency: CUR, category: S(60), description: T(200), spent_on: D, notes: T(1000), project_id: U }, refs: { project_id: 'projects' } },
  { path: 'budgets', table: 'budgets', label: 'Budget', order: [['category', true]], filters: ['month'], required: ['category', 'month', 'amount'], upsertOn: ['category', 'month'],
    shape: { category: S(60), month: FIRST_OF_MONTH, amount: N } },
  { path: 'savings-goals', table: 'savings_goals', label: 'Savings goal', order: [['created_at', false]], filters: ['kind'], required: ['name', 'target_amount'],
    shape: { name: S(120), kind: E('emergency', 'short_term', 'long_term', 'locked', 'other'), target_amount: z.number().positive().max(1e12), currency: CUR, target_date: D, notes: T(1000) } },
  { path: 'savings-transactions', table: 'savings_transactions', label: 'Savings goal', order: [['occurred_on', false], ['created_at', false]], filters: ['savings_goal_id'], dateCol: 'occurred_on', required: ['savings_goal_id', 'amount'],
    shape: { savings_goal_id: U, amount: z.number().min(-1e12).max(1e12).refine((n) => n !== 0, 'Amount cannot be zero'), occurred_on: D, note: T(300) }, refs: { savings_goal_id: 'savings_goals' } },
  { path: 'external-savings', table: 'external_savings_accounts', label: 'Savings account', order: [['created_at', false]], required: ['provider'],
    shape: { provider: S(120), name: T(120), amount: N, currency: CUR, is_locked: B, lock_start: D, maturity_date: D, withdrawal_available_on: D, interest_rate: z.number().min(0).max(1000), notes: T(1000) } },

  { path: 'debts', table: 'debts', label: 'Debt', order: [['created_at', false]], filters: ['status', 'direction'], required: ['name', 'principal'],
    shape: { name: S(120), creditor: T(120), direction: E('owed_by_me', 'owed_to_me'), principal: N, currency: CUR, interest_rate: z.number().min(0).max(1000), due_date: D, min_payment: N, status: E('active', 'paid', 'written_off'), notes: T(1000) } },
  { path: 'debt-payments', table: 'debt_payments', label: 'Debt', order: [['paid_on', false], ['created_at', false]], filters: ['debt_id'], dateCol: 'paid_on', required: ['debt_id', 'amount'],
    shape: { debt_id: U, amount: z.number().positive().max(1e12), paid_on: D, note: T(300) }, refs: { debt_id: 'debts' } },

  // ---- Planning and work
  { path: 'daily-reviews', table: 'daily_reviews', label: 'Daily review', order: [['review_date', false]], dateCol: 'review_date', required: ['review_date'], upsertOn: ['review_date'],
    shape: { review_date: D, wins: T(), lessons: T(), tomorrow_priorities: T(), rating: I(1, 5) } },
  { path: 'daily-schedules', table: 'daily_schedules', label: 'Daily plan', order: [['schedule_date', false]], dateCol: 'schedule_date', required: ['schedule_date'], upsertOn: ['schedule_date'],
    shape: { schedule_date: D, main_priority: T(200), support_priorities: z.array(S(200)).max(2), end_of_day_report: T() } },
  { path: 'calendar-events', table: 'calendar_events', label: 'Event', order: [['starts_at', true]], filters: ['kind'], dateCol: 'starts_at', dateIsTimestamp: true, required: ['title', 'starts_at'],
    shape: { title: S(200), kind: E('event', 'meeting', 'follow_up', 'reminder'), starts_at: TS, ends_at: TS, location: T(200), notes: T(1000), life_area_id: U }, refs: { life_area_id: 'life_areas' } },
  { path: 'work-responsibilities', table: 'work_responsibilities', label: 'Responsibility', order: [['created_at', false]], filters: ['status', 'frequency'], required: ['title'],
    shape: { title: S(200), description: T(1000), frequency: E('daily', 'weekly', 'monthly', 'ad_hoc'), status: E('active', 'paused', 'done') } },

  // ---- Social
  { path: 'social-platforms', table: 'social_platforms', label: 'Platform', order: [['name', true]], required: ['name'],
    shape: { name: S(60), handle: T(80), url: z.string().url().max(300), daily_limit_minutes: I(0, 1440), notes: T(1000) } },
  { path: 'social-content', table: 'social_content', label: 'Content', order: [['scheduled_for', true], ['created_at', false]], filters: ['status', 'platform_id'], dateCol: 'scheduled_for', required: ['title'],
    shape: { title: S(200), platform_id: U, content_pillar: T(80), format: T(60), draft: T(8000), scheduled_for: D, status: E('idea', 'draft', 'scheduled', 'published'), published_on: D, performance_notes: T(1000) },
    refs: { platform_id: 'social_platforms' },
    onUpdate: (p) => { if (p.status === 'published' && !p.published_on) p.published_on = todayUtc(); } },

  // ---- Food and nutrition
  { path: 'grocery-lists', table: 'grocery_lists', label: 'Grocery list', order: [['created_at', false]], filters: ['kind'], required: ['name'],
    shape: { name: S(120), kind: E('monthly', 'weekly'), budget: N, starts_on: D } },
  { path: 'grocery-items', table: 'grocery_items', label: 'Grocery list', order: [['purchased', true], ['created_at', true]], filters: ['list_id', 'purchased', 'perishable'], required: ['list_id', 'name'],
    shape: { list_id: U, name: S(120), quantity: T(40), category: T(60), perishable: B, estimated_price: N, actual_price: N, purchased: B }, refs: { list_id: 'grocery_lists' } },
  { path: 'food-inventory', table: 'food_inventory', label: 'Food item', order: [['expires_on', true]], required: ['name'],
    shape: { name: S(120), quantity: T(40), category: T(60), purchased_on: D, expires_on: D, notes: T(500) } },
  { path: 'meals', table: 'meals', label: 'Meal', order: [['name', true]], filters: ['meal_type'], required: ['name'],
    shape: { name: S(120), meal_type: MEAL, ingredients: T(2000), notes: T(1000) } },
  { path: 'meal-plans', table: 'meal_plans', label: 'Meal', order: [['plan_date', true]], filters: ['meal_type'], dateCol: 'plan_date', required: ['plan_date', 'meal_type'],
    shape: { plan_date: D, meal_type: MEAL, meal_id: U, custom_name: T(120), prep_notes: T(1000) }, refs: { meal_id: 'meals' } },
  { path: 'food-logs', table: 'food_logs', label: 'Food log', order: [['logged_on', false], ['created_at', false]], filters: ['meal_type'], dateCol: 'logged_on', required: ['meal_type', 'description'],
    shape: { logged_on: D, meal_type: MEAL, description: S(300), food_groups: z.array(S(40)).max(10), notes: T(500) } },
  { path: 'water-logs', table: 'water_logs', label: 'Water log', order: [['logged_on', false], ['created_at', false]], dateCol: 'logged_on', required: ['amount_ml'],
    shape: { logged_on: D, amount_ml: I(1, 5000) } },

  // ---- Fitness (built-in routines are read-only)
  { path: 'workouts', table: 'workouts', label: 'Workout', order: [['created_at', true]], filters: ['kind', 'level'], required: ['name'], includeBuiltIn: true,
    shape: { name: S(120), kind: E('home', 'walking', 'running', 'football', 'mobility', 'strength', 'recovery', 'other'), level: E('beginner', 'intermediate', 'advanced'), equipment: T(120), duration_min: I(1, 600), instructions: T() } },
  { path: 'workout-logs', table: 'workout_logs', label: 'Workout', order: [['logged_on', false], ['created_at', false]], filters: ['kind'], dateCol: 'logged_on', required: ['name'],
    shape: { name: S(120), workout_id: U, kind: T(30), logged_on: D, duration_min: I(0, 1440), intensity: E('easy', 'moderate', 'hard'), is_rest_day: B, notes: T(1000) } },

  // ---- Reading, study, reflection
  { path: 'reading-items', table: 'reading_items', label: 'Book', order: [['updated_at', false]], filters: ['status'], required: ['title'],
    shape: { title: S(200), author: T(120), category: T(60), status: E('want', 'reading', 'done'), start_date: D, completed_on: D, total_pages: I(1, 20000), current_page: I(0, 20000), notes: T(), lessons: T() },
    onUpdate: (p) => { if (p.status === 'done' && !p.completed_on) p.completed_on = todayUtc(); if (p.status === 'reading' && !p.start_date) p.start_date = todayUtc(); } },
  { path: 'reading-sessions', table: 'reading_sessions', label: 'Book', order: [['session_on', false], ['created_at', false]], filters: ['kind', 'reading_item_id'], dateCol: 'session_on', required: ['minutes'],
    shape: { reading_item_id: U, kind: E('reading', 'study', 'meditation', 'speaking', 'listening'), session_on: D, minutes: I(1, 1440), pages: I(0, 5000), notes: T(1000) }, refs: { reading_item_id: 'reading_items' } },
  { path: 'learning-notes', table: 'learning_notes', label: 'Note', order: [['created_at', false]], required: ['title'],
    shape: { title: S(200), content: T(), reading_item_id: U }, refs: { reading_item_id: 'reading_items' } },

  // ---- Relationships and reminders
  { path: 'relationship-notes', table: 'relationship_notes', label: 'Note', order: [['note_date', true], ['created_at', false]], filters: ['kind', 'is_done'], dateCol: 'note_date', required: ['title'],
    shape: { person: T(120), kind: E('important_date', 'reflection', 'follow_up', 'activity', 'boundary', 'value'), title: S(200), content: T(), note_date: D, repeats_yearly: B, is_done: B } },
  { path: 'reminders', table: 'reminders', label: 'Reminder', order: [['remind_time', true]], filters: ['kind', 'is_enabled'], required: ['kind', 'title', 'remind_time'],
    shape: { kind: E('daily_tasks', 'habit', 'reading', 'workout', 'finance_review', 'weekly_review', 'monthly_review', 'custom'), title: S(120),
      remind_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM'), days_of_week: z.array(z.number().int().min(0).max(6)).max(7), is_enabled: B } },
];
