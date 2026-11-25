export type TransformationEvent = { kind: 'urge' | 'relapse' | 'success'; occurred_at: string };

export const QUIT_MILESTONES = [3, 7, 14, 30, 60, 90, 180, 365] as const;

export interface QuitProgress {
  current: number;
  best: number;
  relapses: number;
  urges: number;
  clean_checkins: number;
  target_days: number | null;
  progress_pct: number;
  days_remaining: number | null;
  latest_milestone: number | null;
  next_milestone: number | null;
  goal_achieved: boolean;
  today_status: TransformationEvent['kind'] | null;
}

/** Calendar-day streak. A relapse starts a new run; urges do not reset it. */
export function quitStreak(startedOn: string, events: TransformationEvent[], today: string) {
  const relapses = events
    .filter((event) => event.kind === 'relapse')
    .map((event) => event.occurred_at.slice(0, 10))
    .filter((date) => date >= startedOn && date <= today)
    .sort();
  const days = (a: string, b: string) =>
    Math.max(0, Math.floor((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000));
  let best = 0;
  let anchor = startedOn;
  for (const date of relapses) {
    best = Math.max(best, days(anchor, date));
    anchor = date;
  }
  const current = days(anchor, today);
  return { current, best: Math.max(best, current), relapses: relapses.length };
}

/** Rich progress metrics combining clean calendar streak, daily check-ins, milestones, and target goal. */
export function quitProgress(
  startedOn: string,
  events: TransformationEvent[],
  today: string,
  targetDays?: number | null,
): QuitProgress {
  const streak = quitStreak(startedOn, events, today);
  const todayEvents = events
    .filter((e) => e.occurred_at.slice(0, 10) === today)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  const todayStatus = todayEvents.length ? todayEvents[todayEvents.length - 1].kind : null;

  // A clean check-in on Day 1 (when startedOn === today or same day as last relapse) counts as Day 1 clean.
  const current = streak.current === 0 && todayStatus === 'success' ? 1 : streak.current;
  const best = Math.max(streak.best, current);
  const urges = events.filter((e) => e.kind === 'urge').length;
  const cleanCheckins = events.filter((e) => e.kind === 'success').length;
  const target = targetDays && targetDays > 0 ? targetDays : null;

  let latestMilestone: number | null = null;
  let nextMilestone: number | null = null;
  for (const m of QUIT_MILESTONES) {
    if (current >= m) latestMilestone = m;
    else if (nextMilestone === null) nextMilestone = m;
  }

  return {
    current,
    best,
    relapses: streak.relapses,
    urges,
    clean_checkins: cleanCheckins,
    target_days: target,
    progress_pct: target ? Math.min(100, Math.round((current / target) * 100)) : 0,
    days_remaining: target ? Math.max(0, target - current) : null,
    latest_milestone: latestMilestone,
    next_milestone: nextMilestone,
    goal_achieved: Boolean(target && current >= target),
    today_status: todayStatus,
  };
}

export function weekStart(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
