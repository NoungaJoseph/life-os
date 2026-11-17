import assert from 'node:assert/strict';
import test from 'node:test';
import { activeCommitment, weakensCommitment } from './screen-time';

const rule = { app_identifier: 'com.example.app', daily_limit_minutes: 30, block_minutes: 60, commitment_mode: true, enabled: true, blocked_until: '2026-11-17T14:00:00Z' };
const now = new Date('2026-11-17T13:00:00Z');
test('active commitment cannot be disabled or made easier', () => {
  assert.equal(activeCommitment(rule, now), true);
  assert.equal(weakensCommitment(rule, { enabled: false }, now), true);
  assert.equal(weakensCommitment(rule, { daily_limit_minutes: 120 }, now), true);
  assert.equal(weakensCommitment(rule, { daily_limit_minutes: 20 }, now), false);
});
test('commitment expires at the end of the block window', () => {
  assert.equal(activeCommitment(rule, new Date('2026-11-17T14:00:00Z')), false);
});
