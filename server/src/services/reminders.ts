import { localDate } from './dates';

export interface ReminderRow { id: string; user_id: string; title: string; kind: string; remind_time: string; days_of_week: number[] | null; is_enabled: boolean }
export interface PrefRow { quiet_start: string; quiet_end: string; max_per_day: number; push_enabled: boolean }

const mins = (hhmm: string) => { const [h, m] = hhmm.slice(0, 5).split(':').map(Number); return h * 60 + m; };

/** True when `m` (minutes since midnight) falls inside the quiet window, which may wrap past midnight. */
export function inQuietHours(m: number, start: string, end: string) {
  const s = mins(start), e = mins(end);
  return s === e ? false : s < e ? m >= s && m < e : m >= s || m < e;
}

/** Decide which reminders to send right now for one user. Pure so it can be unit-tested. */
export function pickDue(o: { now: Date; tz: string; reminders: ReminderRow[]; prefs: PrefRow; sentTodayIds: Set<string>; sentTodayCount: number; windowMin?: number }) {
  if (!o.prefs.push_enabled) return [];
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: o.tz, hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' }).formatToParts(o.now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const nowM = (Number(get('hour')) % 24) * 60 + Number(get('minute'));
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  if (inQuietHours(nowM, o.prefs.quiet_start, o.prefs.quiet_end)) return [];
  const win = o.windowMin ?? 5;
  const out: ReminderRow[] = [];
  let budget = o.prefs.max_per_day - o.sentTodayCount;
  for (const r of o.reminders) {
    if (budget <= 0) break;
    if (!r.is_enabled || o.sentTodayIds.has(r.id)) continue;
    if (r.days_of_week?.length && !r.days_of_week.includes(dow)) continue;
    const diff = nowM - mins(r.remind_time);
    if (diff >= 0 && diff < win) { out.push(r); budget--; }
  }
  return out;
}

export const todayFor = (now: Date, tz: string) => localDate(now.toISOString(), tz);
