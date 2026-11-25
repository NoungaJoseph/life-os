import assert from 'node:assert/strict';
import test from 'node:test';
import { quitProgress, quitStreak, weekStart } from './transformation';

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

test('quitProgress tracks Day-1 check-in, milestones, and target goal completion', () => {
  const day1 = quitProgress('2026-11-25', [{ kind: 'success', occurred_at: '2026-11-25T22:00:00Z' }], '2026-11-25', 30);
  assert.equal(day1.current, 1);
  assert.equal(day1.today_status, 'success');
  assert.equal(day1.next_milestone, 3);
  assert.equal(day1.goal_achieved, false);

  const reached = quitProgress('2026-10-20', [{ kind: 'success', occurred_at: '2026-11-25T22:00:00Z' }], '2026-11-25', 30);
  assert.equal(reached.current, 36);
  assert.equal(reached.progress_pct, 100);
  assert.equal(reached.days_remaining, 0);
  assert.equal(reached.latest_milestone, 30);
  assert.equal(reached.next_milestone, 60);
  assert.equal(reached.goal_achieved, true);
});
