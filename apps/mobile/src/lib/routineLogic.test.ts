import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeMealSlot,
  currentMonthKey,
  DEFAULT_ROUTINE_TIMES,
  isEndOfMonthReportReady,
  isMorningWindow,
  shiftMonth,
  shouldPromptMealFollowUp,
  shouldPromptMorningPlan,
} from './routineLogic';
import { localDateKey } from './eveningCheckinLogic';

const at = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m - 1, d, h, min, 0, 0);

test('isMorningWindow checks 07:00 to 11:30 window', () => {
  assert.equal(isMorningWindow(at(2026, 11, 25, 6, 59)), false);
  assert.equal(isMorningWindow(at(2026, 11, 25, 7, 0)), true);
  assert.equal(isMorningWindow(at(2026, 11, 25, 10, 15)), true);
  assert.equal(isMorningWindow(at(2026, 11, 25, 11, 30)), false);
});

test('activeMealSlot matches breakfast, lunch, and dinner windows', () => {
  const times = {
    breakfast: DEFAULT_ROUTINE_TIMES.breakfast,
    lunch: DEFAULT_ROUTINE_TIMES.lunch,
    dinner: DEFAULT_ROUTINE_TIMES.dinner,
  };
  assert.equal(activeMealSlot(at(2026, 11, 25, 8, 29), times), null);
  assert.equal(activeMealSlot(at(2026, 11, 25, 8, 30), times), 'breakfast');
  assert.equal(activeMealSlot(at(2026, 11, 25, 10, 29), times), 'breakfast');
  assert.equal(activeMealSlot(at(2026, 11, 25, 10, 30), times), null);
  assert.equal(activeMealSlot(at(2026, 11, 25, 13, 15), times), 'lunch');
  assert.equal(activeMealSlot(at(2026, 11, 25, 20, 0), times), 'dinner');
});

test('shouldPromptMorningPlan respects done, dismissed, snooze, and enabled', () => {
  const morning = at(2026, 11, 25, 8, 0);
  const today = localDateKey(morning);
  assert.equal(shouldPromptMorningPlan({ now: morning, doneDate: null, dismissedDate: null, snoozeUntil: null, enabled: true }), true);
  assert.equal(shouldPromptMorningPlan({ now: morning, doneDate: today, dismissedDate: null, snoozeUntil: null, enabled: true }), false);
  assert.equal(shouldPromptMorningPlan({ now: morning, doneDate: null, dismissedDate: today, snoozeUntil: null, enabled: true }), false);
  assert.equal(shouldPromptMorningPlan({ now: morning, doneDate: null, dismissedDate: null, snoozeUntil: morning.getTime() + 60_000, enabled: true }), false);
  assert.equal(shouldPromptMorningPlan({ now: morning, doneDate: null, dismissedDate: null, snoozeUntil: null, enabled: false }), false);
});

test('shouldPromptMealFollowUp skips logged and dismissed slots', () => {
  const times = { breakfast: '08:30', lunch: '13:00', dinner: '19:30' };
  const lunchTime = at(2026, 11, 25, 13, 10);
  assert.equal(
    shouldPromptMealFollowUp({ now: lunchTime, mealTimes: times, loggedMealsToday: [], dismissedSlotsToday: [], snoozeUntil: null, enabled: true }),
    'lunch',
  );
  assert.equal(
    shouldPromptMealFollowUp({ now: lunchTime, mealTimes: times, loggedMealsToday: ['lunch'], dismissedSlotsToday: [], snoozeUntil: null, enabled: true }),
    null,
  );
  assert.equal(
    shouldPromptMealFollowUp({ now: lunchTime, mealTimes: times, loggedMealsToday: [], dismissedSlotsToday: ['lunch'], snoozeUntil: null, enabled: true }),
    null,
  );
  assert.equal(
    shouldPromptMealFollowUp({ now: lunchTime, mealTimes: times, loggedMealsToday: [], dismissedSlotsToday: [], snoozeUntil: lunchTime.getTime() + 10_000, enabled: true }),
    null,
  );
});

test('isEndOfMonthReportReady and month key helpers work across year boundaries', () => {
  assert.equal(isEndOfMonthReportReady(at(2026, 11, 29, 20, 0)), false);
  assert.equal(isEndOfMonthReportReady(at(2026, 11, 30, 17, 59)), false);
  assert.equal(isEndOfMonthReportReady(at(2026, 11, 30, 18, 0)), true);
  assert.equal(isEndOfMonthReportReady(at(2026, 12, 1, 9, 0)), true);
  assert.equal(currentMonthKey(at(2026, 11, 25, 12, 0)), '2026-11');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
});
