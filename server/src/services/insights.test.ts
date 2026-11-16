import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, diffDays, weekday, weekStart } from './dates';
import {
  buildInsights, GoalRow, goalProgress, habitDueOn, HabitRow, habitStats, lifeBalance, momentum, projectGoal, taskBehavior, TaskRow,
} from './insights';

const TODAY = '2026-11-04'; // a Wednesday
const habit = (o: Partial<HabitRow> = {}): HabitRow => ({
  id: 'h1', name: 'Read', frequency: 'daily', days_of_week: null, target_per_period: 1,
  start_date: '2026-08-01', paused_at: null, archived_at: null, life_area_id: 'a1', ...o,
});
const goal = (o: Partial<GoalRow> = {}): GoalRow => ({
  id: 'g1', title: 'Save', goal_type: 'monthly', status: 'active', created_at: '2026-10-01T00:00:00Z',
  start_date: '2026-10-01', target_date: '2026-11-30', measurement_type: 'percentage', target_value: null,
  current_value: 0, pillar_id: null, life_area_id: null, parent_goal_id: null, ...o,
});
const comp = (id: string, days: number[]) => days.map((n) => ({ habit_id: id, completed_on: addDays(TODAY, -n) }));

test('date helpers', () => {
  assert.equal(weekday(TODAY), 3);
  assert.equal(weekStart(TODAY), '2026-11-02');
  assert.equal(diffDays('2026-03-30', '2026-03-28'), 2);
});

test('goalProgress by measurement type', () => {
  assert.equal(goalProgress(goal({ current_value: 40 }), []), 0.4);
  assert.equal(goalProgress(goal({ measurement_type: 'currency', target_value: 200000, current_value: 50000 }), []), 0.25);
  assert.equal(goalProgress(goal({ measurement_type: 'milestones' }), [
    { goal_id: 'g1', completed_at: 'x' }, { goal_id: 'g1', completed_at: null }, { goal_id: 'other', completed_at: 'x' },
  ]), 0.5);
  assert.equal(goalProgress(goal({ status: 'completed' }), []), 1);
});

test('projectGoal flags goals that are behind and projects a finish date', () => {
  // 34 of 60 days used (57%), but only 20% done
  const p = projectGoal(goal(), 0.2, TODAY);
  assert.equal(p.status, 'behind');
  assert.ok(p.days_late! > 0);
  assert.ok(p.projected_completion! > '2026-11-30');
});

test('projectGoal on track and completed', () => {
  assert.equal(projectGoal(goal(), 0.6, TODAY).status, 'on_track');
  assert.equal(projectGoal(goal(), 1, TODAY).status, 'completed');
  assert.equal(projectGoal(goal({ target_date: null }), 0, TODAY).status, 'not_started');
});

test('habitDueOn respects schedule, pause and start date', () => {
  assert.equal(habitDueOn(habit({ frequency: 'weekdays' }), '2026-11-07'), false); // Saturday
  assert.equal(habitDueOn(habit({ frequency: 'custom', days_of_week: [3] }), TODAY), true);
  assert.equal(habitDueOn(habit({ paused_at: 'x' }), TODAY), false);
  assert.equal(habitDueOn(habit({ start_date: '2026-12-01' }), TODAY), false);
});

test('habit streak survives an open today and breaks on a miss', () => {
  const s = habitStats(habit(), comp('h1', [1, 2, 3, 5, 6]), TODAY);
  assert.equal(s.streak, 3);
  assert.equal(s.longest, 3);
  assert.equal(s.completed_today, false);
  const s2 = habitStats(habit(), comp('h1', [0, 1, 2]), TODAY);
  assert.equal(s2.streak, 3);
  assert.equal(s2.completed_today, true);
});

test('lapse risk is high for a weekday you usually skip', () => {
  // Done every day except Wednesdays over the last 8 weeks
  const days: number[] = [];
  for (let i = 1; i <= 56; i++) if (weekday(addDays(TODAY, -i)) !== 3) days.push(i);
  const s = habitStats(habit(), comp('h1', days), TODAY);
  assert.ok(s.lapse_risk !== null && s.lapse_risk > 0.7, `risk was ${s.lapse_risk}`);
  assert.notEqual(s.best_weekday, 'Wednesday');
});

test('best weekday is reported only when it clearly beats the average', () => {
  // Uniform habit: every day equally likely -> no pattern to report
  const uniform: number[] = [];
  for (let i = 1; i <= 56; i++) if (i % 4 !== 0) uniform.push(i);
  assert.equal(habitStats(habit(), comp('h1', uniform), TODAY).best_weekday, null);
  // Reliable on Mondays only, rarely otherwise -> Monday stands out
  const mondays: number[] = [];
  for (let i = 1; i <= 56; i++) { const d = addDays(TODAY, -i); if (weekday(d) === 1 || i % 6 === 0) mondays.push(i); }
  assert.equal(habitStats(habit(), comp('h1', mondays), TODAY).best_weekday, 'Monday');
});

test('weekly habit counts weeks that meet target', () => {
  const h = habit({ frequency: 'weekly', target_per_period: 2 });
  const s = habitStats(h, [...comp('h1', [8, 9]), ...comp('h1', [15, 16])], TODAY);
  assert.equal(s.streak_unit, 'weeks');
  assert.equal(s.streak, 2);
});

test('taskBehavior finds overdue, lateness and overload', () => {
  const mk = (i: number, due: string | null, done: string | null): TaskRow => ({
    id: `t${i}`, title: 't', priority: 'medium', due_date: due, completed_at: done, created_at: '2026-10-01T00:00:00Z', life_area_id: null, goal_id: null,
  });
  const tasks: TaskRow[] = [];
  for (let i = 0; i < 10; i++) tasks.push(mk(i, addDays(TODAY, -10 + i / 2 | 0), `${addDays(TODAY, -8 + (i / 2 | 0))}T09:30:00Z`));
  for (let i = 0; i < 9; i++) tasks.push(mk(100 + i, TODAY, null));
  const b = taskBehavior(tasks, TODAY, 'UTC');
  assert.equal(b.overloaded_today, true);
  assert.ok(b.avg_days_late !== null && b.avg_days_late >= 1);
  assert.equal(b.peak_hour, 9);
});

test('lifeBalance flags a neglected pillar and shares multi-pillar areas', () => {
  const tasks: TaskRow[] = Array.from({ length: 8 }, (_, i) => ({
    id: `t${i}`, title: 't', priority: 'low' as const, due_date: null, completed_at: `${addDays(TODAY, -i % 5)}T10:00:00Z`,
    created_at: '2026-10-01T00:00:00Z', life_area_id: 'fit', goal_id: null,
  }));
  const r = lifeBalance(tasks, [], [], [{ life_area_id: 'fit', pillar_id: 'health' }], [{ id: 'health', name: 'Health' }, { id: 'money', name: 'Money' }], TODAY, 'UTC');
  assert.equal(r.pillars.find((p) => p.pillar_id === 'money')!.neglected, true);
  assert.equal(r.pillars.find((p) => p.pillar_id === 'health')!.neglected, false);
});

test('momentum normalises over available components', () => {
  assert.equal(momentum({ habitRate7: null, taskRate: null, goalsOnTrack: null }), null);
  assert.equal(momentum({ habitRate7: 1, taskRate: null, goalsOnTrack: null }), 100);
  assert.equal(momentum({ habitRate7: 0.5, taskRate: 0.5, goalsOnTrack: 0.5 }), 50);
});

test('buildInsights surfaces a lapse prediction first', () => {
  const days: number[] = [];
  for (let i = 1; i <= 56; i++) if (weekday(addDays(TODAY, -i)) !== 3) days.push(i);
  const h = habit();
  const s = habitStats(h, comp('h1', days), TODAY);
  const insights = buildInsights({
    today: TODAY, habits: [h], habitStatsById: { h1: s }, goals: [], projections: {},
    behavior: taskBehavior([], TODAY, 'UTC'), balance: { pillars: [], total_events: 0 },
  });
  assert.equal(insights[0].id, 'lapse-h1');
});
