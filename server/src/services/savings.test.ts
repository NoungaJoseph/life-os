import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSavingsGoalView, RawSavingsGoalRow, validateGoalWithdrawal } from './savings';

const baseRow: RawSavingsGoalRow = {
  id: 'g1',
  user_id: 'u1',
  name: 'Buy a shoe',
  target_amount: 30_000,
  target_date: '2027-01-27',
  account_id: 'a1',
};

test('goal remains locked until target amount is reached', () => {
  const view = buildSavingsGoalView(baseRow, 12_000);
  assert.equal(view.balance, 12_000);
  assert.equal(view.remaining, 18_000);
  assert.equal(view.progress_pct, 40);
  assert.equal(view.is_unlocked, false);

  const wd = validateGoalWithdrawal(view, 5_000);
  assert.equal(wd.ok, false);
  if (!wd.ok) assert.equal(wd.code, 'LOCKED');
});

test('goal unlocks once target is reached and allows withdrawal', () => {
  const view = buildSavingsGoalView(baseRow, 30_000);
  assert.equal(view.remaining, 0);
  assert.equal(view.progress_pct, 100);
  assert.equal(view.is_unlocked, true);

  assert.deepEqual(validateGoalWithdrawal(view, 30_000), { ok: true });
  assert.deepEqual(validateGoalWithdrawal(view, 10_000), { ok: true });

  const tooMuch = validateGoalWithdrawal(view, 35_000);
  assert.equal(tooMuch.ok, false);
  if (!tooMuch.ok) assert.equal(tooMuch.code, 'INSUFFICIENT');
});

test('goal with unlocked_at set stays unlocked during partial withdrawals', () => {
  const view = buildSavingsGoalView({ ...baseRow, unlocked_at: '2027-01-10T10:00:00Z' }, 20_000);
  assert.equal(view.is_unlocked, true);
  assert.deepEqual(validateGoalWithdrawal(view, 20_000), { ok: true });
});
