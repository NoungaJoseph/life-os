import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'x';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'y';
process.env.LOG_LEVEL = 'silent';

test('extractJson tolerates prose around the JSON and rejects garbage', async () => {
  const { extractJson, breakdownResult } = await import('./ai');
  const raw = 'Sure! Here you go:\n{"steps":[{"title":"Save 50k","goal_type":"monthly"}]}\nHope it helps.';
  assert.equal(breakdownResult.parse(extractJson(raw)).steps[0].title, 'Save 50k');
  assert.throws(() => extractJson('no json here'));
  assert.throws(() => extractJson('{bad json}'));
});

test('breakdown output is validated (unknown goal types rejected)', async () => {
  const { breakdownResult } = await import('./ai');
  assert.equal(breakdownResult.safeParse({ steps: [{ title: 'x', goal_type: 'epic' }] }).success, false);
  assert.equal(breakdownResult.safeParse({ steps: [] }).success, false);
});

test('coach context carries numbers but never notes or journal text', async () => {
  const { buildCoachContext } = await import('./ai');
  const snap: any = {
    today: '2026-11-04', profile: { display_name: 'Joseph' }, momentum: 72,
    habits: [{ id: 'h', name: 'Read' }],
    statsById: { h: { streak: 5, streak_unit: 'days', rate30: 0.8, lapse_risk: 0.6 } },
    goalViews: [{ title: 'Save', goal_type: 'monthly', status: 'active', progress: 0.4, projection: { status: 'at_risk' }, target_date: '2026-11-30', notes: 'SECRET NOTE' }],
    balance: { pillars: [{ name: 'Health', score: 40 }] },
    behavior: { open_today: 3, overdue_open: 1, avg_daily_completions: 2.1, completion_rate: 0.75 },
    insights: [{ title: 'T', body: 'B' }],
  };
  const ctx = buildCoachContext(snap);
  assert.match(ctx, /Read: streak 5 days/);
  assert.match(ctx, /lapse risk today 60%/);
  assert.doesNotMatch(ctx, /SECRET NOTE/);
});

test('AI language instruction follows the requested locale', async () => {
  const { languageInstruction } = await import('./ai');
  assert.equal(languageInstruction('fr'), 'Reply in French.');
  assert.equal(languageInstruction('en'), 'Reply in English.');
});
