import { parseTime } from './timeInput';

export const DEFAULT_CHECKIN_TIME = '22:00';
export const BEDTIME_TIME = '23:00';

export function localDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function minutesOfDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function isInEveningWindow(now: Date, startHHMM = DEFAULT_CHECKIN_TIME): boolean {
  const parsed = parseTime(startHHMM) ?? { hour: 22, minute: 0 };
  const startMinutes = parsed.hour * 60 + parsed.minute;
  return minutesOfDay(now) >= startMinutes;
}

export function minutesUntilBedtime(now: Date, bedtimeHHMM = BEDTIME_TIME): number {
  const parsed = parseTime(bedtimeHHMM) ?? { hour: 23, minute: 0 };
  const bedtimeMinutes = parsed.hour * 60 + parsed.minute;
  return Math.max(0, bedtimeMinutes - minutesOfDay(now));
}

export function shouldPromptEveningCheckin(opts: {
  now?: Date;
  startHHMM?: string;
  doneDate: string | null;
  snoozeUntil: number | null;
  enabled: boolean;
}): boolean {
  const now = opts.now ?? new Date();
  if (!opts.enabled) return false;
  if (!isInEveningWindow(now, opts.startHHMM)) return false;
  if (opts.doneDate === localDateKey(now)) return false;
  if (opts.snoozeUntil && now.getTime() < opts.snoozeUntil) return false;
  return true;
}
