import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeFinance } from './finance';

test('finance summary totals, budgets and savings balances', () => {
  const s = summarizeFinance({
    currency: 'XAF',
    income: [{ amount: 100000 }, { amount: 50, currency: 'USD' }],
    expenses: [{ amount: 30000, category: 'Food' }, { amount: 5000, category: 'Food' }, { amount: 10000, category: 'Transport' }],
    budgets: [{ category: 'Food', amount: 30000 }],
    savings: [{ id: 'g1', name: 'Emergency', kind: 'emergency', target_amount: 200000 }],
    savingsTx: [{ savings_goal_id: 'g1', amount: 50000 }, { savings_goal_id: 'g1', amount: -10000 }],
  });
  assert.equal(s.income, 100000);
  assert.equal(s.spent, 45000);
  assert.equal(s.net, 55000);
  assert.equal(s.savings_rate, 55);
  assert.deepEqual(s.over_budget, ['Food']);
  assert.equal(s.savings[0].balance, 40000);
  assert.equal(s.savings[0].pct, 20);
  assert.equal(s.skipped_other_currency, 1);
});

test('no income gives null savings rate', () => {
  assert.equal(summarizeFinance({ currency: 'XAF', income: [], expenses: [], budgets: [], savings: [], savingsTx: [] }).savings_rate, null);
});

import { summarizeDebts } from './finance';
test('debt balances, overdue and payments left', () => {
  const s = summarizeDebts(
    [{ id: 'a', name: 'Loan', direction: 'owed_by_me', principal: 100000, due_date: '2026-01-01', min_payment: 20000, status: 'active' },
     { id: 'b', name: 'Friend', direction: 'owed_to_me', principal: 5000, status: 'active' }],
    [{ debt_id: 'a', amount: 30000 }], '2026-11-05');
  assert.equal(s.i_owe, 70000); assert.equal(s.owed_to_me, 5000);
  assert.equal(s.items[0].pct, 30); assert.equal(s.items[0].payments_left, 4);
  assert.deepEqual(s.overdue, ['Loan']);
});
