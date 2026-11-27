import { CalendarEvent } from './types';

export const EVENT_REMINDER_OFFSETS = [7, 2, 1] as const;
export type EventReminderOffset = (typeof EVENT_REMINDER_OFFSETS)[number];

export interface ScheduledEventReminder {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  location: string | null;
  offsetDays: EventReminderOffset;
  fireAt: Date;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Local YYYY-MM-DD calendar date of an ISO timestamp. */
export function eventLocalDate(startsAt: string): string {
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return startsAt.slice(0, 10);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Local HH:MM display string of an ISO timestamp. */
export function eventLocalTime(startsAt: string): string {
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return '09:00';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Whole calendar days from todayYmd to eventYmd (> 0 future, 0 today, < 0 past). */
export function eventCountdownDays(eventYmd: string, todayYmd: string): number {
  const [ey, em, ed] = eventYmd.split('-').map(Number);
  const [ty, tm, td] = todayYmd.split('-').map(Number);
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
}

/** Build upcoming local notifications at 09:00 AM for 1 week, 2 days, and 1 day before each event. */
export function buildEventReminderSchedule(
  events: Pick<CalendarEvent, 'id' | 'title' | 'starts_at' | 'location'>[],
  now = new Date(),
  maxCount = 45,
): ScheduledEventReminder[] {
  const out: ScheduledEventReminder[] = [];
  const nowMs = now.getTime();
  for (const ev of events) {
    const eventDate = eventLocalDate(ev.starts_at);
    const [y, m, d] = eventDate.split('-').map(Number);
    if (!y || !m || !d) continue;
    for (const offsetDays of EVENT_REMINDER_OFFSETS) {
      const fireAt = new Date(y, m - 1, d - offsetDays, 9, 0, 0, 0);
      if (fireAt.getTime() <= nowMs) continue;
      out.push({
        eventId: ev.id,
        eventTitle: ev.title,
        eventDate,
        location: ev.location ?? null,
        offsetDays,
        fireAt,
      });
    }
  }
  out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
  return out.slice(0, maxCount);
}
