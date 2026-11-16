import { env } from '../config/env';
import { MtnProvider, OrangeProvider, PaymentOperator, PaymentProvider, SandboxProvider } from './payments';

export function paymentProvider(name: PaymentOperator): PaymentProvider {
  if (name === 'sandbox') {
    return new SandboxProvider(
      env.PAYMENTS_WEBHOOK_SECRET,
      env.SANDBOX_PAYMENT_DELAY_MS,
      env.SANDBOX_PAYMENT_SUCCESS_RATE,
    );
  }
  if (name === 'mtn') return new MtnProvider(env.PAYMENTS_WEBHOOK_SECRET);
  return new OrangeProvider(env.PAYMENTS_WEBHOOK_SECRET);
}
