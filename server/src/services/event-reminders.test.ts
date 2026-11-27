import assert from 'node:assert/strict';
import test from 'node:test';
import { CalendarEventRow, formatEventReminderMessage, pickDueEventReminders } from './event-reminders';

const prefs = { quiet_start: '22:00', quiet_end: '07:00', max_per_day: 6, push_enabled: true };
const ev = (id: string, startsAt: string, title = 'Project launch'): CalendarEventRow => ({
  id,
  user_id: 'u1',
  title,
  starts_at: startsAt,
});

// Douala is UTC+1 -> 08:15Z is 09:15 local on 2026-11-27.
const nowMorning = new Date('2026-11-27T08:15:00Z');

test('fires 1-week, 2-day, and 1-day reminders during the 09:00 local window', () => {
  const events = [
    ev('w', '2026-12-04T14:00:00Z', 'Client pitch'), // +7 days
    ev('d2', '2026-11-29T10:00:00Z', 'Flight'),      // +2 days
    ev('d1', '2026-11-28T09:00:00Z', 'Dentist'),     // +1 day
    ev('d5', '2026-12-02T09:00:00Z', 'Ignore 5d'),   // +5 days (not a target offset)
    ev('d0', '2026-11-27T18:00:00Z', 'Today'),       // +0 days
  ];
  const due = pickDueEventReminders({
    now: nowMorning,
    tz: 'Africa/Douala',
    events,
    prefs,
    sentKeys: new Set(['d2:2']),
  });
  assert.deepEqual(
    due.map((x) => [x.event.id, x.offsetDays]),
    [
      ['w', 7],
      ['d1', 1],
    ],
  );
});

test('skips outside target hour, during quiet hours, or when push is disabled', () => {
  const events = [ev('d1', '2026-11-28T09:00:00Z')];
  assert.equal(
    pickDueEventReminders({ now: new Date('2026-11-27T11:00:00Z'), tz: 'Africa/Douala', events, prefs, sentKeys: new Set() }).length,
    0,
  );
  assert.equal(
    pickDueEventReminders({
      now: nowMorning,
      tz: 'Africa/Douala',
      events,
      prefs: { ...prefs, quiet_start: '08:00', quiet_end: '10:00' },
      sentKeys: new Set(),
    }).length,
    0,
  );
  assert.equal(
    pickDueEventReminders({
      now: nowMorning,
      tz: 'Africa/Douala',
      events,
      prefs: { ...prefs, push_enabled: false },
      sentKeys: new Set(),
    }).length,
    0,
  );
});

test('formats bilingual event reminder titles and bodies', () => {
  const en1w = formatEventReminderMessage('Wedding', 7, 'en', 'Yaoundé');
  assert.equal(en1w.title, 'Upcoming in 1 week');
  assert.match(en1w.body, /7 days \(Yaoundé\)/);

  const fr1d = formatEventReminderMessage('Réunion', 1, 'fr');
  assert.equal(fr1d.title, 'Événement demain');
  assert.match(fr1d.body, /demain/);
});
