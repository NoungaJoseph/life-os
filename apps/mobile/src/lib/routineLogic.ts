import { localDateKey } from './eveningCheckinLogic';
import { parseTime } from './timeInput';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

export const DEFAULT_ROUTINE_TIMES = {
  morning: '07:00',
  breakfast: '08:30',
  lunch: '13:00',
  dinner: '19:30',
} as const;

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

function minutesOfDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

function toMinutes(hhmm: string, fallbackMinutes: number): number {
  const parsed = parseTime(hhmm);
  return parsed ? parsed.hour * 60 + parsed.minute : fallbackMinutes;
}

export function isMorningWindow(now: Date, morningHHMM: string = DEFAULT_ROUTINE_TIMES.morning, cutoffHHMM = '11:30'): boolean {
  const start = toMinutes(morningHHMM, 7 * 60);
  const end = toMinutes(cutoffHHMM, 11 * 60 + 30);
  const m = minutesOfDay(now);
  return m >= start && m < end;
}

export function activeMealSlot(
  now: Date,
  times: { breakfast: string; lunch: string; dinner: string },
  windowMinutes = 120,
): MealSlot | null {
  const m = minutesOfDay(now);
  const ordered: [MealSlot, number][] = [
    ['dinner', toMinutes(times.dinner, 19 * 60 + 30)],
    ['lunch', toMinutes(times.lunch, 13 * 60)],
    ['breakfast', toMinutes(times.breakfast, 8 * 60 + 30)],
  ];
  for (const [slot, start] of ordered) {
    if (m >= start && m < start + windowMinutes) return slot;
  }
  return null;
}

export function shouldPromptMorningPlan(opts: {
  now?: Date;
  morningTime?: string;
  doneDate: string | null;
  dismissedDate: string | null;
  snoozeUntil: number | null;
  enabled: boolean;
}): boolean {
  const now = opts.now ?? new Date();
  if (!opts.enabled) return false;
  if (!isMorningWindow(now, opts.morningTime ?? DEFAULT_ROUTINE_TIMES.morning)) return false;
  const today = localDateKey(now);
  if (opts.doneDate === today || opts.dismissedDate === today) return false;
  if (opts.snoozeUntil && now.getTime() < opts.snoozeUntil) return false;
  return true;
}

export function shouldPromptMealFollowUp(opts: {
  now?: Date;
  mealTimes: { breakfast: string; lunch: string; dinner: string };
  loggedMealsToday: string[];
  dismissedSlotsToday: string[];
  snoozeUntil: number | null;
  enabled: boolean;
}): MealSlot | null {
  const now = opts.now ?? new Date();
  if (!opts.enabled) return null;
  if (opts.snoozeUntil && now.getTime() < opts.snoozeUntil) return null;
  const slot = activeMealSlot(now, opts.mealTimes);
  if (!slot) return null;
  if (opts.loggedMealsToday.includes(slot)) return null;
  if (opts.dismissedSlotsToday.includes(slot)) return null;
  return slot;
}

export function isEndOfMonthReportReady(now = new Date()): boolean {
  const day = now.getDate();
  if (day === 1) return true;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return day === lastDay && now.getHours() >= 18;
}

export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
