import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEventReminderSchedule,
  eventCountdownDays,
  eventLocalDate,
  eventLocalTime,
} from './eventRemindersLogic';

test('buildEventReminderSchedule creates 1-week, 2-day, and 1-day reminders at 09:00 local time', () => {
  const now = new Date(2026, 10, 27, 8, 30, 0, 0); // 2026-11-27 08:30 local
  const futureEventDate = new Date(2026, 11, 10, 14, 0, 0, 0); // 2026-12-10 14:00 local
  const items = buildEventReminderSchedule(
    [{ id: 'e1', title: 'Exam', starts_at: futureEventDate.toISOString(), location: 'Hall A' }],
    now,
  );
  assert.equal(items.length, 3);
  assert.deepEqual(
    items.map((x) => [x.offsetDays, eventLocalDate(x.fireAt.toISOString()), eventLocalTime(x.fireAt.toISOString())]),
    [
      [7, '2026-12-03', '09:00'],
      [2, '2026-12-08', '09:00'],
      [1, '2026-12-09', '09:00'],
    ],
  );
});

test('buildEventReminderSchedule drops past triggers and enforces chronological cap', () => {
  const now = new Date(2026, 10, 27, 10, 0, 0, 0); // 2026-11-27 10:00 local (09:00 already passed)
  const soon = new Date(2026, 10, 29, 15, 0, 0, 0); // 2026-11-29 (+2d reminder was 09:00 today -> already past)
  const items = buildEventReminderSchedule([{ id: 'e1', title: 'Meeting', starts_at: soon.toISOString() }], now);
  assert.deepEqual(items.map((x) => x.offsetDays), [1]);

  const later = new Date(2026, 11, 20, 12, 0, 0, 0);
  const capped = buildEventReminderSchedule([{ id: 'e2', title: 'Later', starts_at: later.toISOString() }], now, 2);
  assert.deepEqual(capped.map((x) => x.offsetDays), [7, 2]);
});

test('eventCountdownDays computes calendar day delta accurately', () => {
  assert.equal(eventCountdownDays('2026-12-04', '2026-11-27'), 7);
  assert.equal(eventCountdownDays('2026-11-28', '2026-11-27'), 1);
  assert.equal(eventCountdownDays('2026-11-27', '2026-11-27'), 0);
  assert.equal(eventCountdownDays('2026-11-26', '2026-11-27'), -1);
});
