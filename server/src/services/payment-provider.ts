import { env } from '../config/env';
import {
  MtnProvider,
  NkwaPayProvider,
  OrangeProvider,
  PaylinkOnlyProvider,
  PaymentOperator,
  PaymentProvider,
  SandboxProvider,
} from './payments';

export function nkwaPayConfig() {
  return {
    apiEnabled: Boolean(env.NKWA_PAY_API_KEY?.trim()),
    depositPaylinkUrl: env.NKWA_PAY_DEPOSIT_PAYLINK_URL?.trim() || undefined,
    withdrawalPaylinkUrl: env.NKWA_PAY_WITHDRAWAL_PAYLINK_URL?.trim() || undefined,
    mode: env.PAYMENTS_MODE,
  };
}

export function paymentProvider(name: PaymentOperator): PaymentProvider {
  if (name === 'sandbox') {
    return new SandboxProvider(
      env.PAYMENTS_WEBHOOK_SECRET,
      env.SANDBOX_PAYMENT_DELAY_MS,
      env.SANDBOX_PAYMENT_SUCCESS_RATE,
    );
  }

  const cfg = nkwaPayConfig();
  const webhookSecret = env.NKWA_PAY_WEBHOOK_SECRET?.trim() || env.PAYMENTS_WEBHOOK_SECRET;
  if (cfg.apiEnabled) {
    return new NkwaPayProvider(env.NKWA_PAY_API_KEY!.trim(), env.nkwaPayBaseUrl, webhookSecret, {
      depositPaylinkUrl: cfg.depositPaylinkUrl,
      withdrawalPaylinkUrl: cfg.withdrawalPaylinkUrl,
    });
  }

  if (cfg.depositPaylinkUrl || cfg.withdrawalPaylinkUrl) {
    return new PaylinkOnlyProvider(webhookSecret, {
      depositPaylinkUrl: cfg.depositPaylinkUrl,
      withdrawalPaylinkUrl: cfg.withdrawalPaylinkUrl,
    });
  }

  if (name === 'mtn') return new MtnProvider(env.PAYMENTS_WEBHOOK_SECRET);
  return new OrangeProvider(env.PAYMENTS_WEBHOOK_SECRET);
}
