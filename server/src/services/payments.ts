import { createHmac, timingSafeEqual } from 'node:crypto';

export type PaymentOperator = 'mtn' | 'orange' | 'sandbox';
export type PaymentDirection = 'deposit' | 'withdrawal';
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed';
export type PaymentRequestInput = { requestId: string; amount: number; currency: 'XAF'; phone: string; direction: PaymentDirection };
export type ProviderResult = { reference: string; status: PaymentStatus };

export interface PaymentProvider {
  requestDeposit(input: PaymentRequestInput): Promise<ProviderResult>;
  requestWithdrawal(input: PaymentRequestInput): Promise<ProviderResult>;
  getStatus(reference: string): Promise<PaymentStatus>;
  verifyWebhook(rawBody: string, signature: string): boolean;
}

export function webhookSignature(rawBody: string, secret: string) { return createHmac('sha256', secret).update(rawBody).digest('hex'); }
export function verifyHmac(rawBody: string, signature: string, secret: string) {
  const expected = Buffer.from(webhookSignature(rawBody, secret), 'hex');
  const actual = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function detectCameroonOperator(phone: string): Exclude<PaymentOperator, 'sandbox'> | null {
  const local = phone.replace(/\D/g, '').replace(/^00237/, '').replace(/^237/, '').replace(/^0/, '');
  if (/^(67\d|65[0-4]|68[0-3])\d{6}$/.test(local)) return 'mtn';
  if (/^(69\d|65[5-9]|640)\d{6}$/.test(local)) return 'orange';
  return null;
}

export class SandboxProvider implements PaymentProvider {
  private readonly statuses = new Map<string, PaymentStatus>();
  constructor(private secret: string, private delayMs = 0, private successRate = 1) {}
  private async request(input: PaymentRequestInput): Promise<ProviderResult> {
    const reference = `sandbox_${input.requestId}`;
    this.statuses.set(reference, 'processing');
    if (this.delayMs) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    const status: PaymentStatus = Math.random() < this.successRate ? 'succeeded' : 'failed';
    this.statuses.set(reference, status);
    return { reference, status };
  }
  requestDeposit(input: PaymentRequestInput) { return this.request(input); }
  requestWithdrawal(input: PaymentRequestInput) { return this.request(input); }
  async getStatus(reference: string) { return this.statuses.get(reference) ?? 'pending'; }
  verifyWebhook(rawBody: string, signature: string) { return verifyHmac(rawBody, signature, this.secret); }
}

abstract class LiveProviderStub implements PaymentProvider {
  constructor(protected secret: string, private providerName: string) {}
  protected unavailable(): never { throw new Error(`${this.providerName} provider is not configured`); }
  async requestDeposit(_input: PaymentRequestInput): Promise<ProviderResult> { return this.unavailable(); }
  async requestWithdrawal(_input: PaymentRequestInput): Promise<ProviderResult> { return this.unavailable(); }
  async getStatus(_reference: string): Promise<PaymentStatus> { return this.unavailable(); }
  verifyWebhook(rawBody: string, signature: string) { return verifyHmac(rawBody, signature, this.secret); }
}
export class MtnProvider extends LiveProviderStub { constructor(secret: string) { super(secret, 'MTN MoMo'); } }
export class OrangeProvider extends LiveProviderStub { constructor(secret: string) { super(secret, 'Orange Money'); } }
