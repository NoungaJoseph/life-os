import test from 'node:test';
import assert from 'node:assert/strict';
import { inQuietHours, pickDue, ReminderRow } from './reminders';

const prefs = { quiet_start: '21:30', quiet_end: '07:00', max_per_day: 2, push_enabled: true };
const r = (id: string, time: string, days: number[] | null = null): ReminderRow => ({ id, user_id: 'u', title: id, kind: 'custom', remind_time: time, days_of_week: days, is_enabled: true });
// 2026-11-05 is a Thursday. 08:02 in Douala (UTC+1) = 07:02 UTC
const now = new Date('2026-11-05T07:02:00Z');

test('quiet hours wrap past midnight', () => {
  assert.ok(inQuietHours(23 * 60, '21:30', '07:00')); assert.ok(inQuietHours(60, '21:30', '07:00')); assert.ok(!inQuietHours(12 * 60, '21:30', '07:00'));
});
test('sends reminders inside the window, once, respecting weekday and cap', () => {
  const base = { now, tz: 'Africa/Douala', prefs, sentTodayIds: new Set<string>(), sentTodayCount: 0 };
  assert.deepEqual(pickDue({ ...base, reminders: [r('a', '08:00'), r('late', '08:30'), r('wrongday', '08:00', [1])] }).map((x) => x.id), ['a']);
  assert.deepEqual(pickDue({ ...base, sentTodayIds: new Set(['a']), reminders: [r('a', '08:00')] }), []);
  assert.equal(pickDue({ ...base, sentTodayCount: 2, reminders: [r('a', '08:00')] }).length, 0);
  assert.equal(pickDue({ ...base, prefs: { ...prefs, push_enabled: false }, reminders: [r('a', '08:00')] }).length, 0);
});
test('nothing is sent during quiet hours', () => {
  assert.equal(pickDue({ now: new Date('2026-11-05T22:30:00Z'), tz: 'UTC', prefs, sentTodayIds: new Set(), sentTodayCount: 0, reminders: [r('n', '22:28')] }).length, 0);
});
