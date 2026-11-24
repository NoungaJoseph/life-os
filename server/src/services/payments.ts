import { createHmac, timingSafeEqual } from 'node:crypto';

export type PaymentOperator = 'mtn' | 'orange' | 'sandbox';
export type PaymentDirection = 'deposit' | 'withdrawal';
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed';
export type PaymentRequestInput = { requestId: string; amount: number; currency: 'XAF'; phone: string; direction: PaymentDirection };
export type ProviderResult = { reference: string; status: PaymentStatus; paylinkUrl?: string };

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

export function normalizeCameroonApiPhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('237') && digits.length === 12) return digits;
  const local = digits.replace(/^237/, '').replace(/^0+/, '');
  return local.length === 9 ? `237${local}` : digits;
}

export function mapNkwaStatus(raw: unknown): PaymentStatus {
  const s = String(raw ?? '').trim().toUpperCase();
  if (s === 'SUCCESSFUL' || s === 'COMPLETE' || s === 'COMPLETED' || s === 'SUCCEEDED') return 'succeeded';
  if (s === 'FAILED' || s === 'CANCELED' || s === 'CANCELLED' || s === 'REJECTED') return 'failed';
  return 'processing';
}

export function buildExternalPaylinkUrl(baseUrl: string, input: Pick<PaymentRequestInput, 'amount' | 'phone' | 'direction'>, reference: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set('amount', String(input.amount));
  url.searchParams.set('phone', normalizeCameroonApiPhone(input.phone));
  url.searchParams.set('reference', reference);
  url.searchParams.set('direction', input.direction);
  return url.toString();
}

export function signPaylinkToken(requestId: string, secret: string): string {
  return createHmac('sha256', secret).update(`paylink:${requestId}`).digest('hex');
}

export function verifyPaylinkToken(requestId: string, token: string, secret: string): boolean {
  if (!token) return false;
  const expected = Buffer.from(signPaylinkToken(requestId, secret), 'hex');
  const actual = Buffer.from(token, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
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

export class NkwaPayProvider implements PaymentProvider {
  private readonly fetcher: typeof fetch;
  private readonly baseUrl: string;
  private readonly depositPaylinkUrl?: string;
  private readonly withdrawalPaylinkUrl?: string;

  constructor(
    private readonly apiKey: string,
    baseUrl: string,
    private readonly webhookSecret: string,
    options?: { depositPaylinkUrl?: string; withdrawalPaylinkUrl?: string; fetcher?: typeof fetch },
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.depositPaylinkUrl = options?.depositPaylinkUrl;
    this.withdrawalPaylinkUrl = options?.withdrawalPaylinkUrl;
    this.fetcher = options?.fetcher ?? fetch;
  }

  private async postAction(path: '/collect' | '/disburse', input: PaymentRequestInput, fallbackPaylinkUrl?: string): Promise<ProviderResult> {
    const label = input.direction === 'deposit' ? 'Deposit' : 'Withdrawal';
    const res = await this.fetcher(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({
        amount: input.amount,
        phoneNumber: normalizeCameroonApiPhone(input.phone),
        description: `MY LIFE OS ${label} ${input.requestId}`,
      }),
    });

    const text = await res.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
    if (!res.ok) {
      throw new Error(json?.message ?? json?.error ?? `Nkwa Pay request failed (${res.status})`);
    }

    const reference = json?.id ?? json?.payment?.id ?? json?.data?.id;
    if (typeof reference !== 'string' || !reference) {
      throw new Error('Nkwa Pay response missing payment reference');
    }

    const rawStatus = json?.status ?? json?.payment?.status ?? json?.data?.status;
    const status = mapNkwaStatus(rawStatus);
    const apiPaylink = json?.paylinkUrl ?? json?.paymentUrl ?? json?.checkoutUrl ?? json?.payment?.paylinkUrl;
    const paylinkUrl =
      typeof apiPaylink === 'string' && apiPaylink
        ? apiPaylink
        : fallbackPaylinkUrl
          ? buildExternalPaylinkUrl(fallbackPaylinkUrl, input, reference)
          : undefined;

    return { reference, status, ...(paylinkUrl ? { paylinkUrl } : {}) };
  }

  requestDeposit(input: PaymentRequestInput) {
    return this.postAction('/collect', input, this.depositPaylinkUrl);
  }

  requestWithdrawal(input: PaymentRequestInput) {
    return this.postAction('/disburse', input, this.withdrawalPaylinkUrl);
  }

  async getStatus(reference: string): Promise<PaymentStatus> {
    const res = await this.fetcher(`${this.baseUrl}/payments/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: { 'X-API-Key': this.apiKey },
    });
    const text = await res.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }
    if (!res.ok) {
      throw new Error(json?.message ?? json?.error ?? `Nkwa Pay status check failed (${res.status})`);
    }
    return mapNkwaStatus(json?.status ?? json?.payment?.status ?? json?.data?.status);
  }

  verifyWebhook(rawBody: string, signature: string) {
    return verifyHmac(rawBody, signature, this.webhookSecret);
  }
}

export class PaylinkOnlyProvider implements PaymentProvider {
  private readonly depositPaylinkUrl?: string;
  private readonly withdrawalPaylinkUrl?: string;

  constructor(
    private readonly webhookSecret: string,
    options?: { depositPaylinkUrl?: string; withdrawalPaylinkUrl?: string },
  ) {
    this.depositPaylinkUrl = options?.depositPaylinkUrl;
    this.withdrawalPaylinkUrl = options?.withdrawalPaylinkUrl;
  }

  async requestDeposit(input: PaymentRequestInput): Promise<ProviderResult> {
    if (!this.depositPaylinkUrl) {
      throw new Error('Nkwa Pay deposit paylink URL is not configured (set NKWA_PAY_DEPOSIT_PAYLINK_URL or NKWA_PAY_API_KEY)');
    }
    const reference = `nkwa_link_${input.requestId}`;
    return {
      reference,
      status: 'pending',
      paylinkUrl: buildExternalPaylinkUrl(this.depositPaylinkUrl, input, reference),
    };
  }

  async requestWithdrawal(input: PaymentRequestInput): Promise<ProviderResult> {
    if (!this.withdrawalPaylinkUrl) {
      throw new Error('Nkwa Pay withdrawal paylink URL is not configured (set NKWA_PAY_WITHDRAWAL_PAYLINK_URL or NKWA_PAY_API_KEY)');
    }
    const reference = `nkwa_link_${input.requestId}`;
    return {
      reference,
      status: 'pending',
      paylinkUrl: buildExternalPaylinkUrl(this.withdrawalPaylinkUrl, input, reference),
    };
  }

  async getStatus(_reference: string): Promise<PaymentStatus> {
    return 'pending';
  }

  verifyWebhook(rawBody: string, signature: string) {
    return verifyHmac(rawBody, signature, this.webhookSecret);
  }
}

abstract class LiveProviderStub implements PaymentProvider {
  constructor(protected secret: string, private providerName: string) {}
  protected unavailable(): never {
    throw new Error(`${this.providerName} provider is not configured (set NKWA_PAY_API_KEY or NKWA_PAY_DEPOSIT_PAYLINK_URL)`);
  }
  async requestDeposit(_input: PaymentRequestInput): Promise<ProviderResult> { return this.unavailable(); }
  async requestWithdrawal(_input: PaymentRequestInput): Promise<ProviderResult> { return this.unavailable(); }
  async getStatus(_reference: string): Promise<PaymentStatus> { return this.unavailable(); }
  verifyWebhook(rawBody: string, signature: string) { return verifyHmac(rawBody, signature, this.secret); }
}
export class MtnProvider extends LiveProviderStub { constructor(secret: string) { super(secret, 'MTN MoMo'); } }
export class OrangeProvider extends LiveProviderStub { constructor(secret: string) { super(secret, 'Orange Money'); } }
