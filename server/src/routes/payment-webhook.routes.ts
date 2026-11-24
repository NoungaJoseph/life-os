import { Router } from 'express';
import { env } from '../config/env';
import { adminClient } from '../config/supabase';
import { paymentProvider } from '../services/payment-provider';
import { mapNkwaStatus, PaymentOperator, verifyHmac } from '../services/payments';
import { settlePayment } from '../services/wallet-ledger';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest, forbidden, notFound } from '../utils/errors';
import { ok } from '../utils/response';

export const paymentWebhookRouter = Router();
paymentWebhookRouter.post('/:provider', asyncHandler(async (req, res) => {
  const providerName = req.params.provider as PaymentOperator | 'nkwa';
  if (!['sandbox', 'mtn', 'orange', 'nkwa'].includes(providerName)) throw notFound();
  const signature = req.get('X-Payment-Signature') ?? req.get('X-Nkwa-Signature') ?? req.get('X-Webhook-Signature') ?? '';
  const raw = (req as any).rawBody ?? JSON.stringify(req.body);

  if (providerName === 'nkwa') {
    const secret = env.NKWA_PAY_WEBHOOK_SECRET?.trim() || env.PAYMENTS_WEBHOOK_SECRET;
    if (!verifyHmac(raw, signature, secret)) throw forbidden('Invalid webhook signature');
    const body = req.body ?? {};
    const reference = body.reference ?? body.id ?? body.payment?.id;
    const mapped = mapNkwaStatus(body.status ?? body.payment?.status);
    if (typeof reference !== 'string' || !reference || (mapped !== 'succeeded' && mapped !== 'failed')) {
      throw badRequest('Invalid webhook payload');
    }
    const eventId = typeof body.event_id === 'string' && body.event_id ? body.event_id : `nkwa:${reference}:${mapped}`;
    const event = await adminClient
      .from('payment_webhook_events')
      .insert({ provider: 'nkwa', event_id: eventId, provider_reference: reference, status: mapped, payload: body })
      .select()
      .maybeSingle();
    if (event.error?.code === '23505') return ok(res, { duplicate: true });
    if (event.error) throw badRequest(event.error.message);
    const request = await adminClient
      .from('payment_requests')
      .select('*')
      .in('provider', ['mtn', 'orange'])
      .eq('provider_reference', reference)
      .maybeSingle();
    if (!request.data) return ok(res, { accepted: true, unmatched: true });
    await settlePayment(request.data, mapped);
    return ok(res, { accepted: true });
  }

  if (!paymentProvider(providerName).verifyWebhook(raw, signature)) throw forbidden('Invalid webhook signature');
  const { event_id, reference, status } = req.body ?? {};
  if (typeof event_id !== 'string' || typeof reference !== 'string' || !['succeeded', 'failed'].includes(status)) {
    throw badRequest('Invalid webhook payload');
  }
  const event = await adminClient
    .from('payment_webhook_events')
    .insert({ provider: providerName, event_id, provider_reference: reference, status, payload: req.body })
    .select()
    .maybeSingle();
  if (event.error?.code === '23505') return ok(res, { duplicate: true });
  if (event.error) throw badRequest(event.error.message);
  const request = await adminClient
    .from('payment_requests')
    .select('*')
    .eq('provider', providerName)
    .eq('provider_reference', reference)
    .maybeSingle();
  if (!request.data) return ok(res, { accepted: true, unmatched: true });
  await settlePayment(request.data, status);
  return ok(res, { accepted: true });
}));
