import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, parseTime } from './timeInput';

test('parseTime parses valid HH:MM and HH:MM:SS strings', () => {
  assert.deepEqual(parseTime('07:30'), { hour: 7, minute: 30 });
  assert.deepEqual(parseTime('22:00:00'), { hour: 22, minute: 0 });
  assert.deepEqual(parseTime('00:00'), { hour: 0, minute: 0 });
  assert.deepEqual(parseTime('23:59'), { hour: 23, minute: 59 });
});

test('parseTime rejects invalid times', () => {
  assert.equal(parseTime(''), null);
  assert.equal(parseTime('24:00'), null);
  assert.equal(parseTime('12:60'), null);
  assert.equal(parseTime('7:30'), null);
  assert.equal(parseTime('abc'), null);
});

test('formatTime pads and clamps hour and minute', () => {
  assert.equal(formatTime(7, 5), '07:05');
  assert.equal(formatTime(22, 0), '22:00');
  assert.equal(formatTime(-1, 70), '00:59');
  assert.equal(formatTime(25, -3), '23:00');
});
