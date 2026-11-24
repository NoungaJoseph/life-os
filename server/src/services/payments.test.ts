import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildExternalPaylinkUrl,
  detectCameroonOperator,
  mapNkwaStatus,
  NkwaPayProvider,
  normalizeCameroonApiPhone,
  PaylinkOnlyProvider,
  SandboxProvider,
  signPaylinkToken,
  verifyHmac,
  verifyPaylinkToken,
  webhookSignature,
} from './payments';

test('detects Cameroon mobile-money prefixes and leaves unknown numbers alone', () => {
  assert.equal(detectCameroonOperator('+237 671 234 567'), 'mtn');
  assert.equal(detectCameroonOperator('655123456'), 'orange');
  assert.equal(detectCameroonOperator('640123456'), 'orange');
  assert.equal(detectCameroonOperator('612345678'), null);
});

test('webhook HMAC verification is exact and timing-safe', () => {
  const body = JSON.stringify({ reference: 'abc', status: 'succeeded' });
  const signature = webhookSignature(body, 'a-secret-long-enough');
  assert.equal(verifyHmac(body, signature, 'a-secret-long-enough'), true);
  assert.equal(verifyHmac(`${body}x`, signature, 'a-secret-long-enough'), false);
  assert.equal(verifyHmac(body, 'bad', 'a-secret-long-enough'), false);
});

test('sandbox provider supports deterministic success and failure', async () => {
  const input = { requestId: 'req-1', amount: 1000, currency: 'XAF' as const, phone: '671234567', direction: 'deposit' as const };
  const success = new SandboxProvider('a-secret-long-enough', 0, 1);
  const ok = await success.requestDeposit(input);
  assert.equal(ok.status, 'succeeded'); assert.equal(await success.getStatus(ok.reference), 'succeeded');
  const failure = new SandboxProvider('a-secret-long-enough', 0, 0);
  assert.equal((await failure.requestWithdrawal({ ...input, direction: 'withdrawal' })).status, 'failed');
});

test('normalizeCameroonApiPhone, mapNkwaStatus, and paylink tokens work cleanly', () => {
  assert.equal(normalizeCameroonApiPhone('+237 671 06 31 70'), '237671063170');
  assert.equal(normalizeCameroonApiPhone('690123456'), '237690123456');
  assert.equal(normalizeCameroonApiPhone('00237671063170'), '237671063170');

  assert.equal(mapNkwaStatus('SUCCESSFUL'), 'succeeded');
  assert.equal(mapNkwaStatus('completed'), 'succeeded');
  assert.equal(mapNkwaStatus('FAILED'), 'failed');
  assert.equal(mapNkwaStatus('cancelled'), 'failed');
  assert.equal(mapNkwaStatus('PENDING'), 'processing');

  const url = buildExternalPaylinkUrl('https://pay.mynkwa.com/link/demo?merchant=1', {
    amount: 5000,
    phone: '671063170',
    direction: 'deposit',
  }, 'pay_123');
  assert.ok(url.includes('merchant=1'));
  assert.ok(url.includes('amount=5000'));
  assert.ok(url.includes('phone=237671063170'));
  assert.ok(url.includes('reference=pay_123'));

  const secret = 'super-secret-token-key';
  const token = signPaylinkToken('req-1', secret);
  assert.equal(verifyPaylinkToken('req-1', token, secret), true);
  assert.equal(verifyPaylinkToken('req-2', token, secret), false);
  assert.equal(verifyPaylinkToken('req-1', 'bad', secret), false);
});

test('NkwaPayProvider posts /collect, /disburse and queries /payments/:id', async () => {
  const calls: { url: string; method?: string; headers?: any; body?: string }[] = [];
  const mockFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method, headers: init?.headers, body: init?.body as string });
    if (String(url).endsWith('/collect')) {
      return new Response(JSON.stringify({ id: 'nk_dep_1', status: 'PENDING' }), { status: 200 });
    }
    if (String(url).endsWith('/disburse')) {
      return new Response(JSON.stringify({ id: 'nk_wd_1', status: 'SUCCESSFUL' }), { status: 200 });
    }
    return new Response(JSON.stringify({ id: 'nk_dep_1', status: 'SUCCESSFUL' }), { status: 200 });
  }) as typeof fetch;

  const provider = new NkwaPayProvider('test-key', 'https://api.pay.staging.mynkwa.com/', 'webhook-secret-1234', {
    depositPaylinkUrl: 'https://pay.mynkwa.com/pay/demo',
    fetcher: mockFetch,
  });

  const dep = await provider.requestDeposit({ requestId: 'req-dep', amount: 2500, currency: 'XAF', phone: '671063170', direction: 'deposit' });
  assert.equal(dep.reference, 'nk_dep_1');
  assert.equal(dep.status, 'processing');
  assert.ok(dep.paylinkUrl?.startsWith('https://pay.mynkwa.com/pay/demo?'));
  assert.equal(calls[0].url, 'https://api.pay.staging.mynkwa.com/collect');
  assert.equal(calls[0].headers['X-API-Key'], 'test-key');
  assert.deepEqual(JSON.parse(calls[0].body!), { amount: 2500, phoneNumber: '237671063170', description: 'MY LIFE OS Deposit req-dep' });

  const wd = await provider.requestWithdrawal({ requestId: 'req-wd', amount: 1500, currency: 'XAF', phone: '237690123456', direction: 'withdrawal' });
  assert.equal(wd.reference, 'nk_wd_1');
  assert.equal(wd.status, 'succeeded');
  assert.equal(calls[1].url, 'https://api.pay.staging.mynkwa.com/disburse');

  assert.equal(await provider.getStatus('nk_dep_1'), 'succeeded');
  assert.equal(calls[2].url, 'https://api.pay.staging.mynkwa.com/payments/nk_dep_1');
});

test('PaylinkOnlyProvider builds deposit and withdrawal paylinks and requires configured URLs', async () => {
  const provider = new PaylinkOnlyProvider('webhook-secret-1234', {
    depositPaylinkUrl: 'https://pay.mynkwa.com/deposit-link',
  });
  const dep = await provider.requestDeposit({ requestId: 'r1', amount: 1000, currency: 'XAF', phone: '671063170', direction: 'deposit' });
  assert.equal(dep.reference, 'nkwa_link_r1');
  assert.equal(dep.status, 'pending');
  assert.ok(dep.paylinkUrl?.includes('https://pay.mynkwa.com/deposit-link'));

  await assert.rejects(
    () => provider.requestWithdrawal({ requestId: 'r2', amount: 1000, currency: 'XAF', phone: '671063170', direction: 'withdrawal' }),
    /NKWA_PAY_WITHDRAWAL_PAYLINK_URL/,
  );
});
