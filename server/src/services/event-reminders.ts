import { diffDays, localDate } from './dates';
import { inQuietHours, PrefRow } from './reminders';

export const EVENT_REMINDER_OFFSETS = [7, 2, 1] as const;
export type EventOffsetDays = (typeof EVENT_REMINDER_OFFSETS)[number];

export interface CalendarEventRow {
  id: string;
  user_id: string;
  title: string;
  starts_at: string;
  location?: string | null;
}

export interface DueEventReminder {
  event: CalendarEventRow;
  eventDate: string;
  offsetDays: EventOffsetDays;
}

const isOffset = (d: number): d is EventOffsetDays => d === 7 || d === 2 || d === 1;

/** Decide which calendar event reminders (7 days, 2 days, 1 day before) are due now in a user's time zone. */
export function pickDueEventReminders(o: {
  now: Date;
  tz: string;
  events: CalendarEventRow[];
  prefs: PrefRow;
  sentKeys: Set<string>;
  targetHour?: number;
}): DueEventReminder[] {
  if (!o.prefs.push_enabled) return [];

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: o.tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(o.now);
  const hour = Number(parts.find((p) => p.type === 'hour')!.value) % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')!.value);
  const nowMinutes = hour * 60 + minute;

  if (inQuietHours(nowMinutes, o.prefs.quiet_start, o.prefs.quiet_end)) return [];
  if (hour !== (o.targetHour ?? 9)) return [];

  const today = localDate(o.now.toISOString(), o.tz);
  const out: DueEventReminder[] = [];
  for (const event of o.events) {
    const eventDate = localDate(event.starts_at, o.tz);
    const daysUntil = diffDays(eventDate, today);
    if (!isOffset(daysUntil)) continue;
    if (o.sentKeys.has(`${event.id}:${daysUntil}`)) continue;
    out.push({ event, eventDate, offsetDays: daysUntil });
  }
  return out;
}

export function formatEventReminderMessage(
  title: string,
  offsetDays: EventOffsetDays,
  lang: string,
  location?: string | null,
): { title: string; body: string } {
  const fr = lang === 'fr';
  const loc = location?.trim() ? ` (${location.trim()})` : '';
  if (offsetDays === 7) {
    return fr
      ? { title: 'Dans 1 semaine', body: `Rappel : « ${title} » est prévu dans 7 jours${loc}.` }
      : { title: 'Upcoming in 1 week', body: `Reminder: “${title}” is in 7 days${loc}.` };
  }
  if (offsetDays === 2) {
    return fr
      ? { title: 'Dans 2 jours', body: `Rappel : « ${title} » a lieu dans 2 jours${loc}.` }
      : { title: 'Upcoming in 2 days', body: `Reminder: “${title}” is in 2 days${loc}.` };
  }
  return fr
    ? { title: 'Événement demain', body: `Rappel : « ${title} » est prévu demain${loc}.` }
    : { title: 'Event tomorrow', body: `Reminder: “${title}” is tomorrow${loc}.` };
}
