import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoneyInput, parseMoneyInput, stripMoneyFormatting } from './moneyInput';

test('formatMoneyInput formats integers with comma separators', () => {
  assert.equal(formatMoneyInput(''), '');
  assert.equal(formatMoneyInput('500'), '500');
  assert.equal(formatMoneyInput('1000'), '1,000');
  assert.equal(formatMoneyInput('1250000'), '1,250,000');
  assert.equal(formatMoneyInput('1,250,000'), '1,250,000');
});

test('formatMoneyInput handles leading zeros and non-digits', () => {
  assert.equal(formatMoneyInput('000'), '0');
  assert.equal(formatMoneyInput('001500'), '1,500');
  assert.equal(formatMoneyInput('12a3b45'), '12,345');
  assert.equal(formatMoneyInput('abc'), '');
});

test('formatMoneyInput preserves decimals when allowDecimal is true', () => {
  assert.equal(formatMoneyInput('1500.', true), '1,500.');
  assert.equal(formatMoneyInput('1500.5', true), '1,500.5');
  assert.equal(formatMoneyInput('1,500.75', true), '1,500.75');
  assert.equal(formatMoneyInput('.5', true), '0.5');
  assert.equal(formatMoneyInput('12.34.56', true), '12.3456');
  assert.equal(formatMoneyInput('1500.50', false), '150,050');
});

test('stripMoneyFormatting and parseMoneyInput round-trip cleanly', () => {
  assert.equal(stripMoneyFormatting('1,250,000'), '1250000');
  assert.equal(stripMoneyFormatting('001,250.50', true), '1250.50');
  assert.equal(parseMoneyInput('1,250,000'), 1250000);
  assert.equal(parseMoneyInput('1,500.25'), 1500.25);
  assert.ok(Number.isNaN(parseMoneyInput('')));
});
