import assert from 'node:assert/strict';
import test from 'node:test';
import { quitStreak, weekStart } from './transformation';

test('relapse resets current streak, preserves best, and urge does not reset', () => {
  assert.deepEqual(quitStreak('2026-11-01', [
    { kind: 'urge', occurred_at: '2026-11-04T10:00:00Z' },
    { kind: 'relapse', occurred_at: '2026-11-10T10:00:00Z' },
    { kind: 'urge', occurred_at: '2026-11-12T10:00:00Z' },
  ], '2026-11-17'), { current: 7, best: 9, relapses: 1 });
});

test('weekly check-ins use Monday in UTC', () => {
  assert.equal(weekStart('2026-11-17'), '2026-11-16');
  assert.equal(weekStart('2026-11-22'), '2026-11-16');
});
