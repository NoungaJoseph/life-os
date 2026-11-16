import { Router } from 'express';
import { z, ZodTypeAny } from 'zod';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { dbFail } from '../utils/dbError';
import { notFound } from '../utils/errors';
import { assertOwned } from '../utils/ownership';
import { toRange } from '../utils/pagination';
import { created, ok } from '../utils/response';
import { isoDate, uuidParam } from '../validators/schemas';

export interface ResourceCfg {
  path: string;                       // URL segment under /api/v1
  table: string;
  label: string;                      // used in "not found" style messages
  shape: Record<string, ZodTypeAny>;  // writable columns
  required: string[];                 // required on create
  order: [string, boolean][];         // [column, ascending]
  filters?: string[];                 // equality filters allowed in the query string
  dateCol?: string;                   // enables ?from=&to=
  dateIsTimestamp?: boolean;
  refs?: Record<string, string>;      // column -> table whose rows must belong to the same user
  upsertOn?: string[];                // POST becomes an upsert on (user_id + these columns)
  includeBuiltIn?: boolean;           // also list rows with user_id = null (read-only built-ins)
  onUpdate?: (patch: Record<string, unknown>) => void;
}

const asFilter = (v: unknown): unknown => (v === 'true' ? true : v === 'false' ? false : v);

export function mountResource(router: Router, cfg: ResourceCfg) {
  const createSchema = z.object(Object.fromEntries(
    Object.entries(cfg.shape).map(([k, v]) => [k, cfg.required.includes(k) ? v : v.optional()]))).strict();
  const updateSchema = z.object(Object.fromEntries(
    Object.entries(cfg.shape).map(([k, v]) => [k, cfg.required.includes(k) ? v.optional() : v.nullable().optional()]))).strict();
  const listQuery = z.object({
    from: isoDate.optional(), to: isoDate.optional(),
    page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(200).default(100),
  }).passthrough();
  const base = `/${cfg.path}`;

  const checkRefs = async (req: any, body: Record<string, unknown>) => {
    for (const [col, table] of Object.entries(cfg.refs ?? {})) await assertOwned(req.db, table, body[col] as string | undefined, req.userId, cfg.label);
  };

  router.get(base, validate(listQuery, 'query'), asyncHandler(async (req, res) => {
    const { from, to, page, pageSize } = req.query as any;
    const { from: a, to: b } = toRange(page, pageSize);
    let q = req.db!.from(cfg.table).select('*', { count: 'exact' });
    q = cfg.includeBuiltIn ? q.or(`user_id.is.null,user_id.eq.${req.userId}`) : q.eq('user_id', req.userId!);
    for (const f of cfg.filters ?? []) if ((req.query as any)[f] !== undefined) q = q.eq(f, asFilter((req.query as any)[f]));
    if (cfg.dateCol && from) q = q.gte(cfg.dateCol, cfg.dateIsTimestamp ? `${from}T00:00:00Z` : from);
    if (cfg.dateCol && to) q = q.lte(cfg.dateCol, cfg.dateIsTimestamp ? `${to}T23:59:59Z` : to);
    for (const [col, asc] of cfg.order) q = q.order(col, { ascending: asc });
    const { data, error, count } = await q.range(a, b);
    if (error) throw dbFail(error);
    ok(res, data, { page, pageSize, total: count ?? 0 });
  }));

  router.post(base, validate(createSchema), asyncHandler(async (req, res) => {
    await checkRefs(req, req.body);
    const row = { ...req.body, user_id: req.userId! };
    const q = cfg.upsertOn
      ? req.db!.from(cfg.table).upsert(row, { onConflict: ['user_id', ...cfg.upsertOn].join(',') })
      : req.db!.from(cfg.table).insert(row);
    const { data, error } = await q.select().single();
    if (error) throw dbFail(error);
    created(res, data);
  }));

  router.patch(`${base}/:id`, validate(uuidParam, 'params'), validate(updateSchema), asyncHandler(async (req, res) => {
    await checkRefs(req, req.body);
    const patch = { ...req.body } as Record<string, unknown>;
    cfg.onUpdate?.(patch);
    if (Object.keys(patch).length === 0) throw notFound('Nothing to update');
    const { data, error } = await req.db!.from(cfg.table).update(patch).eq('id', req.params.id).eq('user_id', req.userId!).select().maybeSingle();
    if (error) throw dbFail(error);
    if (!data) throw notFound(`${cfg.label} not found`);
    ok(res, data);
  }));

  router.delete(`${base}/:id`, validate(uuidParam, 'params'), asyncHandler(async (req, res) => {
    const { error } = await req.db!.from(cfg.table).delete().eq('id', req.params.id).eq('user_id', req.userId!);
    if (error) throw dbFail(error);
    ok(res, { deleted: true });
  }));
}
