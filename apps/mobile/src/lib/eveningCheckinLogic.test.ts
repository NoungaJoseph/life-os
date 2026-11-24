import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isInEveningWindow,
  localDateKey,
  minutesUntilBedtime,
  shouldPromptEveningCheckin,
} from './eveningCheckinLogic';

const at = (h: number, m: number) => new Date(2026, 10, 24, h, m, 0, 0);

test('isInEveningWindow triggers from 22:00 onward', () => {
  assert.equal(isInEveningWindow(at(21, 59)), false);
  assert.equal(isInEveningWindow(at(22, 0)), true);
  assert.equal(isInEveningWindow(at(22, 45)), true);
  assert.equal(isInEveningWindow(at(23, 15)), true);
});

test('minutesUntilBedtime counts down to 23:00', () => {
  assert.equal(minutesUntilBedtime(at(22, 0)), 60);
  assert.equal(minutesUntilBedtime(at(22, 45)), 15);
  assert.equal(minutesUntilBedtime(at(23, 0)), 0);
  assert.equal(minutesUntilBedtime(at(23, 20)), 0);
});

test('shouldPromptEveningCheckin respects enabled, doneDate, and snoozeUntil', () => {
  const tenPm = at(22, 10);
  const today = localDateKey(tenPm);

  assert.equal(
    shouldPromptEveningCheckin({ now: tenPm, doneDate: null, snoozeUntil: null, enabled: true }),
    true,
  );
  assert.equal(
    shouldPromptEveningCheckin({ now: at(21, 30), doneDate: null, snoozeUntil: null, enabled: true }),
    false,
  );
  assert.equal(
    shouldPromptEveningCheckin({ now: tenPm, doneDate: today, snoozeUntil: null, enabled: true }),
    false,
  );
  assert.equal(
    shouldPromptEveningCheckin({ now: tenPm, doneDate: '2026-11-23', snoozeUntil: null, enabled: true }),
    true,
  );
  assert.equal(
    shouldPromptEveningCheckin({
      now: tenPm,
      doneDate: null,
      snoozeUntil: tenPm.getTime() + 10 * 60_000,
      enabled: true,
    }),
    false,
  );
  assert.equal(
    shouldPromptEveningCheckin({
      now: tenPm,
      doneDate: null,
      snoozeUntil: tenPm.getTime() - 1000,
      enabled: true,
    }),
    true,
  );
  assert.equal(
    shouldPromptEveningCheckin({ now: tenPm, doneDate: null, snoozeUntil: null, enabled: false }),
    false,
  );
});
