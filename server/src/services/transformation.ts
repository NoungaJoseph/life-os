export type TransformationEvent = { kind: 'urge' | 'relapse' | 'success'; occurred_at: string };

/** Calendar-day streak. A relapse starts a new run; urges do not reset it. */
export function quitStreak(startedOn: string, events: TransformationEvent[], today: string) {
  const relapses = events.filter((event) => event.kind === 'relapse').map((event) => event.occurred_at.slice(0, 10)).filter((date) => date >= startedOn && date <= today).sort();
  const days = (a: string, b: string) => Math.max(0, Math.floor((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000));
  let best = 0;
  let anchor = startedOn;
  for (const date of relapses) { best = Math.max(best, days(anchor, date)); anchor = date; }
  const current = days(anchor, today);
  return { current, best: Math.max(best, current), relapses: relapses.length };
}

export function weekStart(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
