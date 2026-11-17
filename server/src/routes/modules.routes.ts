import { Router } from 'express';
import { z } from 'zod';
import { adminClient } from '../config/supabase';
import { validate } from '../middleware/validate';
import { mountResource } from '../modules/crud';
import { resources } from '../modules/resources';
import { addDays, monthKey, weekStart } from '../services/dates';
import { summarizeDebts, summarizeFinance } from '../services/finance';
import { asyncHandler } from '../utils/asyncHandler';
import { dbFail } from '../utils/dbError';
import { AppError, notFound } from '../utils/errors';
import { ok } from '../utils/response';
import { isoDate, uuidParam } from '../validators/schemas';

export const modulesRouter = Router();
resources.forEach((r) => mountResource(modulesRouter, r));

const todayUtc = () => new Date().toISOString().slice(0, 10);
const monthEnd = (first: string) => { const d = new Date(`${first}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return d.toISOString().slice(0, 10); };
const must = <T>(r: { data: T | null; error: { message: string; code?: string } | null }): T => { if (r.error) throw dbFail(r.error); return (r.data ?? []) as T; };

/** Counts of the user's real activity in a date window; used to pre-fill reviews. Numbers only, no text content. */
async function activityStats(db: any, uid: string, from: string, to: string) {
  const [tasks, habits, journal, workouts, reading, water] = await Promise.all([
    db.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', uid).gte('completed_at', `${from}T00:00:00Z`).lte('completed_at', `${to}T23:59:59Z`),
    db.from('habit_completions').select('id', { count: 'exact', head: true }).eq('user_id', uid).gte('completed_on', from).lte('completed_on', to),
    db.from('journal_entries').select('id', { count: 'exact', head: true }).eq('user_id', uid).gte('entry_date', from).lte('entry_date', to),
    db.from('workout_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('is_rest_day', false).gte('logged_on', from).lte('logged_on', to),
    db.from('reading_sessions').select('minutes').eq('user_id', uid).gte('session_on', from).lte('session_on', to),
    db.from('water_logs').select('amount_ml').eq('user_id', uid).gte('logged_on', from).lte('logged_on', to),
  ]);
  for (const r of [tasks, habits, journal, workouts, reading, water]) if (r.error) throw dbFail(r.error);
  const sum = (rows: any[] | null, k: string) => (rows ?? []).reduce((s, r) => s + Number(r[k] || 0), 0);
  return {
    tasks_completed: tasks.count ?? 0, habit_checkins: habits.count ?? 0, journal_entries: journal.count ?? 0,
    workouts: workouts.count ?? 0, reading_minutes: sum(reading.data, 'minutes'), water_ml: sum(water.data, 'amount_ml'),
  };
}

// ---- Reviews (weekly / monthly): stats are computed server-side, answers are the user's own words
const reviewBody = z.object({
  answers: z.record(z.string().max(4000)).default({}),
  next_priorities: z.array(z.string().trim().min(1).max(200)).max(5).default([]),
}).strict();
const periodQuery = z.object({ date: isoDate.default(todayUtc) });

for (const kind of ['weekly', 'monthly'] as const) {
  const table = `${kind}_reviews`, col = kind === 'weekly' ? 'week_start' : 'month';
  const bounds = (d: string) => kind === 'weekly' ? { start: weekStart(d), end: addDays(weekStart(d), 6) } : { start: `${monthKey(d)}-01`, end: monthEnd(`${monthKey(d)}-01`) };

  // Current period: stats plus any saved review
  modulesRouter.get(`/reviews/${kind}/current`, validate(periodQuery, 'query'), asyncHandler(async (req, res) => {
    const { start, end } = bounds((req.query as any).date);
    const stats = await activityStats(req.db, req.userId!, start, end);
    const saved = must<any>(await req.db!.from(table).select('*').eq('user_id', req.userId!).eq(col, start).maybeSingle());
    ok(res, { period_start: start, period_end: end, stats, review: Array.isArray(saved) ? null : saved });
  }));

  modulesRouter.put(`/reviews/${kind}/:date`, validate(z.object({ date: isoDate }), 'params'), validate(reviewBody), asyncHandler(async (req, res) => {
    const { start, end } = bounds(req.params.date);
    const stats = await activityStats(req.db, req.userId!, start, end);
    const row = { user_id: req.userId!, [col]: start, answers: req.body.answers, next_priorities: req.body.next_priorities, stats };
    const { data, error } = await req.db!.from(table).upsert(row, { onConflict: `user_id,${col}` }).select().single();
    if (error) throw dbFail(error);
    ok(res, data);
  }));

  modulesRouter.get(`/reviews/${kind}`, asyncHandler(async (req, res) => {
    const { data, error } = await req.db!.from(table).select('*').eq('user_id', req.userId!).order(col, { ascending: false }).limit(52);
    if (error) throw dbFail(error);
    ok(res, data);
  }));
}

// ---- Finance summary for a month (manual records only; no bank connections)
modulesRouter.get('/finance/summary', validate(z.object({ month: isoDate.optional() }), 'query'), asyncHandler(async (req, res) => {
  const first = `${monthKey((req.query as any).month ?? todayUtc())}-01`, last = monthEnd(first), uid = req.userId!, db = req.db!;
  const [profile, inc, exp, bud, sg, tx] = await Promise.all([
    db.from('profiles').select('currency').eq('id', uid).maybeSingle(),
    db.from('income_records').select('amount,category,currency').eq('user_id', uid).gte('received_on', first).lte('received_on', last),
    db.from('expense_records').select('amount,category,currency').eq('user_id', uid).gte('spent_on', first).lte('spent_on', last),
    db.from('budgets').select('category,amount').eq('user_id', uid).eq('month', first),
    db.from('savings_goals').select('id,name,kind,target_amount').eq('user_id', uid),
    db.from('savings_transactions').select('savings_goal_id,amount').eq('user_id', uid),
  ]);
  ok(res, { month: first, ...summarizeFinance({
    currency: (profile.data as any)?.currency ?? 'XAF',
    income: must<any[]>(inc), expenses: must<any[]>(exp), budgets: must<any[]>(bud), savings: must<any[]>(sg), savingsTx: must<any[]>(tx),
  }) });
}));

// ---- Debts overview (balances come from recorded payments)
modulesRouter.get('/debts/overview', asyncHandler(async (req, res) => {
  const uid = req.userId!, db = req.db!;
  const [d, p] = await Promise.all([db.from('debts').select('*').eq('user_id', uid), db.from('debt_payments').select('debt_id,amount').eq('user_id', uid)]);
  ok(res, summarizeDebts(must<any[]>(d), must<any[]>(p), todayUtc()));
}));

// ---- Push tokens (Expo). Only the signed-in user's own device tokens.
const tokenBody = z.object({ token: z.string().regex(/^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/, 'Not an Expo push token'), platform: z.enum(['ios', 'android', 'web']).optional() }).strict();
modulesRouter.put('/push-tokens', validate(tokenBody), asyncHandler(async (req, res) => {
  const { error } = await req.db!.from('push_tokens').upsert({ ...req.body, user_id: req.userId! }, { onConflict: 'user_id,token' });
  if (error) throw dbFail(error);
  ok(res, { registered: true });
}));
modulesRouter.delete('/push-tokens', validate(z.object({ token: z.string().max(200) }).strict()), asyncHandler(async (req, res) => {
  const { error } = await req.db!.from('push_tokens').delete().eq('user_id', req.userId!).eq('token', req.body.token);
  if (error) throw dbFail(error);
  ok(res, { removed: true });
}));

// ---- Project dashboard
modulesRouter.get('/projects/:id/dashboard', validate(uuidParam, 'params'), asyncHandler(async (req, res) => {
  const uid = req.userId!, db = req.db!, id = req.params.id;
  const proj = must<any>(await db.from('projects').select('*').eq('id', id).eq('user_id', uid).maybeSingle());
  if (!proj || Array.isArray(proj)) throw notFound('Project not found');
  const [tasks, metrics, inc, exp] = await Promise.all([
    db.from('project_tasks').select('id,title,status,priority,kind,due_date').eq('user_id', uid).eq('project_id', id),
    db.from('project_metrics').select('metric,value,unit,recorded_on').eq('user_id', uid).eq('project_id', id).order('recorded_on', { ascending: false }).limit(200),
    db.from('income_records').select('amount').eq('user_id', uid).eq('project_id', id),
    db.from('expense_records').select('amount').eq('user_id', uid).eq('project_id', id),
  ]);
  const t = must<any[]>(tasks), today = todayUtc();
  const latest = new Map<string, any>();
  for (const m of must<any[]>(metrics)) if (!latest.has(m.metric)) latest.set(m.metric, m);
  const total = (rows: any[]) => rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const revenue = total(must<any[]>(inc)), costs = total(must<any[]>(exp));
  ok(res, {
    project: proj,
    tasks: { total: t.length, done: t.filter((x) => x.status === 'done').length, doing: t.filter((x) => x.status === 'doing').length,
      overdue: t.filter((x) => x.status !== 'done' && x.due_date && x.due_date < today).length,
      follow_ups: t.filter((x) => x.kind === 'follow_up' && x.status !== 'done') },
    metrics: [...latest.values()], revenue, costs, profit: revenue - costs,
  });
}));

// ---- Notification preferences (one row per user)
const prefsBody = z.object({
  quiet_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), quiet_end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  max_per_day: z.number().int().min(0).max(20), push_enabled: z.boolean(),
}).partial().strict();
const PREF_DEFAULTS = { quiet_start: '21:30', quiet_end: '07:00', max_per_day: 6, push_enabled: true };
modulesRouter.get('/notification-preferences', asyncHandler(async (req, res) => {
  const { data, error } = await req.db!.from('notification_preferences').select('*').eq('user_id', req.userId!).maybeSingle();
  if (error) throw dbFail(error);
  ok(res, data ?? PREF_DEFAULTS);
}));
modulesRouter.put('/notification-preferences', validate(prefsBody), asyncHandler(async (req, res) => {
  const { data, error } = await req.db!.from('notification_preferences').upsert({ ...PREF_DEFAULTS, ...req.body, user_id: req.userId! }, { onConflict: 'user_id' }).select().single();
  if (error) throw dbFail(error);
  ok(res, data);
}));

// ---- Privacy: export everything, delete the account
const EXPORT_TABLES = ['life_visions', 'user_life_areas', 'goals', 'goal_milestones', 'tasks', 'habits', 'habit_completions', 'journal_entries',
  ...resources.map((r) => r.table).filter((t) => t !== 'workouts'), 'weekly_reviews', 'monthly_reviews', 'notification_preferences', 'debt_payments',
  'wallets', 'ledger_accounts', 'transactions', 'payment_requests', 'vault_settings', 'release_requests', 'money_audit_log',
  'savings_group_members', 'savings_group_contributions', 'transformation_areas', 'transformation_behaviors', 'transformation_events', 'transformation_checkins'];
modulesRouter.get('/me/export', asyncHandler(async (req, res) => {
  const out: Record<string, unknown> = { exported_at: new Date().toISOString() };
  const prof = await req.db!.from('profiles').select('*').eq('id', req.userId!).maybeSingle();
  out.profiles = prof.data;
  for (const t of [...new Set(EXPORT_TABLES)]) {
    const { data, error } = await req.db!.from(t).select('*').eq('user_id', req.userId!).limit(10000);
    if (error) throw dbFail(error);
    out[t] = data;
  }
  const own = await req.db!.from('workouts').select('*').eq('user_id', req.userId!);
  out.workouts = own.data;
  const [createdGroups, sentNudges, receivedNudges] = await Promise.all([
    req.db!.from('savings_groups').select('*').eq('creator_id', req.userId!),
    req.db!.from('savings_group_nudges').select('*').eq('sender_id', req.userId!),
    req.db!.from('savings_group_nudges').select('*').eq('recipient_id', req.userId!),
  ]);
  out.savings_groups_created = createdGroups.data;
  out.savings_group_nudges = [...(sentNudges.data ?? []), ...(receivedNudges.data ?? [])].filter((row, index, all) => all.findIndex((item) => item.id === row.id) === index);
  res.setHeader('Content-Disposition', 'attachment; filename="my-life-os-export.json"');
  ok(res, out);
}));

modulesRouter.delete('/me', validate(z.object({ confirm: z.literal('DELETE') }).strict()), asyncHandler(async (req, res) => {
  const { error } = await adminClient.auth.admin.deleteUser(req.userId!); // cascades to profiles and every user table
  if (error) throw new AppError(500, 'DELETE_FAILED', 'Could not delete the account. Try again.');
  ok(res, { deleted: true });
}));
