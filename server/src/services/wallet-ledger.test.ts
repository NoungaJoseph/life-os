import assert from 'node:assert/strict';
import test from 'node:test';
import { ledgerMismatches } from './ledger';

test('ledger reconciliation reports cached balances that differ from entry sums', () => {
  const accounts=[{id:'wallet',balance:700},{id:'clearing',balance:-700},{id:'empty',balance:1}];
  const entries=[{account_id:'wallet',amount:1000},{account_id:'wallet',amount:-300},{account_id:'clearing',amount:-700}];
  assert.deepEqual(ledgerMismatches(accounts,entries),[{accountId:'empty',cached:1,calculated:0}]);
});
