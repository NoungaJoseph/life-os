import { Request, Router } from 'express';
import { env } from '../config/env';
import { adminClient } from '../config/supabase';
import { validate } from '../middleware/validate';
import { nkwaPayConfig, paymentProvider } from '../services/payment-provider';
import {
  buildExternalPaylinkUrl,
  PaymentOperator,
  signPaylinkToken,
  verifyPaylinkToken,
} from '../services/payments';
import { settlePayment } from '../services/wallet-ledger';
import { asyncHandler } from '../utils/asyncHandler';
import { forbidden, notFound } from '../utils/errors';
import { ok } from '../utils/response';
import { uuidParam } from '../validators/schemas';

export const paylinkRouter = Router();

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildHostedPaylinkUrl(req: Request, requestId: string): string {
  const origin = env.PUBLIC_API_URL?.trim().replace(/\/+$/, '') || `${req.protocol}://${req.get('host')}`;
  const token = signPaylinkToken(requestId, env.PAYMENTS_WEBHOOK_SECRET);
  return `${origin}/paylinks/${encodeURIComponent(requestId)}?token=${encodeURIComponent(token)}`;
}

export function resolvePaylinkUrl(req: Request, row: any): string {
  const cfg = nkwaPayConfig();
  if (row.provider !== 'sandbox') {
    const ext = row.direction === 'deposit' ? cfg.depositPaylinkUrl : cfg.withdrawalPaylinkUrl;
    if (ext) {
      return buildExternalPaylinkUrl(
        ext,
        { amount: Number(row.amount), phone: String(row.phone ?? ''), direction: row.direction },
        String(row.provider_reference ?? row.id),
      );
    }
  }
  return buildHostedPaylinkUrl(req, String(row.id));
}

export async function syncPaymentRequest(row: any): Promise<any> {
  if ((row.status !== 'pending' && row.status !== 'processing') || !row.provider_reference) {
    return row;
  }
  const provider = paymentProvider(row.provider as PaymentOperator);
  const remoteStatus = await provider.getStatus(String(row.provider_reference));
  if (remoteStatus === 'succeeded' || remoteStatus === 'failed') {
    return settlePayment(row, remoteStatus);
  }
  return row;
}

function renderPaylinkHtml(req: Request, row: any): string {
  const isPending = row.status === 'pending' || row.status === 'processing';
  const cfg = nkwaPayConfig();
  const extUrl =
    row.provider !== 'sandbox'
      ? (row.direction === 'deposit' ? cfg.depositPaylinkUrl : cfg.withdrawalPaylinkUrl)
      : undefined;
  const externalCheckoutUrl = extUrl
    ? buildExternalPaylinkUrl(
        extUrl,
        { amount: Number(row.amount), phone: String(row.phone ?? ''), direction: row.direction },
        String(row.provider_reference ?? row.id),
      )
    : null;
  const selfUrl = buildHostedPaylinkUrl(req, String(row.id));
  const statusLabel =
    row.status === 'succeeded'
      ? 'Completed'
      : row.status === 'failed'
        ? 'Failed'
        : row.status === 'processing'
          ? 'Processing'
          : 'Awaiting Confirmation';
  const statusColor =
    row.status === 'succeeded' ? '#0F766E' : row.status === 'failed' ? '#B91C1C' : '#B45309';
  const amountText = `${Number(row.amount || 0).toLocaleString('en-US')} ${escapeHtml(row.currency || 'XAF')}`;
  const directionLabel = row.direction === 'withdrawal' ? 'Wallet Withdrawal' : 'Wallet Deposit';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${isPending ? '<meta http-equiv="refresh" content="6" />' : ''}
  <title>MY LIFE OS · Nkwa Paylink</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0B1224; color: #F8FAFC; display: flex; min-height: 100vh; align-items: center; justify-content: center; padding: 20px; }
    .card { width: 100%; max-width: 440px; background: #14213D; border: 1px solid rgba(201,162,75,0.35); border-radius: 20px; padding: 24px; box-sizing: border-box; }
    .eyebrow { color: #C9A24B; font-size: 11px; letter-spacing: 1.6px; font-weight: 700; text-transform: uppercase; margin: 0 0 6px; }
    h1 { margin: 0 0 16px; font-size: 24px; }
    .amount { font-size: 32px; font-weight: 700; margin: 4px 0 14px; color: #2DD4BF; }
    .pill { display: inline-block; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; background: ${statusColor}; color: #FFFFFF; margin-bottom: 18px; }
    .row { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.1); font-size: 14px; }
    .label { color: #9FB3C8; }
    .val { font-weight: 600; text-align: right; word-break: break-all; }
    .note { margin: 16px 0; font-size: 13px; line-height: 1.5; color: #CBD5E1; }
    .btn { display: block; width: 100%; box-sizing: border-box; text-align: center; text-decoration: none; padding: 14px 16px; border-radius: 12px; font-weight: 700; font-size: 15px; margin-top: 10px; }
    .btn-primary { background: #14B8A6; color: #06231F; }
    .btn-secondary { border: 1px solid rgba(255,255,255,0.22); color: #F8FAFC; }
  </style>
</head>
<body>
  <main class="card">
    <p class="eyebrow">MY LIFE OS · NKWA PAY</p>
    <h1>${escapeHtml(directionLabel)}</h1>
    <div class="amount">${escapeHtml(amountText)}</div>
    <span class="pill">${escapeHtml(statusLabel)}</span>
    <div class="row"><span class="label">Mobile Money</span><span class="val">${escapeHtml(row.phone)}</span></div>
    <div class="row"><span class="label">Operator</span><span class="val">${escapeHtml(String(row.provider).toUpperCase())}</span></div>
    <div class="row"><span class="label">Reference</span><span class="val">${escapeHtml(row.provider_reference || row.id)}</span></div>
    <p class="note">${
      isPending
        ? row.direction === 'deposit'
          ? 'Confirm the Mobile Money prompt on your phone (or complete payment via Nkwa Pay). This page refreshes automatically every 6 seconds.'
          : 'Your Nkwa Pay withdrawal is being processed. This page refreshes automatically every 6 seconds.'
        : row.status === 'succeeded'
          ? 'Payment confirmed and recorded in your MY LIFE OS wallet.'
          : 'This payment did not complete. You can return to the app and try again.'
    }</p>
    ${externalCheckoutUrl && isPending ? `<a class="btn btn-primary" href="${escapeHtml(externalCheckoutUrl)}">Continue to Nkwa Pay</a>` : ''}
    <a class="btn ${externalCheckoutUrl && isPending ? 'btn-secondary' : 'btn-primary'}" href="mylifeos:///wallet">Return to MY LIFE OS</a>
    <a class="btn btn-secondary" href="${escapeHtml(selfUrl)}">Refresh status</a>
  </main>
</body>
</html>`;
}

paylinkRouter.get('/:id', validate(uuidParam, 'params'), asyncHandler(async (req, res) => {
  const token = String(req.query.token ?? '');
  if (!verifyPaylinkToken(req.params.id, token, env.PAYMENTS_WEBHOOK_SECRET)) {
    throw forbidden('Invalid paylink token');
  }

  const { data, error } = await adminClient
    .from('payment_requests')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error || !data) throw notFound('Payment request not found');

  let current = data;
  try {
    current = await syncPaymentRequest(data);
  } catch {
    /* keep rendering current stored state if provider status check is temporarily unavailable */
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(renderPaylinkHtml(req, current));
}));

paylinkRouter.get('/:id/status', validate(uuidParam, 'params'), asyncHandler(async (req, res) => {
  const token = String(req.query.token ?? '');
  if (!verifyPaylinkToken(req.params.id, token, env.PAYMENTS_WEBHOOK_SECRET)) {
    throw forbidden('Invalid paylink token');
  }

  const { data, error } = await adminClient
    .from('payment_requests')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error || !data) throw notFound('Payment request not found');

  let current = data;
  try {
    current = await syncPaymentRequest(data);
  } catch {
    /* return stored state */
  }

  ok(res, {
    id: current.id,
    direction: current.direction,
    amount: current.amount,
    currency: current.currency,
    status: current.status,
    provider: current.provider,
    reference: current.provider_reference ?? current.id,
  });
}));
