import assert from 'node:assert/strict';
import test from 'node:test';
import { buildContributionSchedule, contributionDates, scheduleStatus } from './group-savings';

test('daily, weekly and month-end schedules include the end date boundary', () => {
  assert.deepEqual(contributionDates('2026-01-01', '2026-01-03', 'daily'), ['2026-01-01', '2026-01-02', '2026-01-03']);
  assert.deepEqual(contributionDates('2026-01-01', '2026-01-15', 'weekly'), ['2026-01-01', '2026-01-08', '2026-01-15']);
  assert.deepEqual(contributionDates('2026-01-31', '2026-04-30', 'monthly'), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
});

test('schedule distinguishes paid, late, due and missed while allowing catch-up', () => {
  const schedule = buildContributionSchedule('2026-11-13', '2026-11-16', 'daily', [
    { due_on: '2026-11-13', paid_at: '2026-11-13T08:00:00Z' },
    { due_on: '2026-11-14', paid_at: '2026-11-16T08:00:00Z' },
  ], '2026-11-16');
  assert.deepEqual(schedule.map((slot) => slot.status), ['paid', 'late', 'missed', 'due']);
  assert.equal(scheduleStatus('2026-11-10', '2026-11-12T00:00:00Z', '2026-11-16'), 'late');
});

test('invalid ranges are rejected', () => assert.throws(() => contributionDates('2026-02-02', '2026-02-01', 'daily')));
