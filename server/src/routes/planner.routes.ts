import { Router } from 'express';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, notFound } from '../utils/errors';
import { assertOwned } from '../utils/ownership';
import { toRange } from '../utils/pagination';
import { created, ok } from '../utils/response';
import {
  createHabitSchema, createJournalSchema, createMilestoneSchema, createTaskSchema, habitDayParams, listJournalQuery, listTasksQuery,
  milestoneParams, updateGoalSchema, updateHabitSchema, updateMilestoneSchema, updateTaskSchema, uuidParam,
} from '../validators/schemas';

export const plannerRouter = Router();
const db500 = (m: string) => new AppError(500, 'DB_ERROR', m);

// ---------------- Tasks ----------------
plannerRouter.get('/tasks', validate(listTasksQuery, 'query'), asyncHandler(async (req, res) => {
  const { from, to, status, goal_id, page, pageSize } = req.query as any;
  const { from: a, to: b } = toRange(page, pageSize);
  let q = req.db!.from('tasks').select('*', { count: 'exact' }).eq('user_id', req.userId!);
  if (status === 'open') q = q.is('completed_at', null);
  if (status === 'done') q = q.not('completed_at', 'is', null);
  if (from) q = q.gte('due_date', from);
  if (to) q = q.lte('due_date', to);
  if (goal_id) q = q.eq('goal_id', goal_id);
  const { data, error, count } = await q.order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }).range(a, b);
  if (error) throw db500(error.message);
  ok(res, data, { page, pageSize, total: count ?? 0 });
}));

plannerRouter.post('/tasks', validate(createTaskSchema), asyncHandler(async (req, res) => {
  await assertOwned(req.db!, 'goals', req.body.goal_id, req.userId!, 'Goal');
  const { data, error } = await req.db!.from('tasks').insert({ ...req.body, user_id: req.userId! }).select().single();
  if (error) throw db500(error.message);
  created(res, data);
}));

plannerRouter.patch('/tasks/:id', validate(uuidParam, 'params'), validate(updateTaskSchema), asyncHandler(async (req, res) => {
  const { completed, ...patch } = req.body as { completed?: boolean } & Record<string, unknown>;
  await assertOwned(req.db!, 'goals', patch.goal_id as string | undefined, req.userId!, 'Goal');
  if (completed !== undefined) patch.completed_at = completed ? new Date().toISOString() : null;
  const { data, error } = await req.db!.from('tasks').update(patch).eq('id', req.params.id).eq('user_id', req.userId!).select().maybeSingle();
  if (error) throw db500(error.message);
  if (!data) throw notFound('Task not found');
  ok(res, data);
}));

plannerRouter.delete('/tasks/:id', validate(uuidParam, 'params'), asyncHandler(async (req, res) => {
  const { error } = await req.db!.from('tasks').delete().eq('id', req.params.id).eq('user_id', req.userId!);
  if (error) throw db500(error.message);
  ok(res, { deleted: true });
}));

// ---------------- Habits ----------------
plannerRouter.get('/habits', asyncHandler(async (req, res) => {
  const { data, error } = await req.db!.from('habits').select('*').eq('user_id', req.userId!).is('archived_at', null).order('created_at');
  if (error) throw db500(error.message);
  ok(res, data);
}));

plannerRouter.post('/habits', validate(createHabitSchema), asyncHandler(async (req, res) => {
  await assertOwned(req.db!, 'goals', req.body.goal_id, req.userId!, 'Goal');
  if (['custom'].includes(req.body.frequency) && !req.body.days_of_week?.length) {
    throw new AppError(400, 'BAD_REQUEST', 'Pick at least one day for a custom schedule');
  }
  const { data, error } = await req.db!.from('habits').insert({ ...req.body, user_id: req.userId! }).select().single();
  if (error) throw db500(error.message);
  created(res, data);
}));

plannerRouter.patch('/habits/:id', validate(uuidParam, 'params'), validate(updateHabitSchema), asyncHandler(async (req, res) => {
  const { paused, archived, ...patch } = req.body as { paused?: boolean; archived?: boolean } & Record<string, unknown>;
  await assertOwned(req.db!, 'goals', patch.goal_id as string | undefined, req.userId!, 'Goal');
  if (paused !== undefined) patch.paused_at = paused ? new Date().toISOString() : null;
  if (archived !== undefined) patch.archived_at = archived ? new Date().toISOString() : null;
  const { data, error } = await req.db!.from('habits').update(patch).eq('id', req.params.id).eq('user_id', req.userId!).select().maybeSingle();
  if (error) throw db500(error.message);
  if (!data) throw notFound('Habit not found');
  ok(res, data);
}));

// Mark a habit done / not done for a calendar date (idempotent)
plannerRouter.put('/habits/:id/completions/:date', validate(habitDayParams, 'params'), asyncHandler(async (req, res) => {
  await assertOwned(req.db!, 'habits', req.params.id, req.userId!, 'Habit');
  const { data, error } = await req.db!.from('habit_completions')
    .upsert({ user_id: req.userId!, habit_id: req.params.id, completed_on: req.params.date }, { onConflict: 'habit_id,completed_on' })
    .select().single();
  if (error) throw db500(error.message);
  ok(res, data);
}));
plannerRouter.delete('/habits/:id/completions/:date', validate(habitDayParams, 'params'), asyncHandler(async (req, res) => {
  const { error } = await req.db!.from('habit_completions').delete()
    .eq('habit_id', req.params.id).eq('completed_on', req.params.date).eq('user_id', req.userId!);
  if (error) throw db500(error.message);
  ok(res, { deleted: true });
}));

// ---------------- Goal updates, milestones ----------------
plannerRouter.patch('/goals/:id', validate(uuidParam, 'params'), validate(updateGoalSchema), asyncHandler(async (req, res) => {
  const patch = { ...req.body } as Record<string, unknown>;
  if (patch.parent_goal_id === req.params.id) throw new AppError(400, 'BAD_REQUEST', 'A goal cannot be its own parent');
  await assertOwned(req.db!, 'goals', patch.parent_goal_id as string | undefined, req.userId!, 'Parent goal');
  if (patch.status === 'completed') patch.completed_at = new Date().toISOString();
  else if (patch.status) patch.completed_at = null;
  const { data, error } = await req.db!.from('goals').update(patch).eq('id', req.params.id).eq('user_id', req.userId!).select().maybeSingle();
  if (error) throw db500(error.message);
  if (!data) throw notFound('Goal not found');
  ok(res, data);
}));

plannerRouter.delete('/goals/:id', validate(uuidParam, 'params'), asyncHandler(async (req, res) => {
  const { error } = await req.db!.from('goals').delete().eq('id', req.params.id).eq('user_id', req.userId!);
  if (error) throw db500(error.message);
  ok(res, { deleted: true });
}));

plannerRouter.get('/goals/:id/milestones', validate(uuidParam, 'params'), asyncHandler(async (req, res) => {
  const { data, error } = await req.db!.from('goal_milestones').select('*').eq('goal_id', req.params.id).eq('user_id', req.userId!).order('sort_order').order('created_at');
  if (error) throw db500(error.message);
  ok(res, data);
}));
plannerRouter.post('/goals/:id/milestones', validate(uuidParam, 'params'), validate(createMilestoneSchema), asyncHandler(async (req, res) => {
  await assertOwned(req.db!, 'goals', req.params.id, req.userId!, 'Goal');
  const { data, error } = await req.db!.from('goal_milestones').insert({ ...req.body, goal_id: req.params.id, user_id: req.userId! }).select().single();
  if (error) throw db500(error.message);
  created(res, data);
}));
plannerRouter.patch('/goals/:id/milestones/:milestoneId', validate(milestoneParams, 'params'), validate(updateMilestoneSchema), asyncHandler(async (req, res) => {
  const { completed, ...patch } = req.body as { completed?: boolean } & Record<string, unknown>;
  if (completed !== undefined) patch.completed_at = completed ? new Date().toISOString() : null;
  const { data, error } = await req.db!.from('goal_milestones').update(patch)
    .eq('id', req.params.milestoneId).eq('goal_id', req.params.id).eq('user_id', req.userId!).select().maybeSingle();
  if (error) throw db500(error.message);
  if (!data) throw notFound('Milestone not found');
  ok(res, data);
}));
plannerRouter.delete('/goals/:id/milestones/:milestoneId', validate(milestoneParams, 'params'), asyncHandler(async (req, res) => {
  const { error } = await req.db!.from('goal_milestones').delete().eq('id', req.params.milestoneId).eq('goal_id', req.params.id).eq('user_id', req.userId!);
  if (error) throw db500(error.message);
  ok(res, { deleted: true });
}));

// ---------------- Journal ----------------
plannerRouter.get('/journal', validate(listJournalQuery, 'query'), asyncHandler(async (req, res) => {
  const { page, pageSize } = req.query as any;
  const { from, to } = toRange(page, pageSize);
  const { data, error, count } = await req.db!.from('journal_entries').select('*', { count: 'exact' })
    .eq('user_id', req.userId!).order('entry_date', { ascending: false }).order('created_at', { ascending: false }).range(from, to);
  if (error) throw db500(error.message);
  ok(res, data, { page, pageSize, total: count ?? 0 });
}));
plannerRouter.post('/journal', validate(createJournalSchema), asyncHandler(async (req, res) => {
  const { data, error } = await req.db!.from('journal_entries').insert({ ...req.body, user_id: req.userId! }).select().single();
  if (error) throw db500(error.message);
  created(res, data);
}));
plannerRouter.delete('/journal/:id', validate(uuidParam, 'params'), asyncHandler(async (req, res) => {
  const { error } = await req.db!.from('journal_entries').delete().eq('id', req.params.id).eq('user_id', req.userId!);
  if (error) throw db500(error.message);
  ok(res, { deleted: true });
}));
