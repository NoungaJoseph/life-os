import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../utils/errors';
import { addDays, localDate } from './dates';
import {
  AreaPillar, buildInsights, CompletionRow, GoalProjection, GoalRow, goalProgress, habitDueOn, HabitRow, habitStats, HabitStats,
  lifeBalance, MilestoneRow, momentum, PillarRow, projectGoal, TaskRow, taskBehavior,
} from './insights';

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new AppError(500, 'DB_ERROR', error.message);
  return (data ?? []) as T;
}

export async function loadSnapshot(db: SupabaseClient, userId: string) {
  const profile = await must<any>(db.from('profiles').select('display_name,timezone,currency').eq('id', userId).maybeSingle());
  const tz: string = profile.timezone ?? 'UTC';
  const today = localDate(new Date().toISOString(), tz);
  const since = addDays(today, -60);
  const sinceIso = `${since}T00:00:00Z`;

  const [tasks, habits, completions, goals, pillars, areaPillars, transformationAreas, transformationCheckins] = await Promise.all([
    must<TaskRow[]>(db.from('tasks').select('id,title,priority,due_date,completed_at,created_at,life_area_id,goal_id')
      .eq('user_id', userId).or(`completed_at.is.null,completed_at.gte.${sinceIso}`).limit(2000)),
    must<HabitRow[]>(db.from('habits').select('id,name,frequency,days_of_week,target_per_period,start_date,paused_at,archived_at,life_area_id')
      .eq('user_id', userId).is('archived_at', null)),
    must<CompletionRow[]>(db.from('habit_completions').select('habit_id,completed_on')
      .eq('user_id', userId).gte('completed_on', addDays(today, -120)).limit(5000)),
    must<GoalRow[]>(db.from('goals').select('*').eq('user_id', userId).not('status', 'in', '(abandoned)')),
    must<PillarRow[]>(db.from('life_pillars').select('id,name').order('sort_order')),
    must<AreaPillar[]>(db.from('life_area_pillars').select('life_area_id,pillar_id')),
    must<Array<{ id: string }>>(db.from('transformation_areas').select('id').eq('user_id', userId).limit(100)),
    must<Array<{ area_id: string; current_score: number; week_start: string }>>(db.from('transformation_checkins').select('area_id,current_score,week_start').eq('user_id', userId).order('week_start', { ascending: false }).limit(200)),
  ]);
  const goalIds = goals.map((g) => g.id);
  const milestones = goalIds.length
    ? await must<MilestoneRow[]>(db.from('goal_milestones').select('goal_id,completed_at').eq('user_id', userId).in('goal_id', goalIds))
    : [];

  // Progress, with parent goals rolling up the average of their children when no value is recorded on them.
  const children = new Map<string, GoalRow[]>();
  for (const g of goals) if (g.parent_goal_id) children.set(g.parent_goal_id, [...(children.get(g.parent_goal_id) ?? []), g]);
  const memo = new Map<string, number>();
  const progressOf = (g: GoalRow, depth = 0): number => {
    if (memo.has(g.id)) return memo.get(g.id)!;
    const kids = children.get(g.id) ?? [];
    const own = goalProgress(g, milestones);
    const value = kids.length && own === 0 && g.status !== 'completed' && depth < 6
      ? kids.reduce((a, k) => a + progressOf(k, depth + 1), 0) / kids.length : own;
    memo.set(g.id, value);
    return value;
  };
  const projections: Record<string, GoalProjection> = {};
  const goalViews = goals.map((g) => {
    const progress = progressOf(g);
    projections[g.id] = projectGoal(g, progress, today);
    return { ...g, child_count: children.get(g.id)?.length ?? 0, progress, projection: projections[g.id] };
  });

  const statsById: Record<string, HabitStats> = {};
  for (const h of habits) statsById[h.id] = habitStats(h, completions, today);

  const behavior = taskBehavior(tasks, today, tz);
  const balance = lifeBalance(tasks, habits, completions, areaPillars, pillars, today, tz);

  // Momentum: last-7-day habit consistency, task completion rate, share of dated goals on track
  let due7 = 0, hit7 = 0;
  const doneSet = new Set(completions.map((c) => `${c.habit_id}|${c.completed_on}`));
  for (const h of habits) for (let i = 0; i < 7; i++) {
    const d = addDays(today, -i);
    if (i === 0 && !doneSet.has(`${h.id}|${d}`)) continue; // today is still open
    if (habitDueOn(h, d)) { due7++; if (doneSet.has(`${h.id}|${d}`)) hit7++; }
  }
  const dated = goalViews.filter((g) => g.status === 'active' && g.target_date);
  const onTrack = dated.length ? dated.filter((g) => ['on_track', 'completed'].includes(g.projection.status)).length / dated.length : null;
  const momentumScore = momentum({ habitRate7: due7 >= 3 ? hit7 / due7 : null, taskRate: behavior.completion_rate, goalsOnTrack: onTrack });

  const byArea = new Map<string, number[]>();
  for (const row of transformationCheckins) byArea.set(row.area_id, [...(byArea.get(row.area_id) ?? []), row.current_score]);
  const recentImprovement = [...byArea.values()].filter((scores) => scores.length > 1 && scores[0] > scores[1]).length;
  const transformation = { areaCount: transformationAreas.length, recentImprovement };
  const insights = buildInsights({ today, habits, habitStatsById: statsById, goals, projections, behavior, balance, transformation });
  return { profile, tz, today, tasks, habits, completions, goalViews, statsById, behavior, balance, momentum: momentumScore, insights, transformation };
}
export type Snapshot = Awaited<ReturnType<typeof loadSnapshot>>;
