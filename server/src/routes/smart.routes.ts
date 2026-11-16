import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate';
import { aiEnabled, breakDownGoal, coach, reflect } from '../services/ai';
import { loadSnapshot } from '../services/snapshot';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, notFound } from '../utils/errors';
import { ok } from '../utils/response';
import { breakdownSchema, coachSchema, reflectSchema } from '../validators/schemas';
import { habitDueOn } from '../services/insights';
import { localDate } from '../services/dates';

export const smartRouter = Router();
const requestLang = (req: { body?: { lang?: 'en' | 'fr' }; get(name: string): string | undefined }): 'en' | 'fr' =>
  req.body?.lang ?? (req.get('Accept-Language')?.toLowerCase().startsWith('fr') ? 'fr' : 'en');

const PRIORITY = { high: 0, medium: 1, low: 2 } as const;

smartRouter.get('/dashboard/today', asyncHandler(async (req, res) => {
  const s = await loadSnapshot(req.db!, req.userId!);

  const openTasks = s.tasks.filter((t) => !t.completed_at && t.due_date && t.due_date <= s.today)
    .sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority] || (a.due_date! < b.due_date! ? -1 : 1))
    .map((t) => ({ ...t, overdue: t.due_date! < s.today }));
  const doneToday = s.tasks.filter((t) => t.completed_at && localDate(t.completed_at, s.tz) === s.today).length;
  const dueHabits = s.habits.filter((h) => habitDueOn(h, s.today) || s.statsById[h.id].completed_today)
    .map((h) => ({ ...h, stats: s.statsById[h.id] }));

  const goals = s.goalViews.filter((g) => g.status === 'active')
    .sort((a, b) => ['weekly', 'monthly', 'quarterly', 'annual', 'long_term', 'daily'].indexOf(a.goal_type) - ['weekly', 'monthly', 'quarterly', 'annual', 'long_term', 'daily'].indexOf(b.goal_type))
    .slice(0, 6);

  ok(res, {
    date: s.today,
    display_name: s.profile.display_name,
    momentum: s.momentum,
    summary: {
      tasks_open: openTasks.length, tasks_done_today: doneToday,
      habits_due: dueHabits.length, habits_done: dueHabits.filter((h) => h.stats.completed_today).length,
    },
    priorities: openTasks.slice(0, 8),
    habits: dueHabits,
    goals,
    balance: s.balance,
    insights: s.insights.slice(0, 6),
    ai_enabled: aiEnabled(),
  });
}));

smartRouter.get('/insights', asyncHandler(async (req, res) => {
  const s = await loadSnapshot(req.db!, req.userId!);
  ok(res, {
    momentum: s.momentum, insights: s.insights, balance: s.balance, behavior: s.behavior,
    habits: s.habits.map((h) => ({ id: h.id, name: h.name, ...s.statsById[h.id] })),
    goals: s.goalViews.map((g) => ({ id: g.id, title: g.title, progress: g.progress, projection: g.projection })),
  });
}));

// All goals with real progress and pace projections
smartRouter.get('/goals-overview', asyncHandler(async (req, res) => {
  const s = await loadSnapshot(req.db!, req.userId!);
  ok(res, s.goalViews);
}));

// ---------------- AI (Claude) ----------------
const aiLimiter = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many AI requests. Wait a minute and try again.' } } });

smartRouter.use('/ai', aiLimiter);

smartRouter.post('/ai/coach', validate(coachSchema), asyncHandler(async (req, res) => {
  const s = await loadSnapshot(req.db!, req.userId!);
  ok(res, { reply: await coach(s, req.body.message, requestLang(req)) });
}));

smartRouter.post('/ai/goal-breakdown', validate(breakdownSchema), asyncHandler(async (req, res) => {
  const { data } = await req.db!.from('profiles').select('timezone').eq('id', req.userId!).maybeSingle();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: data?.timezone ?? 'UTC' }).format(new Date());
  ok(res, { steps: await breakDownGoal(req.body, today, requestLang(req)) });
}));

smartRouter.post('/ai/reflect', validate(reflectSchema), asyncHandler(async (req, res) => {
  const { data, error } = await req.db!.from('journal_entries').select('content,mood,entry_date')
    .eq('id', req.body.journal_id).eq('user_id', req.userId!).maybeSingle();
  if (error) throw new AppError(500, 'DB_ERROR', error.message);
  if (!data) throw notFound('Journal entry not found');
  ok(res, { reply: await reflect(data, requestLang(req)) });
}));
