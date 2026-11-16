import assert from 'node:assert/strict';
import test from 'node:test';
import { detectCameroonOperator, SandboxProvider, verifyHmac, webhookSignature } from './payments';

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
