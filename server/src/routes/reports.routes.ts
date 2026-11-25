import { createHmac, timingSafeEqual } from 'node:crypto';
import { Request, Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { adminClient } from '../config/supabase';
import { validate } from '../middleware/validate';
import { loadMonthlyReport } from '../services/monthly-report';
import { renderMonthlyReportPdf } from '../services/monthly-report-pdf';
import { asyncHandler } from '../utils/asyncHandler';
import { forbidden } from '../utils/errors';
import { ok } from '../utils/response';

const monthParam = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM') });
const langQuery = z.object({ lang: z.enum(['en', 'fr']).optional() });

function signReportToken(userId: string, month: string, lang: 'en' | 'fr', exp: number): string {
  return createHmac('sha256', env.PAYMENTS_WEBHOOK_SECRET)
    .update(`report:${userId}:${month}:${lang}:${exp}`)
    .digest('hex');
}

function verifyReportToken(userId: string, month: string, lang: 'en' | 'fr', exp: number, sig: string): boolean {
  if (!Number.isFinite(exp) || Date.now() > exp || !sig) return false;
  const expected = Buffer.from(signReportToken(userId, month, lang, exp), 'hex');
  const actual = Buffer.from(sig, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function detectLang(req: Request): 'en' | 'fr' {
  const q = req.query.lang;
  if (q === 'fr' || q === 'en') return q;
  return req.get('Accept-Language')?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export const reportsRouter = Router();

reportsRouter.get('/reports/monthly/:month', validate(monthParam, 'params'), asyncHandler(async (req, res) => {
  const data = await loadMonthlyReport(req.db!, req.userId!, req.params.month);
  ok(res, data);
}));

reportsRouter.get('/reports/monthly/:month/pdf', validate(monthParam, 'params'), validate(langQuery, 'query'), asyncHandler(async (req, res) => {
  const lang = detectLang(req);
  const data = await loadMonthlyReport(req.db!, req.userId!, req.params.month);
  const pdf = renderMonthlyReportPdf(data, lang);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="my-life-os-${req.params.month}.pdf"`);
  res.status(200).send(pdf);
}));

reportsRouter.post('/reports/monthly/:month/download-link', validate(monthParam, 'params'), validate(langQuery, 'query'), asyncHandler(async (req, res) => {
  const lang = detectLang(req);
  const exp = Date.now() + 10 * 60_000;
  const sig = signReportToken(req.userId!, req.params.month, lang, exp);
  const origin = env.PUBLIC_API_URL?.trim().replace(/\/+$/, '') || `${req.protocol}://${req.get('host')}`;
  const url = `${origin}/reports/monthly-pdf?u=${encodeURIComponent(req.userId!)}&m=${encodeURIComponent(req.params.month)}&lang=${lang}&exp=${exp}&sig=${sig}`;
  ok(res, {
    url,
    filename: `my-life-os-${req.params.month}.pdf`,
    expires_at: new Date(exp).toISOString(),
  });
}));

export const publicReportsRouter = Router();
const publicPdfQuery = z.object({
  u: z.string().uuid(),
  m: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  lang: z.enum(['en', 'fr']).default('en'),
  exp: z.coerce.number().int(),
  sig: z.string().min(16),
});

publicReportsRouter.get('/monthly-pdf', validate(publicPdfQuery, 'query'), asyncHandler(async (req, res) => {
  const { u, m, lang, exp, sig } = req.query as unknown as z.infer<typeof publicPdfQuery>;
  if (!verifyReportToken(u, m, lang, exp, sig)) {
    throw forbidden('Invalid or expired report link');
  }
  const data = await loadMonthlyReport(adminClient, u, m);
  const pdf = renderMonthlyReportPdf(data, lang);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="my-life-os-${m}.pdf"`);
  res.status(200).send(pdf);
}));
