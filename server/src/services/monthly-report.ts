import type { SupabaseClient } from '@supabase/supabase-js';
import { profileRepository } from '../repositories/profile.repository';
import { ensureTaxonomySeeded } from '../repositories/taxonomy.repository';
import { AppError } from '../utils/errors';
import { addDays, localDate } from './dates';
import {
  AreaPillar,
  CompletionRow,
  GoalRow,
  goalProgress,
  habitDueOn,
  HabitRow,
  MilestoneRow,
  PillarRow,
  TaskRow,
} from './insights';

export interface MonthlyReportData {
  month: string;
  month_start: string;
  month_end: string;
  days_in_month: number;
  display_name: string | null;
  currency: string;
  scorecard: {
    tasks_completed: number;
    prev_tasks_completed: number;
    tasks_delta: number;
    habit_rate_pct: number;
    prev_habit_rate_pct: number;
    habit_rate_delta: number;
    checkin_days: number;
    avg_rating: number | null;
    income: number;
    spent: number;
    net: number;
    savings_rate_pct: number | null;
    meals_logged: number;
    workouts: number;
    reading_minutes: number;
  };
  pillars: { id: string; name: string; score: number; events: number; neglected: boolean }[];
  areas: {
    worked_on: { id: string; name: string; events: number }[];
    needs_work: { id: string; name: string; events: number }[];
  };
  daily_heatmap: { date: string; day: number; activity_count: number; meals_count: number; rating: number | null }[];
  habits: { id: string; name: string; completed: number; due: number; rate_pct: number; best_streak: number }[];
  goals: { id: string; title: string; goal_type: string; status: string; progress_pct: number }[];
  finance: {
    income: number;
    spent: number;
    net: number;
    prev_income: number;
    prev_spent: number;
    prev_net: number;
    savings_rate_pct: number | null;
    categories: { category: string; spent: number; budget: number | null; over: boolean }[];
  };
  body_mind: {
    breakfast_days: number;
    lunch_days: number;
    dinner_days: number;
    total_meals: number;
    avg_water_ml: number;
    workouts: number;
    reading_minutes: number;
    screen_time_minutes: number;
  };
  transformation: {
    area_count: number;
    scores: { week_start: string; avg_score: number }[];
  };
  reflections: {
    wins: string[];
    lessons: string[];
    next_month_focus: string[];
  };
}

export interface MonthlyReportInputs {
  month: string;
  tz: string;
  displayName: string | null;
  currency: string;
  pillars: PillarRow[];
  areas: { id: string; name: string }[];
  areaPillars: AreaPillar[];
  tasks: TaskRow[];
  habits: HabitRow[];
  completions: CompletionRow[];
  goals: GoalRow[];
  milestones: MilestoneRow[];
  income: { amount: number; received_on: string }[];
  expenses: { amount: number; category: string; spent_on: string }[];
  budgets: { category: string; amount: number }[];
  foodLogs: { logged_on: string; meal_type: string }[];
  waterLogs: { logged_on: string; amount_ml: number }[];
  workoutLogs: { logged_on: string; is_rest_day: boolean }[];
  readingSessions: { session_on: string; minutes: number }[];
  screenTime: { used_on: string; minutes: number }[];
  dailyReviews: { review_date: string; wins: string | null; lessons: string | null; rating: number | null }[];
  transformationAreaCount: number;
  transformationCheckins: { week_start: string; current_score: number }[];
}

export function monthBounds(month: string): { start: string; end: string; days: number; prevStart: string; prevEnd: string } {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0));
  const prevFirst = new Date(Date.UTC(y, m - 2, 1));
  const prevLast = new Date(Date.UTC(y, m - 1, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    start: iso(first),
    end: iso(last),
    days: last.getUTCDate(),
    prevStart: iso(prevFirst),
    prevEnd: iso(prevLast),
  };
}

export function buildMonthlyReport(input: MonthlyReportInputs): MonthlyReportData {
  const { start, end, days, prevStart, prevEnd } = monthBounds(input.month);
  const inMonth = (d: string | null | undefined) => !!d && d >= start && d <= end;
  const inPrev = (d: string | null | undefined) => !!d && d >= prevStart && d <= prevEnd;

  const doneSet = new Set(input.completions.map((c) => `${c.habit_id}|${c.completed_on}`));
  const tasksDoneMonth = input.tasks.filter((t) => t.completed_at && inMonth(localDate(t.completed_at, input.tz)));
  const tasksDonePrev = input.tasks.filter((t) => t.completed_at && inPrev(localDate(t.completed_at, input.tz)));

  // Habits in target month & prev month
  let totalDue = 0;
  let totalDone = 0;
  const habitRows = input.habits.map((h) => {
    let due = 0;
    let completed = 0;
    let run = 0;
    let best = 0;
    for (let i = 0; i < days; i++) {
      const d = addDays(start, i);
      const isDone = doneSet.has(`${h.id}|${d}`);
      if (isDone) {
        run++;
        if (run > best) best = run;
      } else if (habitDueOn(h, d)) {
        run = 0;
      }
      if (habitDueOn(h, d)) {
        due++;
        if (isDone) completed++;
      } else if (isDone) {
        completed++;
      }
    }
    totalDue += due;
    totalDone += Math.min(due || completed, completed);
    const rate = due > 0 ? Math.min(100, Math.round((completed / due) * 100)) : completed > 0 ? 100 : 0;
    return { id: h.id, name: h.name, completed, due, rate_pct: rate, best_streak: best };
  });
  const habitRatePct = totalDue > 0 ? Math.min(100, Math.round((totalDone / totalDue) * 100)) : 0;

  let prevDue = 0;
  let prevDone = 0;
  const prevDays = monthBounds(prevStart.slice(0, 7)).days;
  for (const h of input.habits) {
    for (let i = 0; i < prevDays; i++) {
      const d = addDays(prevStart, i);
      if (habitDueOn(h, d)) {
        prevDue++;
        if (doneSet.has(`${h.id}|${d}`)) prevDone++;
      }
    }
  }
  const prevHabitRatePct = prevDue > 0 ? Math.min(100, Math.round((prevDone / prevDue) * 100)) : 0;

  // Areas & Pillars activity counts in target month
  const areaEvents = new Map<string, number>();
  for (const a of input.areas) areaEvents.set(a.id, 0);
  for (const t of tasksDoneMonth) {
    if (t.life_area_id) areaEvents.set(t.life_area_id, (areaEvents.get(t.life_area_id) ?? 0) + 1);
  }
  const habitAreaById = new Map(input.habits.map((h) => [h.id, h.life_area_id]));
  for (const c of input.completions) {
    if (!inMonth(c.completed_on)) continue;
    const areaId = habitAreaById.get(c.habit_id);
    if (areaId) areaEvents.set(areaId, (areaEvents.get(areaId) ?? 0) + 1);
  }

  const areaSorted = input.areas
    .map((a) => ({ id: a.id, name: a.name, events: areaEvents.get(a.id) ?? 0 }))
    .sort((a, b) => b.events - a.events);
  const workedOn = areaSorted.filter((a) => a.events > 0).slice(0, 5);
  const needsWork = [...areaSorted].reverse().filter((a) => a.events <= 1).slice(0, 5);

  const areaToPillars = new Map<string, string[]>();
  for (const ap of input.areaPillars) {
    areaToPillars.set(ap.life_area_id, [...(areaToPillars.get(ap.life_area_id) ?? []), ap.pillar_id]);
  }
  const pillarCounts = new Map<string, number>();
  for (const p of input.pillars) pillarCounts.set(p.id, 0);
  for (const [areaId, count] of areaEvents.entries()) {
    for (const pid of areaToPillars.get(areaId) ?? []) {
      pillarCounts.set(pid, (pillarCounts.get(pid) ?? 0) + count);
    }
  }
  const maxPillar = Math.max(1, ...pillarCounts.values());
  const pillars = input.pillars.map((p) => {
    const events = pillarCounts.get(p.id) ?? 0;
    const score = Math.round((events / maxPillar) * 100);
    return { id: p.id, name: p.name, score, events, neglected: events === 0 || score < 25 };
  });

  // Daily heatmap
  const reviewsByDay = new Map(input.dailyReviews.filter((r) => inMonth(r.review_date)).map((r) => [r.review_date, r]));
  const dailyHeatmap = Array.from({ length: days }, (_, idx) => {
    const date = addDays(start, idx);
    const taskCount = tasksDoneMonth.filter((t) => localDate(t.completed_at!, input.tz) === date).length;
    const habitCount = input.completions.filter((c) => c.completed_on === date).length;
    const mealsCount = input.foodLogs.filter((f) => f.logged_on === date).length;
    const workoutCount = input.workoutLogs.filter((w) => w.logged_on === date && !w.is_rest_day).length;
    const readingCount = input.readingSessions.filter((r) => r.session_on === date).length;
    const rev = reviewsByDay.get(date);
    return {
      date,
      day: idx + 1,
      activity_count: taskCount + habitCount + mealsCount + workoutCount + readingCount + (rev ? 1 : 0),
      meals_count: mealsCount,
      rating: rev?.rating ?? null,
    };
  });

  // Goals
  const goals = input.goals
    .filter((g) => g.status === 'active' || (g.status === 'completed' && inMonth(g.target_date ?? end)))
    .slice(0, 12)
    .map((g) => ({
      id: g.id,
      title: g.title,
      goal_type: g.goal_type,
      status: g.status,
      progress_pct: Math.round(goalProgress(g, input.milestones) * 100),
    }));

  // Finance
  const monthInc = input.income.filter((r) => inMonth(r.received_on)).reduce((s, r) => s + Number(r.amount || 0), 0);
  const monthExpRows = input.expenses.filter((r) => inMonth(r.spent_on));
  const monthSpent = monthExpRows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const prevInc = input.income.filter((r) => inPrev(r.received_on)).reduce((s, r) => s + Number(r.amount || 0), 0);
  const prevSpent = input.expenses.filter((r) => inPrev(r.spent_on)).reduce((s, r) => s + Number(r.amount || 0), 0);
  const net = monthInc - monthSpent;
  const savingsRatePct = monthInc > 0 ? Math.round((net / monthInc) * 100) : null;

  const catTotals = new Map<string, number>();
  for (const e of monthExpRows) {
    const k = String(e.category || 'other').toLowerCase();
    catTotals.set(k, (catTotals.get(k) ?? 0) + Number(e.amount || 0));
  }
  const budgetMap = new Map(input.budgets.map((b) => [String(b.category).toLowerCase(), Number(b.amount || 0)]));
  const allCats = [...new Set([...catTotals.keys(), ...budgetMap.keys()])];
  const categories = allCats
    .map((category) => {
      const spent = catTotals.get(category) ?? 0;
      const budget = budgetMap.get(category) ?? null;
      return { category, spent, budget, over: budget !== null && spent > budget };
    })
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 8);

  // Body & Mind
  const monthMeals = input.foodLogs.filter((f) => inMonth(f.logged_on));
  const uniqueDaysFor = (slot: string) => new Set(monthMeals.filter((m) => m.meal_type === slot).map((m) => m.logged_on)).size;
  const monthWater = input.waterLogs.filter((w) => inMonth(w.logged_on));
  const waterTotal = monthWater.reduce((s, w) => s + Number(w.amount_ml || 0), 0);
  const waterDays = Math.max(1, new Set(monthWater.map((w) => w.logged_on)).size);
  const workouts = input.workoutLogs.filter((w) => inMonth(w.logged_on) && !w.is_rest_day).length;
  const readingMinutes = input.readingSessions.filter((r) => inMonth(r.session_on)).reduce((s, r) => s + Number(r.minutes || 0), 0);
  const screenMinutes = input.screenTime.filter((u) => inMonth(u.used_on)).reduce((s, u) => s + Number(u.minutes || 0), 0);

  // Transformation trajectory
  const byWeek = new Map<string, number[]>();
  for (const tc of input.transformationCheckins) {
    if (inMonth(tc.week_start)) {
      byWeek.set(tc.week_start, [...(byWeek.get(tc.week_start) ?? []), Number(tc.current_score)]);
    }
  }
  const scores = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week_start, vals]) => ({
      week_start,
      avg_score: Number((vals.reduce((s, n) => s + n, 0) / vals.length).toFixed(1)),
    }));

  // Reflections & recommendations
  const monthReviews = input.dailyReviews.filter((r) => inMonth(r.review_date));
  const rated = monthReviews.map((r) => r.rating).filter((n): n is number => typeof n === 'number' && n > 0);
  const avgRating = rated.length ? Number((rated.reduce((s, n) => s + n, 0) / rated.length).toFixed(1)) : null;
  const wins = monthReviews.map((r) => r.wins?.trim()).filter((w): w is string => !!w).slice(0, 5);
  const lessons = monthReviews.map((r) => r.lessons?.trim()).filter((l): l is string => !!l).slice(0, 5);

  const focus: string[] = [];
  const neglectedPillar = pillars.find((p) => p.neglected);
  if (neglectedPillar) focus.push(`pillar:${neglectedPillar.name}`);
  const weakHabit = [...habitRows].sort((a, b) => a.rate_pct - b.rate_pct).find((h) => h.due > 0 && h.rate_pct < 60);
  if (weakHabit) focus.push(`habit:${weakHabit.name}:${weakHabit.rate_pct}`);
  const overCat = categories.find((c) => c.over);
  if (overCat) focus.push(`budget:${overCat.category}`);
  if (uniqueDaysFor('breakfast') < Math.floor(days / 3)) focus.push('meals:breakfast');
  if (monthReviews.length < Math.floor(days / 3)) focus.push('checkin:consistency');

  return {
    month: input.month,
    month_start: start,
    month_end: end,
    days_in_month: days,
    display_name: input.displayName,
    currency: input.currency,
    scorecard: {
      tasks_completed: tasksDoneMonth.length,
      prev_tasks_completed: tasksDonePrev.length,
      tasks_delta: tasksDoneMonth.length - tasksDonePrev.length,
      habit_rate_pct: habitRatePct,
      prev_habit_rate_pct: prevHabitRatePct,
      habit_rate_delta: habitRatePct - prevHabitRatePct,
      checkin_days: monthReviews.length,
      avg_rating: avgRating,
      income: monthInc,
      spent: monthSpent,
      net,
      savings_rate_pct: savingsRatePct,
      meals_logged: monthMeals.length,
      workouts,
      reading_minutes: readingMinutes,
    },
    pillars,
    areas: { worked_on: workedOn, needs_work: needsWork },
    daily_heatmap: dailyHeatmap,
    habits: habitRows,
    goals,
    finance: {
      income: monthInc,
      spent: monthSpent,
      net,
      prev_income: prevInc,
      prev_spent: prevSpent,
      prev_net: prevInc - prevSpent,
      savings_rate_pct: savingsRatePct,
      categories,
    },
    body_mind: {
      breakfast_days: uniqueDaysFor('breakfast'),
      lunch_days: uniqueDaysFor('lunch'),
      dinner_days: uniqueDaysFor('dinner'),
      total_meals: monthMeals.length,
      avg_water_ml: monthWater.length ? Math.round(waterTotal / waterDays) : 0,
      workouts,
      reading_minutes: readingMinutes,
      screen_time_minutes: screenMinutes,
    },
    transformation: {
      area_count: input.transformationAreaCount,
      scores,
    },
    reflections: {
      wins,
      lessons,
      next_month_focus: focus.slice(0, 4),
    },
  };
}

async function safeList<T>(p: PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  try {
    const { data, error } = await p;
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export async function loadMonthlyReport(db: SupabaseClient, userId: string, month: string): Promise<MonthlyReportData> {
  await ensureTaxonomySeeded();
  const profile = await profileRepository.get(db, userId);
  const tz: string = profile?.timezone ?? 'UTC';
  const { start, end, prevStart } = monthBounds(month);
  const prevIso = `${prevStart}T00:00:00Z`;

  const [
    pillarsRes, areasRes, areaPillarsRes, tasks, habits, completions, goals,
    income, expenses, budgets, foodLogs, waterLogs, workoutLogs, readingSessions,
    screenTime, dailyReviews, tAreas, tCheckins,
  ] = await Promise.all([
    db.from('life_pillars').select('id,name').order('sort_order'),
    db.from('life_areas').select('id,name').order('sort_order'),
    db.from('life_area_pillars').select('life_area_id,pillar_id'),
    safeList<TaskRow>(db.from('tasks').select('id,title,priority,due_date,completed_at,created_at,life_area_id,goal_id').eq('user_id', userId).gte('completed_at', prevIso).limit(2000)),
    safeList<HabitRow>(db.from('habits').select('id,name,frequency,days_of_week,target_per_period,start_date,paused_at,archived_at,life_area_id').eq('user_id', userId).is('archived_at', null)),
    safeList<CompletionRow>(db.from('habit_completions').select('habit_id,completed_on').eq('user_id', userId).gte('completed_on', prevStart).lte('completed_on', end).limit(5000)),
    safeList<GoalRow>(db.from('goals').select('*').eq('user_id', userId).not('status', 'in', '(abandoned)')),
    safeList<{ amount: number; received_on: string }>(db.from('income_records').select('amount,received_on').eq('user_id', userId).gte('received_on', prevStart).lte('received_on', end)),
    safeList<{ amount: number; category: string; spent_on: string }>(db.from('expense_records').select('amount,category,spent_on').eq('user_id', userId).gte('spent_on', prevStart).lte('spent_on', end)),
    safeList<{ category: string; amount: number }>(db.from('budgets').select('category,amount').eq('user_id', userId).eq('month', start)),
    safeList<{ logged_on: string; meal_type: string }>(db.from('food_logs').select('logged_on,meal_type').eq('user_id', userId).gte('logged_on', start).lte('logged_on', end)),
    safeList<{ logged_on: string; amount_ml: number }>(db.from('water_logs').select('logged_on,amount_ml').eq('user_id', userId).gte('logged_on', start).lte('logged_on', end)),
    safeList<{ logged_on: string; is_rest_day: boolean }>(db.from('workout_logs').select('logged_on,is_rest_day').eq('user_id', userId).gte('logged_on', start).lte('logged_on', end)),
    safeList<{ session_on: string; minutes: number }>(db.from('reading_sessions').select('session_on,minutes').eq('user_id', userId).gte('session_on', start).lte('session_on', end)),
    safeList<{ used_on: string; minutes: number }>(db.from('screen_time_usage').select('used_on,minutes').eq('user_id', userId).gte('used_on', start).lte('used_on', end)),
    safeList<{ review_date: string; wins: string | null; lessons: string | null; rating: number | null }>(db.from('daily_reviews').select('review_date,wins,lessons,rating').eq('user_id', userId).gte('review_date', start).lte('review_date', end).order('review_date')),
    safeList<{ id: string }>(db.from('transformation_areas').select('id').eq('user_id', userId)),
    safeList<{ week_start: string; current_score: number }>(db.from('transformation_checkins').select('week_start,current_score').eq('user_id', userId).gte('week_start', addDays(start, -7)).lte('week_start', end)),
  ]);

  if (pillarsRes.error || areasRes.error || areaPillarsRes.error) {
    throw new AppError(500, 'DB_ERROR', 'Could not load taxonomy for monthly report');
  }

  const goalIds = goals.map((g) => g.id);
  const milestones = goalIds.length
    ? await safeList<MilestoneRow>(db.from('goal_milestones').select('goal_id,completed_at').eq('user_id', userId).in('goal_id', goalIds))
    : [];

  return buildMonthlyReport({
    month,
    tz,
    displayName: profile?.display_name ?? null,
    currency: profile?.currency ?? 'XAF',
    pillars: (pillarsRes.data ?? []) as PillarRow[],
    areas: (areasRes.data ?? []) as { id: string; name: string }[],
    areaPillars: (areaPillarsRes.data ?? []) as AreaPillar[],
    tasks,
    habits,
    completions,
    goals,
    milestones,
    income,
    expenses,
    budgets,
    foodLogs,
    waterLogs,
    workoutLogs,
    readingSessions,
    screenTime,
    dailyReviews,
    transformationAreaCount: tAreas.length,
    transformationCheckins: tCheckins,
  });
}
