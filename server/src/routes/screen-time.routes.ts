import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { activeCommitment, weakensCommitment } from '../services/screen-time';
import { asyncHandler } from '../utils/asyncHandler';
import { dbFail } from '../utils/dbError';
import { AppError, notFound } from '../utils/errors';
import { created, ok } from '../utils/response';
import { isoDate, uuidParam } from '../validators/schemas';

export const screenTimeRouter = Router();
const ruleBody = z.object({
  app_identifier: z.string().trim().min(3).max(200), app_name: z.string().trim().min(1).max(100),
  daily_limit_minutes: z.number().int().min(5).max(1440), block_minutes: z.union([z.literal(60), z.literal(120)]),
  commitment_mode: z.boolean().default(false), enabled: z.boolean().default(true),
}).strict();
const usageBody = z.object({ app_identifier: z.string().trim().min(3).max(200), used_on: isoDate, minutes: z.number().int().min(0).max(1440) }).strict();
const must = <T>(r: { data: T | null; error: { message: string; code?: string } | null }): T => { if (r.error) throw dbFail(r.error); return r.data as T; };
async function ownRule(req: any, id: string) {
  const rule = must<any>(await req.db.from('screen_time_rules').select('*').eq('id', id).eq('user_id', req.userId).maybeSingle());
  if (!rule) throw notFound('Screen-time rule not found');
  return rule;
}

screenTimeRouter.get('/screen-time/rules', asyncHandler(async (req, res) => {
  const r = await req.db!.from('screen_time_rules').select('*').eq('user_id', req.userId!).order('created_at', { ascending: false });
  if (r.error && (r.error.code === 'PGRST205' || /screen_time_rules/i.test(r.error.message))) return ok(res, []);
  ok(res, must<any[]>(r));
}));
screenTimeRouter.get('/screen-time/rules/:id', validate(uuidParam, 'params'), asyncHandler(async (req, res) => {
  ok(res, await ownRule(req, req.params.id));
}));
screenTimeRouter.post('/screen-time/rules', validate(ruleBody), asyncHandler(async (req, res) => {
  created(res, must<any>(await req.db!.from('screen_time_rules').insert({ ...req.body, user_id: req.userId }).select().single()));
}));
screenTimeRouter.patch('/screen-time/rules/:id', validate(uuidParam, 'params'), validate(ruleBody.partial()), asyncHandler(async (req, res) => {
  const rule = await ownRule(req, req.params.id);
  if (weakensCommitment(rule, req.body)) throw new AppError(409, 'COMMITMENT_ACTIVE', 'This block stays active until its end time');
  ok(res, must<any>(await req.db!.from('screen_time_rules').update(req.body).eq('id', rule.id).eq('user_id', req.userId!).select().single()));
}));
screenTimeRouter.delete('/screen-time/rules/:id', validate(uuidParam, 'params'), asyncHandler(async (req, res) => {
  const rule = await ownRule(req, req.params.id);
  if (activeCommitment(rule)) throw new AppError(409, 'COMMITMENT_ACTIVE', 'This block stays active until its end time');
  must(await req.db!.from('screen_time_rules').delete().eq('id', rule.id).eq('user_id', req.userId!));
  ok(res, { deleted: true });
}));
screenTimeRouter.post('/screen-time/rules/:id/block', validate(uuidParam, 'params'), asyncHandler(async (req, res) => {
  const rule = await ownRule(req, req.params.id);
  const until = new Date(Date.now() + rule.block_minutes * 60000).toISOString();
  const blockedUntil = rule.blocked_until && rule.blocked_until > until ? rule.blocked_until : until;
  ok(res, must<any>(await req.db!.from('screen_time_rules').update({ blocked_until: blockedUntil }).eq('id', rule.id).eq('user_id', req.userId!).select().single()));
}));
screenTimeRouter.get('/screen-time/usage', validate(z.object({ from: isoDate.optional(), to: isoDate.optional() }).strict(), 'query'), asyncHandler(async (req, res) => {
  let query = req.db!.from('screen_time_usage').select('*').eq('user_id', req.userId!).order('used_on', { ascending: false }).limit(500);
  if (req.query.from) query = query.gte('used_on', String(req.query.from));
  if (req.query.to) query = query.lte('used_on', String(req.query.to));
  const r = await query;
  if (r.error && (r.error.code === 'PGRST205' || /screen_time_usage/i.test(r.error.message))) return ok(res, []);
  ok(res, must<any[]>(r));
}));
screenTimeRouter.put('/screen-time/usage', validate(usageBody), asyncHandler(async (req, res) => {
  const rule = must<any>(await req.db!.from('screen_time_rules').select('id').eq('user_id', req.userId!).eq('app_identifier', req.body.app_identifier).maybeSingle());
  if (!rule) throw notFound('Screen-time rule not found');
  const key = { user_id: req.userId, app_identifier: req.body.app_identifier, used_on: req.body.used_on };
  const previous = must<any>(await req.db!.from('screen_time_usage').select('minutes').eq('user_id', req.userId!).eq('app_identifier', req.body.app_identifier).eq('used_on', req.body.used_on).maybeSingle());
  const minutes = Math.max(req.body.minutes, previous?.minutes ?? 0);
  ok(res, must<any>(await req.db!.from('screen_time_usage').upsert({ ...key, minutes, updated_at: new Date().toISOString() }, { onConflict: 'user_id,app_identifier,used_on' }).select().single()));
}));
