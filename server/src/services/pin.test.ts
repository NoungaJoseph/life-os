import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPin, isValidPinFormat, isWeakPin, verifyPinHash } from './pin';

test('hash round trip and wrong pin', () => {
  const { salt, hash } = hashPin('4821');
  assert.ok(verifyPinHash('4821', salt, hash)); assert.ok(!verifyPinHash('4822', salt, hash));
  assert.notEqual(hashPin('4821').hash, hash, 'salt makes each hash different');
});
test('format and weak pins', () => {
  assert.ok(isValidPinFormat('0481')); for (const p of ['123', '12345', 'abcd', '12 3']) assert.ok(!isValidPinFormat(p));
  for (const p of ['0000', '1234', '4321']) assert.ok(isWeakPin(p)); assert.ok(!isWeakPin('4821'));
});
