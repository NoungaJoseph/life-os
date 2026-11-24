import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMEROON_LOCAL_LENGTH,
  CAMEROON_PREFIX,
  detectCameroonProvider,
  isValidCameroonLocal,
  sanitizeCameroonLocal,
  toCameroonPhone,
} from './phoneInput';

test('sanitizeCameroonLocal strips country code and clamps to 9 digits', () => {
  assert.equal(CAMEROON_PREFIX, '237');
  assert.equal(CAMEROON_LOCAL_LENGTH, 9);
  assert.equal(sanitizeCameroonLocal('+237 671 06 31 70'), '671063170');
  assert.equal(sanitizeCameroonLocal('237690123456'), '690123456');
  assert.equal(sanitizeCameroonLocal('00237671063170'), '671063170');
  assert.equal(sanitizeCameroonLocal('0671063170'), '671063170');
  assert.equal(sanitizeCameroonLocal('671063170999'), '671063170');
});

test('toCameroonPhone and isValidCameroonLocal validate 9-digit numbers', () => {
  assert.equal(isValidCameroonLocal('67106317'), false);
  assert.equal(isValidCameroonLocal('671063170'), true);
  assert.equal(toCameroonPhone('671063170'), '237671063170');
  assert.equal(toCameroonPhone('+237 690 12 34 56'), '237690123456');
});

test('detectCameroonProvider identifies MTN and Orange prefixes', () => {
  assert.equal(detectCameroonProvider('671063170'), 'mtn');
  assert.equal(detectCameroonProvider('650123456'), 'mtn');
  assert.equal(detectCameroonProvider('680123456'), 'mtn');
  assert.equal(detectCameroonProvider('690123456'), 'orange');
  assert.equal(detectCameroonProvider('655123456'), 'orange');
  assert.equal(detectCameroonProvider('640123456'), 'orange');
  assert.equal(detectCameroonProvider('620123456'), null);
});
