import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone } from './phone';

test('normalises common Cameroon formats', () => {
  for (const s of ['671063170', '6 71 06 31 70', '+237 671 063 170', '00237671063170', '237671063170', '(671) 063-170']) assert.equal(normalizePhone(s), '+237671063170', s);
});
test('keeps other countries in E.164', () => { assert.equal(normalizePhone('+234 803 123 4567'), '+2348031234567'); });
test('rejects junk', () => { for (const s of ['', 'abc', '123', '+237 6710', '6710631700000']) assert.equal(normalizePhone(s), null, s); });
