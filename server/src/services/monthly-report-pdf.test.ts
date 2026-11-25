import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMonthlyReport } from './monthly-report';
import { renderMonthlyReportPdf } from './monthly-report-pdf';

test('renderMonthlyReportPdf produces valid 4-page PDF with charts in EN and FR', () => {
  const report = buildMonthlyReport({
    month: '2026-11',
    tz: 'UTC',
    displayName: 'Nounga',
    currency: 'XAF',
    pillars: [
      { id: 'p1', name: 'Health' },
      { id: 'p2', name: 'Finance' },
      { id: 'p3', name: 'Work' },
      { id: 'p4', name: 'Mind' },
      { id: 'p5', name: 'Relationships' },
    ],
    areas: [
      { id: 'a1', name: 'Fitness' },
      { id: 'a2', name: 'Finance' },
    ],
    areaPillars: [
      { life_area_id: 'a1', pillar_id: 'p1' },
      { life_area_id: 'a2', pillar_id: 'p2' },
    ],
    tasks: [{ id: 't1', title: 'Task 1', priority: 'high', due_date: '2026-11-05', completed_at: '2026-11-05T12:00:00Z', created_at: '2026-11-01T08:00:00Z', life_area_id: 'a1', goal_id: null }],
    habits: [{ id: 'h1', name: 'Read', frequency: 'daily', days_of_week: null, target_per_period: 1, start_date: '2026-11-01', paused_at: null, archived_at: null, life_area_id: 'a1' }],
    completions: [{ habit_id: 'h1', completed_on: '2026-11-05' }],
    goals: [{ id: 'g1', title: 'Emergency Fund', goal_type: 'monthly', status: 'active', target_date: '2026-11-30', measurement_type: 'currency', target_value: 100000, current_value: 50000, parent_goal_id: null, created_at: '2026-11-01T08:00:00Z', start_date: '2026-11-01', pillar_id: 'p2', life_area_id: 'a2' }],
    milestones: [],
    income: [{ amount: 120000, received_on: '2026-11-01' }],
    expenses: [{ amount: 45000, category: 'food', spent_on: '2026-11-03' }],
    budgets: [],
    foodLogs: [{ logged_on: '2026-11-05', meal_type: 'breakfast' }],
    waterLogs: [],
    workoutLogs: [],
    readingSessions: [],
    screenTime: [],
    dailyReviews: [{ review_date: '2026-11-05', wins: 'Great momentum', lessons: 'Keep bedtime steady', rating: 4 }],
    transformationAreaCount: 1,
    transformationCheckins: [{ week_start: '2026-11-02', current_score: 6 }],
  });

  const enPdf = renderMonthlyReportPdf(report, 'en');
  const enStr = enPdf.toString('latin1');
  assert.ok(enStr.startsWith('%PDF-1.4'));
  assert.ok(enStr.includes('/Count 4'));
  assert.ok(enStr.includes('xref'));
  assert.ok(enStr.trimEnd().endsWith('%%EOF'));

  const frPdf = renderMonthlyReportPdf(report, 'fr');
  const frStr = frPdf.toString('latin1');
  assert.ok(frStr.startsWith('%PDF-1.4'));
  assert.ok(frStr.includes('Bilan de Croissance'));
});
