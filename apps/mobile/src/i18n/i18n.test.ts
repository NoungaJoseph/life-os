// Run with: node --import tsx --test src/i18n/i18n.test.ts  (kept dependency-free of React Native)
import test from 'node:test';
import assert from 'node:assert/strict';
import { en } from './en';
import { fr } from './fr';

const flat = (o: any, p = ''): Record<string, string> =>
  Object.entries(o).reduce((a, [k, v]) => (typeof v === 'string' ? { ...a, [p + k]: v } : { ...a, ...flat(v, p + k + '.') }), {} as Record<string, string>);
const E = flat(en), F = flat(fr);
const vars = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',');

test('French has every English key and no extras', () => {
  assert.deepEqual(Object.keys(F).sort(), Object.keys(E).sort());
});
test('no empty strings', () => { for (const [k, v] of Object.entries({ ...E, ...F })) assert.ok(v.trim().length > 0, k); });
test('interpolation variables match between languages', () => { for (const k of Object.keys(E)) assert.equal(vars(F[k]), vars(E[k]), k); });
test('French text is really translated (not a copy of English) for long strings', () => {
  const same = Object.keys(E).filter((k) => E[k].length > 25 && E[k] === F[k]);
  assert.deepEqual(same, []);
});
