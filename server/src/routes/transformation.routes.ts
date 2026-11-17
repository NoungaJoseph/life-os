import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { quitStreak, weekStart } from '../services/transformation';
import { asyncHandler } from '../utils/asyncHandler';
import { dbFail } from '../utils/dbError';
import { notFound } from '../utils/errors';
import { created, ok } from '../utils/response';
import { uuidParam } from '../validators/schemas';

export const transformationRouter = Router();
const uuid = z.string().uuid();
const areaBody = z.object({
  category: z.enum(['relationships', 'addictions', 'health', 'finance', 'character']),
  title: z.string().trim().min(2).max(100),
  current_self: z.string().trim().max(4000).default(''),
  target_self: z.string().trim().max(4000).default(''),
  reason: z.string().trim().max(2000).default(''),
  goal_id: uuid.nullable().optional(),
}).strict();
const behaviorBody = z.object({ title: z.string().trim().min(2).max(100), direction: z.enum(['build', 'quit']), habit_id: uuid.nullable().optional() }).strict();
const eventBody = z.object({ kind: z.enum(['urge', 'relapse', 'success']), trigger_note: z.string().trim().max(1000).default('') }).strict();
const checkinBody = z.object({ current_score: z.number().int().min(1).max(10), target_score: z.number().int().min(1).max(10), note: z.string().trim().max(1000).default('') }).strict();
const must = <T>(result: { data: T | null; error: { message: string; code?: string } | null }): T => { if (result.error) throw dbFail(result.error); return result.data as T; };

async function ownArea(req: any, id: string) {
  const area = must<any>(await req.db.from('transformation_areas').select('*').eq('id', id).eq('user_id', req.userId).maybeSingle());
  if (!area) throw notFound('Transformation area not found');
  return area;
}
async function ownBehavior(req: any, id: string) {
  const behavior = must<any>(await req.db.from('transformation_behaviors').select('*').eq('id', id).eq('user_id', req.userId).maybeSingle());
  if (!behavior) throw notFound('Behavior not found');
  return behavior;
}
async function ownedLink(req: any, table: 'goals' | 'habits', id?: string | null) {
  if (!id) return;
  const linked = must<any>(await req.db.from(table).select('id').eq('id', id).eq('user_id', req.userId).maybeSingle());
  if (!linked) throw notFound('Linked goal or habit not found');
}

transformationRouter.get('/transformation', asyncHandler(async (req, res) => {
  const result = await req.db!.from('transformation_areas').select('*').eq('user_id', req.userId!).order('created_at', { ascending: false });
  if (result.error && (result.error.code === 'PGRST205' || /transformation_areas/i.test(result.error.message))) return ok(res, []);
  const areas = must<any[]>(result);
  ok(res, areas);
}));
transformationRouter.post('/transformation', validate(areaBody), asyncHandler(async (req, res) => {
  await ownedLink(req, 'goals', req.body.goal_id);
  const row = must<any>(await req.db!.from('transformation_areas').insert({ ...req.body, user_id: req.userId }).select().single());
  created(res, row);
}));
transformationRouter.get('/transformation/:id', validate(uuidParam, 'params'), asyncHandler(async (req, res) => {
  const area = await ownArea(req, req.params.id);
  const [behaviorsResult, checkinsResult] = await Promise.all([
    req.db!.from('transformation_behaviors').select('*').eq('area_id', area.id).eq('user_id', req.userId!),
    req.db!.from('transformation_checkins').select('*').eq('area_id', area.id).eq('user_id', req.userId!).order('week_start', { ascending: false }).limit(52),
  ]);
  const behaviors = must<any[]>(behaviorsResult);
  const checkins = must<any[]>(checkinsResult);
  const ids = behaviors.map((row) => row.id);
  const events = ids.length ? must<any[]>(await req.db!.from('transformation_events').select('*').eq('user_id', req.userId!).in('behavior_id', ids).order('occurred_at', { ascending: false }).limit(1000)) : [];
  const today = new Date().toISOString().slice(0, 10);
  ok(res, { ...area, behaviors: behaviors.map((row) => ({ ...row, events: events.filter((event) => event.behavior_id === row.id), streak: row.direction === 'quit' ? quitStreak(row.started_on, events.filter((event) => event.behavior_id === row.id), today) : null })), checkins });
}));
transformationRouter.patch('/transformation/:id', validate(uuidParam, 'params'), validate(areaBody.partial()), asyncHandler(async (req, res) => {
  await ownArea(req, req.params.id);
  await ownedLink(req, 'goals', req.body.goal_id);
  const row = must<any>(await req.db!.from('transformation_areas').update({ ...req.body, updated_at: new Date().toISOString() }).eq('id', req.params.id).eq('user_id', req.userId!).select().single());
  ok(res, row);
}));
transformationRouter.delete('/transformation/:id', validate(uuidParam, 'params'), asyncHandler(async (req, res) => {
  await ownArea(req, req.params.id);
  must(await req.db!.from('transformation_areas').delete().eq('id', req.params.id).eq('user_id', req.userId!));
  ok(res, { deleted: true });
}));
transformationRouter.post('/transformation/:id/behaviors', validate(uuidParam, 'params'), validate(behaviorBody), asyncHandler(async (req, res) => {
  await ownArea(req, req.params.id);
  await ownedLink(req, 'habits', req.body.habit_id);
  const row = must<any>(await req.db!.from('transformation_behaviors').insert({ ...req.body, area_id: req.params.id, user_id: req.userId }).select().single());
  created(res, row);
}));
transformationRouter.post('/transformation/behaviors/:id/events', validate(uuidParam, 'params'), validate(eventBody), asyncHandler(async (req, res) => {
  const behavior = await ownBehavior(req, req.params.id);
  if (behavior.direction !== 'quit' && req.body.kind !== 'success') throw notFound('Quit behavior not found');
  const row = must<any>(await req.db!.from('transformation_events').insert({ ...req.body, behavior_id: behavior.id, user_id: req.userId }).select().single());
  created(res, row);
}));
transformationRouter.put('/transformation/:id/checkin', validate(uuidParam, 'params'), validate(checkinBody), asyncHandler(async (req, res) => {
  await ownArea(req, req.params.id);
  const week = weekStart(new Date().toISOString().slice(0, 10));
  const row = must<any>(await req.db!.from('transformation_checkins').upsert({ ...req.body, user_id: req.userId, area_id: req.params.id, week_start: week }, { onConflict: 'user_id,area_id,week_start' }).select().single());
  ok(res, row);
}));
