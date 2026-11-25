import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMonthlyReport, monthBounds } from './monthly-report';

test('monthBounds calculates days and previous month boundaries', () => {
  const b = monthBounds('2026-11');
  assert.equal(b.start, '2026-11-01');
  assert.equal(b.end, '2026-11-30');
  assert.equal(b.days, 30);
  assert.equal(b.prevStart, '2026-10-01');
  assert.equal(b.prevEnd, '2026-10-31');
});

test('buildMonthlyReport computes deltas, pillar map, worked/neglected areas, heatmap, and finance', () => {
  const report = buildMonthlyReport({
    month: '2026-11',
    tz: 'UTC',
    displayName: 'Nounga',
    currency: 'XAF',
    pillars: [
      { id: 'p1', name: 'Health and Wellbeing' },
      { id: 'p2', name: 'Financial Growth' },
      { id: 'p3', name: 'Professional Excellence' },
    ],
    areas: [
      { id: 'a1', name: 'Fitness' },
      { id: 'a2', name: 'Finance' },
      { id: 'a3', name: 'Relationships' },
    ],
    areaPillars: [
      { life_area_id: 'a1', pillar_id: 'p1' },
      { life_area_id: 'a2', pillar_id: 'p2' },
      { life_area_id: 'a3', pillar_id: 'p3' },
    ],
    tasks: [
      { id: 't1', title: 'Run 5k', priority: 'high', due_date: '2026-11-05', completed_at: '2026-11-05T10:00:00Z', created_at: '2026-11-01T08:00:00Z', life_area_id: 'a1', goal_id: null },
      { id: 't2', title: 'Audit budget', priority: 'medium', due_date: '2026-11-10', completed_at: '2026-11-10T10:00:00Z', created_at: '2026-11-01T08:00:00Z', life_area_id: 'a2', goal_id: null },
      { id: 't3', title: 'Oct task', priority: 'low', due_date: '2026-10-15', completed_at: '2026-10-15T10:00:00Z', created_at: '2026-10-01T08:00:00Z', life_area_id: 'a1', goal_id: null },
    ],
    habits: [
      { id: 'h1', name: 'Morning stretch', frequency: 'daily', days_of_week: null, target_per_period: 1, start_date: '2026-10-01', paused_at: null, archived_at: null, life_area_id: 'a1' },
    ],
    completions: [
      { habit_id: 'h1', completed_on: '2026-11-05' },
      { habit_id: 'h1', completed_on: '2026-11-06' },
      { habit_id: 'h1', completed_on: '2026-10-15' },
    ],
    goals: [
      { id: 'g1', title: 'Save 100k', goal_type: 'monthly', status: 'active', target_date: '2026-11-30', measurement_type: 'currency', target_value: 100000, current_value: 60000, parent_goal_id: null, created_at: '2026-11-01T08:00:00Z', start_date: '2026-11-01', pillar_id: 'p2', life_area_id: 'a2' },
    ],
    milestones: [],
    income: [
      { amount: 200000, received_on: '2026-11-02' },
      { amount: 150000, received_on: '2026-10-02' },
    ],
    expenses: [
      { amount: 50000, category: 'food', spent_on: '2026-11-03' },
      { amount: 30000, category: 'food', spent_on: '2026-11-12' },
      { amount: 40000, category: 'food', spent_on: '2026-10-05' },
    ],
    budgets: [{ category: 'food', amount: 70000 }],
    foodLogs: [
      { logged_on: '2026-11-05', meal_type: 'breakfast' },
      { logged_on: '2026-11-05', meal_type: 'lunch' },
    ],
    waterLogs: [{ logged_on: '2026-11-05', amount_ml: 1500 }],
    workoutLogs: [{ logged_on: '2026-11-05', is_rest_day: false }],
    readingSessions: [{ session_on: '2026-11-05', minutes: 40 }],
    screenTime: [{ used_on: '2026-11-05', minutes: 60 }],
    dailyReviews: [{ review_date: '2026-11-05', wins: 'Finished 5k', lessons: 'Prep breakfast earlier', rating: 5 }],
    transformationAreaCount: 1,
    transformationCheckins: [{ week_start: '2026-11-02', current_score: 7 }],
  });

  assert.equal(report.scorecard.tasks_completed, 2);
  assert.equal(report.scorecard.tasks_delta, 1);
  assert.equal(report.scorecard.income, 200000);
  assert.equal(report.scorecard.spent, 80000);
  assert.equal(report.scorecard.net, 120000);
  assert.equal(report.scorecard.savings_rate_pct, 60);
  assert.equal(report.finance.categories[0].over, true);
  assert.equal(report.areas.worked_on[0].name, 'Fitness');
  assert.ok(report.areas.needs_work.some((a) => a.name === 'Relationships'));
  assert.equal(report.pillars.find((p) => p.id === 'p3')?.neglected, true);
  assert.equal(report.daily_heatmap[4].activity_count, 7);
  assert.equal(report.goals[0].progress_pct, 60);
  assert.ok(report.reflections.next_month_focus.some((f) => f.startsWith('budget:food')));
});
