import { addDays, diffDays, localDate, localHour, monthKey, WEEKDAY_NAMES, weekday, weekStart } from './dates';

// ---------- Input row shapes (subset of DB columns) ----------
export interface TaskRow {
  id: string; title: string; priority: 'low' | 'medium' | 'high'; due_date: string | null;
  completed_at: string | null; created_at: string; life_area_id: string | null; goal_id: string | null;
}
export interface HabitRow {
  id: string; name: string; frequency: 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom';
  days_of_week: number[] | null; target_per_period: number; start_date: string;
  paused_at: string | null; archived_at: string | null; life_area_id: string | null;
}
export interface CompletionRow { habit_id: string; completed_on: string }
export interface GoalRow {
  id: string; title: string; goal_type: string; status: string; created_at: string;
  start_date: string | null; target_date: string | null; measurement_type: string;
  target_value: number | null; current_value: number; pillar_id: string | null; life_area_id: string | null;
  parent_goal_id: string | null;
}
export interface MilestoneRow { goal_id: string; completed_at: string | null }
export interface AreaPillar { life_area_id: string; pillar_id: string }
export interface PillarRow { id: string; name: string }

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const round = (n: number, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

// ---------- Goals ----------
export function goalProgress(goal: GoalRow, milestones: MilestoneRow[]): number {
  if (goal.status === 'completed') return 1;
  if (goal.measurement_type === 'milestones') {
    const own = milestones.filter((m) => m.goal_id === goal.id);
    return own.length ? own.filter((m) => m.completed_at).length / own.length : 0;
  }
  if (goal.measurement_type === 'percentage') return clamp01(Number(goal.current_value) / 100);
  const target = Number(goal.target_value ?? 0);
  return target > 0 ? clamp01(Number(goal.current_value) / target) : 0;
}

export type PaceStatus = 'completed' | 'on_track' | 'at_risk' | 'behind' | 'no_deadline' | 'not_started';
export interface GoalProjection {
  status: PaceStatus;
  progress: number;
  elapsed_fraction: number | null;
  projected_completion: string | null;
  days_late: number | null; // positive = projected after target
  days_remaining: number | null;
}

/** Compares real progress with the share of the time window already used, and extrapolates the current pace. */
export function projectGoal(goal: GoalRow, progress: number, today: string): GoalProjection {
  const base = { progress: round(progress), elapsed_fraction: null, projected_completion: null, days_late: null, days_remaining: null };
  if (progress >= 1) return { ...base, status: 'completed' };
  const start = goal.start_date ?? goal.created_at.slice(0, 10);
  const elapsedDays = Math.max(0, diffDays(today, start));
  const target = goal.target_date;
  const daysRemaining = target ? diffDays(target, today) : null;

  let projected: string | null = null;
  if (progress > 0 && elapsedDays > 0) {
    const perDay = progress / elapsedDays;
    projected = addDays(today, Math.ceil((1 - progress) / perDay));
  }
  if (!target) return { ...base, status: progress === 0 ? 'not_started' : 'no_deadline', projected_completion: projected, days_remaining: null };

  const total = diffDays(target, start);
  const elapsedFraction = total > 0 ? clamp01(elapsedDays / total) : 1;
  const daysLate = projected ? diffDays(projected, target) : null;

  let status: PaceStatus;
  if (progress === 0 && elapsedDays === 0) status = 'not_started';
  else if (diffDays(today, target) > 0) status = 'behind'; // deadline passed, not complete
  else if (progress >= elapsedFraction * 0.9) status = 'on_track';
  else if (progress >= elapsedFraction * 0.6) status = 'at_risk';
  else status = 'behind';

  return { status, progress: round(progress), elapsed_fraction: round(elapsedFraction), projected_completion: projected, days_late: daysLate, days_remaining: daysRemaining };
}

// ---------- Habits ----------
export function habitDueOn(h: HabitRow, date: string): boolean {
  if (h.archived_at || h.paused_at || date < h.start_date) return false;
  const wd = weekday(date);
  switch (h.frequency) {
    case 'daily': return true;
    case 'weekdays': return h.days_of_week?.length ? h.days_of_week.includes(wd) : wd >= 1 && wd <= 5;
    case 'custom': return (h.days_of_week ?? []).includes(wd);
    default: return true; // weekly / monthly habits are flexible: any day counts toward the target
  }
}
const isFlexible = (h: HabitRow) => h.frequency === 'weekly' || h.frequency === 'monthly';

export interface HabitStats {
  streak: number; streak_unit: 'days' | 'weeks' | 'months'; longest: number;
  rate30: number; completed_today: boolean; due_today: boolean;
  best_weekday: string | null; lapse_risk: number | null; // probability (0-1) of missing today if still open
}

export function habitStats(h: HabitRow, completions: CompletionRow[], today: string): HabitStats {
  const done = new Set(completions.filter((c) => c.habit_id === h.id).map((c) => c.completed_on));
  const completedToday = done.has(today);
  const dueToday = habitDueOn(h, today);

  let streak = 0, longest = 0, unit: HabitStats['streak_unit'] = 'days', rate30 = 0;

  if (!isFlexible(h)) {
    // Walk back through due days; an open "today" does not break the streak.
    let run = 0, brokeCurrent = false, dueCount = 0, hitCount = 0;
    for (let i = 0; i < 365; i++) {
      const d = addDays(today, -i);
      if (d < h.start_date) break;
      if (!habitDueOn({ ...h, paused_at: null }, d)) continue;
      const hit = done.has(d);
      if (i === 0 && !hit) continue;
      if (i < 30) { dueCount++; if (hit) hitCount++; }
      if (hit) { run++; if (!brokeCurrent) streak = run; longest = Math.max(longest, run); }
      else { brokeCurrent = true; run = 0; }
    }
    rate30 = dueCount ? hitCount / dueCount : 0;
  } else {
    unit = h.frequency === 'weekly' ? 'weeks' : 'months';
    const key = (d: string) => (unit === 'weeks' ? weekStart(d) : monthKey(d));
    const counts = new Map<string, number>();
    for (const d of done) counts.set(key(d), (counts.get(key(d)) ?? 0) + 1);
    const target = Math.max(1, h.target_per_period);
    let run = 0, broke = false;
    for (let i = 0; i < 52; i++) {
      const anchor = unit === 'weeks' ? addDays(weekStart(today), -7 * i) : monthBack(today, i);
      const k = unit === 'weeks' ? anchor : monthKey(anchor);
      const startKey = unit === 'weeks' ? weekStart(h.start_date) : monthKey(h.start_date);
      if (k < startKey) break;
      const met = (counts.get(k) ?? 0) >= target;
      if (i === 0 && !met) continue; // current period still in progress
      if (met) { run++; if (!broke) streak = run; longest = Math.max(longest, run); } else { broke = true; run = 0; }
    }
    let last30 = 0;
    for (const d of done) if (diffDays(today, d) >= 0 && diffDays(today, d) < 30) last30++;
    const expected = unit === 'weeks' ? target * (30 / 7) : target;
    rate30 = clamp01(last30 / expected);
  }

  // Weekday pattern + lapse prediction (scheduled habits only)
  let bestWeekday: string | null = null, lapseRisk: number | null = null;
  if (!isFlexible(h)) {
    const hits = Array(7).fill(0), due = Array(7).fill(0);
    for (let i = 1; i <= 56; i++) {
      const d = addDays(today, -i);
      if (d < h.start_date) break;
      if (!habitDueOn({ ...h, paused_at: null }, d)) continue;
      due[weekday(d)]++; if (done.has(d)) hits[weekday(d)]++;
    }
    let best = -1, bestRate = -1;
    for (let w = 0; w < 7; w++) if (due[w] >= 3 && hits[w] / due[w] > bestRate) { bestRate = hits[w] / due[w]; best = w; }
    const totalDue = due.reduce((a: number, b: number) => a + b, 0);
    const overall = totalDue ? hits.reduce((a: number, b: number) => a + b, 0) / totalDue : 0;
    // Only call a weekday "best" when it clearly beats the habit's average; otherwise it is just noise.
    if (best >= 0 && bestRate > 0 && bestRate - overall >= 0.15) bestWeekday = WEEKDAY_NAMES[best];
    const wd = weekday(today);
    if (dueToday && !completedToday && due[wd] >= 3) lapseRisk = round(1 - (hits[wd] + 1) / (due[wd] + 2)); // Laplace-smoothed
  }
  return { streak, streak_unit: unit, longest, rate30: round(rate30), completed_today: completedToday, due_today: dueToday, best_weekday: bestWeekday, lapse_risk: lapseRisk };
}
function monthBack(d: string, n: number): string {
  const [y, m] = d.split('-').map(Number);
  const idx = y * 12 + (m - 1) - n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}-01`;
}

// ---------- Tasks ----------
export interface TaskBehavior {
  window_days: number; due_total: number; done_total: number; completion_rate: number | null;
  overdue_open: number; avg_days_late: number | null; best_weekday: string | null; peak_hour: number | null;
  avg_daily_completions: number; open_today: number; overloaded_today: boolean;
}
export function taskBehavior(tasks: TaskRow[], today: string, tz: string, windowDays = 28): TaskBehavior {
  const from = addDays(today, -windowDays + 1);
  const dueInWindow = tasks.filter((t) => t.due_date && t.due_date >= from && t.due_date < today);
  const doneDue = dueInWindow.filter((t) => t.completed_at);
  const completedInWindow = tasks.filter((t) => t.completed_at && localDate(t.completed_at, tz) >= from);

  const lateDays = doneDue.map((t) => Math.max(0, diffDays(localDate(t.completed_at!, tz), t.due_date!)));
  const byWeekday = Array(7).fill(0), byHour = Array(24).fill(0);
  for (const t of completedInWindow) { byWeekday[weekday(localDate(t.completed_at!, tz))]++; byHour[localHour(t.completed_at!, tz)]++; }
  const enough = completedInWindow.length >= 8;
  const maxOf = (a: number[]) => a.indexOf(Math.max(...a));
  const openToday = tasks.filter((t) => !t.completed_at && t.due_date && t.due_date <= today).length;
  const avgDaily = completedInWindow.length / windowDays;

  return {
    window_days: windowDays,
    due_total: dueInWindow.length, done_total: doneDue.length,
    completion_rate: dueInWindow.length >= 3 ? round(doneDue.length / dueInWindow.length) : null,
    overdue_open: tasks.filter((t) => !t.completed_at && t.due_date && t.due_date < today).length,
    avg_days_late: lateDays.length >= 3 ? round(lateDays.reduce((a, b) => a + b, 0) / lateDays.length, 1) : null,
    best_weekday: enough ? WEEKDAY_NAMES[maxOf(byWeekday)] : null,
    peak_hour: enough ? maxOf(byHour) : null,
    avg_daily_completions: round(avgDaily, 1),
    open_today: openToday,
    overloaded_today: openToday > Math.max(6, Math.ceil(avgDaily * 2.5)),
  };
}

// ---------- Life balance ----------
export interface PillarBalance { pillar_id: string; name: string; events: number; score: number; neglected: boolean }
export function lifeBalance(
  tasks: TaskRow[], habits: HabitRow[], completions: CompletionRow[],
  areaPillars: AreaPillar[], pillars: PillarRow[], today: string, tz: string, windowDays = 14,
): { pillars: PillarBalance[]; total_events: number } {
  const from = addDays(today, -windowDays + 1);
  const pillarsByArea = new Map<string, string[]>();
  for (const ap of areaPillars) pillarsByArea.set(ap.life_area_id, [...(pillarsByArea.get(ap.life_area_id) ?? []), ap.pillar_id]);
  const score = new Map<string, number>(pillars.map((p) => [p.id, 0]));
  let total = 0;
  const credit = (areaId: string | null) => {
    const ps = areaId ? pillarsByArea.get(areaId) : undefined;
    if (!ps?.length) return;
    total++;
    for (const p of ps) score.set(p, (score.get(p) ?? 0) + 1 / ps.length); // an event is shared across its pillars
  };
  for (const t of tasks) if (t.completed_at && localDate(t.completed_at, tz) >= from) credit(t.life_area_id);
  const areaOfHabit = new Map(habits.map((h) => [h.id, h.life_area_id]));
  for (const c of completions) if (c.completed_on >= from && c.completed_on <= today) credit(areaOfHabit.get(c.habit_id) ?? null);

  const EXPECTED = 6; // ~6 completed actions per pillar per fortnight counts as "well attended"
  const out = pillars.map((p) => {
    const ev = score.get(p.id) ?? 0;
    const s = Math.min(100, Math.round((ev / EXPECTED) * 100));
    return { pillar_id: p.id, name: p.name, events: round(ev, 1), score: s, neglected: total >= 5 && s < 30 };
  });
  return { pillars: out, total_events: total };
}

// ---------- Momentum ----------
export function momentum(parts: { habitRate7: number | null; taskRate: number | null; goalsOnTrack: number | null }): number | null {
  const comps: [number | null, number][] = [[parts.habitRate7, 0.4], [parts.taskRate, 0.3], [parts.goalsOnTrack, 0.3]];
  const avail = comps.filter(([v]) => v !== null) as [number, number][];
  if (!avail.length) return null;
  const w = avail.reduce((a, [, x]) => a + x, 0);
  return Math.round((avail.reduce((a, [v, x]) => a + v * x, 0) / w) * 100);
}

// ---------- Insight cards ----------
export interface Insight {
  id: string; kind: 'prediction' | 'pattern' | 'warning' | 'win'; title: string; body: string; priority: number;
  /** Stable key + values so the app can show the same message in the user's language. title/body stay as an English fallback. */
  code: string; params: Record<string, string | number>;
  entity?: { type: 'habit' | 'goal' | 'task' | 'pillar'; id: string };
}
const pct = (n: number) => `${Math.round(n * 100)}%`;
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

export interface InsightInput {
  today: string; habits: HabitRow[]; habitStatsById: Record<string, HabitStats>;
  goals: GoalRow[]; projections: Record<string, GoalProjection>; behavior: TaskBehavior; balance: ReturnType<typeof lifeBalance>;
  transformation?: { areaCount: number; recentImprovement: number };
}
export function buildInsights(i: InsightInput): Insight[] {
  const out: Insight[] = [];
  if (i.transformation && i.transformation.recentImprovement > 0) out.push({ id: 'transformation-progress', kind: 'win', priority: 52,
    code: 'transformationProgress', params: { count: i.transformation.recentImprovement },
    title: 'Your reflection shows progress', body: `${i.transformation.recentImprovement} personal area${i.transformation.recentImprovement === 1 ? '' : 's'} improved since the previous check-in. Notice what helped.` });

  for (const h of i.habits) {
    const s = i.habitStatsById[h.id];
    if (!s) continue;
    if (s.lapse_risk !== null && s.lapse_risk >= 0.5) {
      const wd = WEEKDAY_NAMES[weekday(i.today)];
      out.push({ id: `lapse-${h.id}`, kind: 'prediction', priority: 90, code: 'lapse', params: { name: h.name, pct: Math.round((1 - s.lapse_risk) * 100), weekday: wd, streak: s.streak >= 3 ? s.streak : 0, unit: s.streak_unit }, entity: { type: 'habit', id: h.id },
        title: `"${h.name}" is at risk today`,
        body: `You've kept this habit on only ${pct(1 - s.lapse_risk)} of recent ${wd}s${s.streak >= 3 ? `, and a ${s.streak}-${s.streak_unit.slice(0, -1)} streak is on the line` : ''}. Do it early, or shrink it to a 2-minute version.` });
    }
    if (s.streak >= 7 && [7, 14, 21, 30, 50, 75, 100].includes(s.streak)) {
      out.push({ id: `streak-${h.id}`, kind: 'win', priority: 70, code: 'streak', params: { name: h.name, streak: s.streak, unit: s.streak_unit }, entity: { type: 'habit', id: h.id },
        title: `${s.streak}-${s.streak_unit.slice(0, -1)} streak: ${h.name}`, body: 'Consistency like this is what changes a life. Keep the chain going.' });
    }
    if (s.best_weekday && s.rate30 >= 0.4 && s.rate30 < 0.7) {
      out.push({ id: `bestday-${h.id}`, kind: 'pattern', priority: 40, code: 'bestday', params: { name: h.name, weekday: s.best_weekday, pct: Math.round(s.rate30 * 100) }, entity: { type: 'habit', id: h.id },
        title: `${s.best_weekday} is your strongest day for "${h.name}"`, body: `Your 30-day consistency is ${pct(s.rate30)}. Anchor it to what you do on ${s.best_weekday}s and repeat that cue on other days.` });
    }
  }

  for (const g of i.goals) {
    const p = i.projections[g.id];
    if (!p || g.status === 'completed') continue;
    if (p.status === 'behind' || p.status === 'at_risk') {
      const late = p.days_late !== null && p.days_late > 0 ? ` At this pace you'd finish around ${p.projected_completion}, ${p.days_late} days after your target.` : '';
      out.push({ id: `goal-${g.id}`, kind: p.status === 'behind' ? 'warning' : 'prediction', priority: p.status === 'behind' ? 85 : 65,
        code: p.status === 'behind' ? 'goalBehind' : 'goalSlipping', params: { title: g.title, progress: Math.round(p.progress * 100), elapsed: Math.round((p.elapsed_fraction ?? 0) * 100), date: p.projected_completion ?? '', late: p.days_late !== null && p.days_late > 0 ? p.days_late : 0 }, entity: { type: 'goal', id: g.id },
        title: `"${g.title}" is ${p.status === 'behind' ? 'behind' : 'slipping'}`,
        body: `${pct(p.progress)} done with ${pct(p.elapsed_fraction ?? 0)} of the time used.${late} Break the next step into something you can finish this week.` });
    } else if (p.status === 'on_track' && p.progress >= 0.5) {
      out.push({ id: `goalwin-${g.id}`, kind: 'win', priority: 50, code: 'goalOnTrack', params: { title: g.title, progress: Math.round(p.progress * 100) }, entity: { type: 'goal', id: g.id },
        title: `"${g.title}" is on track`, body: `${pct(p.progress)} complete and moving at the right pace.` });
    }
  }

  const b = i.behavior;
  if (b.overloaded_today) out.push({ id: 'overload', kind: 'warning', priority: 80, code: 'overload', params: { open: b.open_today, avg: b.avg_daily_completions },
    title: 'Your plate is too full today', body: `${b.open_today} tasks are open, well above what you usually finish (about ${b.avg_daily_completions} a day). Pick the top 3 and move the rest.` });
  if (b.overdue_open >= 3) out.push({ id: 'overdue', kind: 'warning', priority: 60, code: 'overdue', params: { n: b.overdue_open },
    title: `${b.overdue_open} overdue tasks`, body: 'Reschedule or delete them today so they stop weighing on you.' });
  if (b.best_weekday && b.peak_hour !== null) out.push({ id: 'peak', kind: 'pattern', priority: 45, code: 'peak', params: { weekday: b.best_weekday, hour: hourLabel(b.peak_hour) },
    title: 'Your productivity pattern', body: `You complete the most tasks on ${b.best_weekday}s, usually around ${hourLabel(b.peak_hour)}. Protect that time for your hardest work.` });
  if (b.avg_days_late !== null && b.avg_days_late >= 1.5) out.push({ id: 'late', kind: 'pattern', priority: 42, code: 'late', params: { days: b.avg_days_late },
    title: 'Deadlines are slipping', body: `Finished tasks land about ${b.avg_days_late} days after their due date. Try setting due dates later, or planning fewer tasks per day.` });
  if (b.completion_rate !== null && b.completion_rate >= 0.8) out.push({ id: 'taskwin', kind: 'win', priority: 48, code: 'taskWin', params: { pct: Math.round(b.completion_rate * 100), days: b.window_days, done: b.done_total, due: b.due_total },
    title: `${pct(b.completion_rate)} of tasks completed`, body: `Over the last ${b.window_days} days you finished ${b.done_total} of ${b.due_total} due tasks.` });

  for (const p of i.balance.pillars) if (p.neglected) out.push({ id: `balance-${p.pillar_id}`, kind: 'warning', priority: 55, code: 'neglected', params: { name: p.name }, entity: { type: 'pillar', id: p.pillar_id },
    title: `${p.name} is being neglected`, body: 'Very little of your recent activity supports this pillar. Add one small habit or task there this week.' });

  return out.sort((a, c) => c.priority - a.priority);
}

export { localDate };
