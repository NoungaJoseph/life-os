import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateVault } from './vault';

const sum = (parts: { amount: number }[]) => parts.reduce((n, p) => n + p.amount, 0);
test('reserves emergency share then splits by priority using exact integer totals', () => {
  const result = allocateVault(101, [
    { id: 'emergency', kind: 'emergency', priority: 1, target: 1000, balance: 0 },
    { id: 'rent', priority: 3, target: 1000, balance: 0 },
    { id: 'bike', priority: 1, target: 1000, balance: 0 },
  ], 20);
  assert.equal(sum(result), 101);
  assert.deepEqual(result, [{ goalId: 'emergency', amount: 20 }, { goalId: 'rent', amount: 61 }, { goalId: 'bike', amount: 20 }]);
});

test('caps a goal and repeatedly redistributes overflow', () => {
  const result = allocateVault(100, [
    { id: 'emergency', kind: 'emergency', priority: 1, target: 10, balance: 0 },
    { id: 'small', priority: 5, target: 20, balance: 15 },
    { id: 'large', priority: 1, target: 500, balance: 0 },
  ]);
  assert.equal(sum(result), 100);
  assert.deepEqual(result, [{ goalId: 'emergency', amount: 10 }, { goalId: 'small', amount: 5 }, { goalId: 'large', amount: 85 }]);
});

test('largest remainder is deterministic and total always equals the deposit', () => {
  const result = allocateVault(10, [
    { id: 'a', priority: 1, target: 100, balance: 0 }, { id: 'b', priority: 1, target: 100, balance: 0 }, { id: 'c', priority: 1, target: 100, balance: 0 },
  ]);
  assert.deepEqual(result, [{ goalId: 'a', amount: 4 }, { goalId: 'b', amount: 3 }, { goalId: 'c', amount: 3 }]);
});

test('rejects unsafe inputs and deposits larger than remaining need', () => {
  assert.throws(() => allocateVault(11, [{ id: 'a', priority: 1, target: 10, balance: 0 }]));
  assert.throws(() => allocateVault(10.5, [{ id: 'a', priority: 1, target: 100, balance: 0 }]));
  assert.throws(() => allocateVault(10, [{ id: 'a', priority: 0, target: 100, balance: 0 }]));
});
