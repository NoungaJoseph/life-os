import type { Ionicons } from '@expo/vector-icons';
import type { TFunction } from 'i18next';
import { formatNumber } from '../i18n';

/** Every visible string here is a translation KEY (see src/i18n/ns/money.ts). Screens call t(key). API values stay English. */
export type FieldDef = {
  key: string; label: string; type: 'text' | 'multiline' | 'number' | 'date' | 'select' | 'time' | 'toggle';
  options?: [string, string][]; required?: boolean; placeholder?: string; today?: boolean; default?: string | number | boolean;
};
export type ModuleDef = {
  key: string; ns: string; title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap; path: string; group: string;
  fields: FieldDef[];
  titleKey: string;                                   // API field used as the row's main text
  meta?: (r: any, t: TFunction) => string;            // second line
  doneValue?: (r: any) => boolean; donePatch?: (next: boolean) => Record<string, unknown>;
  query?: string;
  readOnlyBuiltIn?: boolean;
  emptyBody: string;
};

const D = (v: unknown) => (v ? String(v).slice(0, 10) : '');
const money = (n: unknown) => formatNumber(Number(n || 0));
const opt = (...v: string[]): [string, string][] => v.map((x) => [x, `modules.opt.${x}`]);
const lab = (t: TFunction, v: unknown) => String(t(`modules.opt.${v}`, { defaultValue: String(v ?? '') }));
const join = (...p: (string | false | null | undefined | 0)[]) => p.filter(Boolean).join(' · ');

const CATS = opt('food', 'transport', 'housing', 'bills', 'health', 'education', 'business', 'leisure', 'other');
const MEALS = opt('breakfast', 'lunch', 'dinner', 'snack');
const f = (ns: string, id: string, key: string, type: FieldDef['type'], extra: Partial<FieldDef> = {}): FieldDef => ({ key, label: `modules.${ns}.f.${id}`, type, ...extra });
const mod = (ns: string, key: string, icon: ModuleDef['icon'], path: string, group: string, titleKey: string, fields: FieldDef[], rest: Partial<ModuleDef> = {}): ModuleDef =>
  ({ key, ns, title: `modules.${ns}.title`, subtitle: `modules.${ns}.subtitle`, emptyBody: `modules.${ns}.empty`, icon, path, group: `modules.groups.${group}`, titleKey, fields, ...rest });

export const GROUPS = ['money', 'work', 'body', 'mind', 'life'].map((g) => `modules.groups.${g}`);

export const MODULES: ModuleDef[] = [
  mod('income', 'income', 'trending-up-outline', 'income', 'money', 'source', [
    f('income', 'amount', 'amount', 'number', { required: true }), f('income', 'source', 'source', 'text'),
    f('income', 'category', 'category', 'text', { placeholder: 'modules.ph.categoryIncome' }), f('income', 'date', 'received_on', 'date', { today: true })],
    { meta: (r, t) => join(`${money(r.amount)} ${r.currency ?? ''}`.trim(), D(r.received_on), r.category) }),
  mod('expenses', 'expenses', 'trending-down-outline', 'expenses', 'money', 'description', [
    f('expenses', 'amount', 'amount', 'number', { required: true }), f('expenses', 'category', 'category', 'select', { required: true, options: CATS, default: 'food' }),
    f('expenses', 'description', 'description', 'text'), f('expenses', 'date', 'spent_on', 'date', { today: true })],
    { meta: (r, t) => join(`${money(r.amount)} ${r.currency ?? ''}`.trim(), lab(t, String(r.category).toLowerCase()), D(r.spent_on)) }),
  mod('budgets', 'budgets', 'wallet-outline', 'budgets', 'money', 'category', [
    f('budgets', 'category', 'category', 'select', { required: true, options: CATS, default: 'food' }),
    f('budgets', 'month', 'month', 'date', { required: true, default: 'FIRST_OF_MONTH' }), f('budgets', 'amount', 'amount', 'number', { required: true })],
    { meta: (r, t) => t('modules.meta.budget', { amount: money(r.amount), month: String(r.month).slice(0, 7) }) }),
  mod('savingsGoals', 'savings-goals', 'shield-checkmark-outline', 'savings-goals', 'money', 'name', [
    f('savingsGoals', 'name', 'name', 'text', { required: true }), f('savingsGoals', 'kind', 'kind', 'select', { options: opt('emergency', 'short_term', 'long_term', 'locked', 'other'), default: 'emergency' }),
    f('savingsGoals', 'target', 'target_amount', 'number', { required: true }), f('savingsGoals', 'date', 'target_date', 'date')],
    { meta: (r, t) => t('modules.meta.target', { amount: money(r.target_amount), kind: lab(t, r.kind) }) }),
  mod('externalSavings', 'external-savings', 'lock-closed-outline', 'external-savings', 'money', 'provider', [
    f('externalSavings', 'provider', 'provider', 'text', { required: true }), f('externalSavings', 'amount', 'amount', 'number'),
    f('externalSavings', 'locked', 'is_locked', 'toggle'), f('externalSavings', 'maturity', 'maturity_date', 'date')],
    { meta: (r, t) => join(`${money(r.amount)} ${r.currency ?? ''}`.trim(), r.is_locked && t('modules.meta.locked'), r.maturity_date && t('modules.meta.until', { date: D(r.maturity_date) })) }),

  mod('projects', 'projects', 'rocket-outline', 'projects', 'work', 'name', [
    f('projects', 'name', 'name', 'text', { required: true }), f('projects', 'kind', 'kind', 'select', { options: opt('project', 'business', 'app', 'other'), default: 'project' }),
    f('projects', 'status', 'status', 'select', { options: opt('idea', 'active', 'paused', 'completed', 'archived'), default: 'active' }),
    f('projects', 'date', 'target_date', 'date'), f('projects', 'description', 'description', 'multiline')],
    { meta: (r, t) => join(lab(t, r.kind), lab(t, r.status), r.target_date && t('modules.meta.due', { date: D(r.target_date) })) }),
  mod('work', 'work', 'briefcase-outline', 'work-responsibilities', 'work', 'title', [
    f('work', 'title', 'title', 'text', { required: true }), f('work', 'frequency', 'frequency', 'select', { options: opt('daily', 'weekly', 'monthly', 'ad_hoc'), default: 'weekly' }),
    f('work', 'description', 'description', 'multiline')],
    { meta: (r, t) => join(lab(t, r.frequency), lab(t, r.status)), doneValue: (r) => r.status === 'done', donePatch: (n) => ({ status: n ? 'done' : 'active' }) }),
  mod('calendar', 'calendar', 'calendar-outline', 'calendar-events', 'work', 'title', [
    f('calendar', 'title', 'title', 'text', { required: true }), f('calendar', 'kind', 'kind', 'select', { options: opt('event', 'meeting', 'follow_up', 'reminder'), default: 'meeting' }),
    f('calendar', 'starts', 'starts_at', 'text', { required: true, placeholder: 'modules.ph.isoTime' }), f('calendar', 'location', 'location', 'text')],
    { meta: (r, t) => join(String(r.starts_at).slice(0, 16).replace('T', ' '), lab(t, r.kind)) }),
  mod('social', 'social', 'megaphone-outline', 'social-content', 'work', 'title', [
    f('social', 'title', 'title', 'text', { required: true }), f('social', 'pillar', 'content_pillar', 'text'),
    f('social', 'status', 'status', 'select', { options: opt('idea', 'draft', 'scheduled', 'published'), default: 'idea' }),
    f('social', 'scheduled', 'scheduled_for', 'date'), f('social', 'draft', 'draft', 'multiline')],
    { meta: (r, t) => join(lab(t, r.status), D(r.scheduled_for)), doneValue: (r) => r.status === 'published', donePatch: (n) => ({ status: n ? 'published' : 'draft' }) }),
  mod('platforms', 'platforms', 'phone-portrait-outline', 'social-platforms', 'work', 'name', [
    f('platforms', 'name', 'name', 'text', { required: true }), f('platforms', 'handle', 'handle', 'text'), f('platforms', 'limit', 'daily_limit_minutes', 'number')],
    { meta: (r, t) => join(r.handle, r.daily_limit_minutes && t('modules.meta.perMin', { n: r.daily_limit_minutes })) }),

  mod('grocery', 'grocery', 'cart-outline', 'grocery-items', 'body', 'name', [
    f('grocery', 'name', 'name', 'text', { required: true }), f('grocery', 'quantity', 'quantity', 'text'),
    f('grocery', 'price', 'estimated_price', 'number'), f('grocery', 'perishable', 'perishable', 'toggle')],
    { meta: (r, t) => join(r.quantity, r.estimated_price && `~${money(r.estimated_price)}`, r.perishable && t('modules.meta.perishable')), doneValue: (r) => !!r.purchased, donePatch: (n) => ({ purchased: n }), query: '&pageSize=200' }),
  mod('inventory', 'inventory', 'nutrition-outline', 'food-inventory', 'body', 'name', [
    f('inventory', 'name', 'name', 'text', { required: true }), f('inventory', 'quantity', 'quantity', 'text'), f('inventory', 'expires', 'expires_on', 'date')],
    { meta: (r, t) => join(r.quantity, r.expires_on && t('modules.meta.expires', { date: D(r.expires_on) })) }),
  mod('meals', 'meals', 'restaurant-outline', 'meals', 'body', 'name', [
    f('meals', 'name', 'name', 'text', { required: true }), f('meals', 'type', 'meal_type', 'select', { options: MEALS, default: 'lunch' }), f('meals', 'ingredients', 'ingredients', 'multiline')],
    { meta: (r, t) => lab(t, r.meal_type) }),
  mod('foodLogs', 'food-logs', 'fast-food-outline', 'food-logs', 'body', 'description', [
    f('foodLogs', 'meal', 'meal_type', 'select', { required: true, options: MEALS, default: 'lunch' }), f('foodLogs', 'description', 'description', 'text', { required: true }),
    f('foodLogs', 'date', 'logged_on', 'date', { today: true })],
    { meta: (r, t) => join(lab(t, r.meal_type), D(r.logged_on)) }),
  mod('water', 'water', 'water-outline', 'water-logs', 'body', 'logged_on', [
    f('water', 'amount', 'amount_ml', 'number', { required: true, default: 250 }), f('water', 'date', 'logged_on', 'date', { today: true })],
    { meta: (r, t) => t('modules.meta.ml', { n: r.amount_ml }) }),
  mod('workouts', 'workouts', 'barbell-outline', 'workouts', 'body', 'name', [
    f('workouts', 'name', 'name', 'text', { required: true }),
    f('workouts', 'kind', 'kind', 'select', { options: opt('home', 'walking', 'running', 'football', 'mobility', 'strength', 'recovery', 'other'), default: 'home' }),
    f('workouts', 'minutes', 'duration_min', 'number'), f('workouts', 'steps', 'instructions', 'multiline')],
    { readOnlyBuiltIn: true, meta: (r, t) => join(lab(t, r.kind), lab(t, r.level), r.duration_min ? t('modules.meta.minutes', { n: r.duration_min }) : t('modules.meta.unknownMinutes'), !r.user_id && t('modules.meta.builtIn')) }),
  mod('workoutLogs', 'workout-logs', 'fitness-outline', 'workout-logs', 'body', 'name', [
    f('workoutLogs', 'name', 'name', 'text', { required: true }), f('workoutLogs', 'minutes', 'duration_min', 'number'),
    f('workoutLogs', 'effort', 'intensity', 'select', { options: opt('easy', 'moderate', 'hard'), default: 'moderate' }),
    f('workoutLogs', 'rest', 'is_rest_day', 'toggle'), f('workoutLogs', 'date', 'logged_on', 'date', { today: true })],
    { meta: (r, t) => join(D(r.logged_on), r.duration_min && t('modules.meta.minutes', { n: r.duration_min }), r.is_rest_day && t('modules.meta.restDay')) }),

  mod('reading', 'reading', 'book-outline', 'reading-items', 'mind', 'title', [
    f('reading', 'title', 'title', 'text', { required: true }), f('reading', 'author', 'author', 'text'),
    f('reading', 'status', 'status', 'select', { options: opt('want', 'reading', 'done'), default: 'want' }),
    f('reading', 'total', 'total_pages', 'number'), f('reading', 'current', 'current_page', 'number'), f('reading', 'lessons', 'lessons', 'multiline')],
    { meta: (r, t) => join(lab(t, r.status), r.total_pages && t('modules.meta.pages', { cur: r.current_page ?? 0, total: r.total_pages })), doneValue: (r) => r.status === 'done', donePatch: (n) => ({ status: n ? 'done' : 'reading' }) }),
  mod('sessions', 'sessions', 'timer-outline', 'reading-sessions', 'mind', 'kind', [
    f('sessions', 'kind', 'kind', 'select', { required: true, options: opt('reading', 'study', 'meditation', 'speaking', 'listening'), default: 'reading' }),
    f('sessions', 'minutes', 'minutes', 'number', { required: true }), f('sessions', 'pages', 'pages', 'number'), f('sessions', 'date', 'session_on', 'date', { today: true })],
    { meta: (r, t) => join(t('modules.meta.minutes', { n: r.minutes }), D(r.session_on)) }),
  mod('notes', 'notes', 'bulb-outline', 'learning-notes', 'mind', 'title', [
    f('notes', 'title', 'title', 'text', { required: true }), f('notes', 'note', 'content', 'multiline')], { meta: (r) => D(r.created_at) }),

  mod('relationships', 'relationships', 'heart-outline', 'relationship-notes', 'life', 'title', [
    f('relationships', 'title', 'title', 'text', { required: true }), f('relationships', 'person', 'person', 'text'),
    f('relationships', 'kind', 'kind', 'select', { options: opt('important_date', 'follow_up', 'activity', 'reflection', 'boundary', 'value'), default: 'follow_up' }),
    f('relationships', 'date', 'note_date', 'date'), f('relationships', 'notes', 'content', 'multiline')],
    { meta: (r, t) => join(r.person, lab(t, r.kind), D(r.note_date)), doneValue: (r) => !!r.is_done, donePatch: (n) => ({ is_done: n }) }),
  mod('reminders', 'reminders', 'notifications-outline', 'reminders', 'life', 'title', [
    f('reminders', 'title', 'title', 'text', { required: true }),
    f('reminders', 'about', 'kind', 'select', { required: true, options: opt('daily_tasks', 'habit', 'reading', 'workout', 'finance_review', 'weekly_review', 'monthly_review', 'custom'), default: 'custom' }),
    f('reminders', 'time', 'remind_time', 'time', { required: true, placeholder: 'modules.ph.time' })],
    { meta: (r, t) => join(r.remind_time, t(r.is_enabled ? 'modules.meta.on' : 'modules.meta.off')), doneValue: (r) => !!r.is_enabled, donePatch: (n) => ({ is_enabled: n }) }),
];

export const findModule = (key: string) => MODULES.find((m) => m.key === key);

/** Expense/budget categories are stored as lowercase keys; older rows may be capitalised, and custom ones show as typed. */
export const categoryLabel = (t: TFunction, c: string) => String(t(`modules.opt.${String(c).toLowerCase()}`, { defaultValue: c }));
