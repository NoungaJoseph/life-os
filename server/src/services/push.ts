import { adminClient } from '../config/supabase';
import { logger } from '../utils/logger';
import { pickDue, PrefRow, ReminderRow, todayFor } from './reminders';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';
const DEFAULT_PREFS: PrefRow = { quiet_start: '21:30', quiet_end: '07:00', max_per_day: 6, push_enabled: true };

/** One scheduler tick: find reminders due now and send them through Expo's push service. Uses the service role because no user is signed in. */
export async function dispatchDueReminders(now = new Date()): Promise<number> {
  const { data: reminders, error } = await adminClient.from('reminders').select('id,user_id,title,kind,remind_time,days_of_week,is_enabled').eq('is_enabled', true);
  if (error || !reminders?.length) { if (error) logger.error({ code: error.code }, 'reminder query failed'); return 0; }
  const byUser = new Map<string, ReminderRow[]>();
  for (const r of reminders as ReminderRow[]) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
  const ids = [...byUser.keys()];
  const [profiles, prefs, tokens] = await Promise.all([
    adminClient.from('profiles').select('id,timezone').in('id', ids),
    adminClient.from('notification_preferences').select('*').in('user_id', ids),
    adminClient.from('push_tokens').select('user_id,token').in('user_id', ids),
  ]);
  let sent = 0;
  for (const uid of ids) {
    const tz = profiles.data?.find((p: any) => p.id === uid)?.timezone ?? 'UTC';
    const toks = (tokens.data ?? []).filter((t: any) => t.user_id === uid).map((t: any) => t.token);
    if (!toks.length) continue;
    const day = todayFor(now, tz);
    const { data: done } = await adminClient.from('reminder_deliveries').select('reminder_id').eq('user_id', uid).eq('sent_on', day);
    const due = pickDue({ now, tz, reminders: byUser.get(uid)!, prefs: (prefs.data?.find((p: any) => p.user_id === uid) as PrefRow) ?? DEFAULT_PREFS,
      sentTodayIds: new Set((done ?? []).map((d: any) => d.reminder_id)), sentTodayCount: done?.length ?? 0 });
    for (const r of due) {
      // Claim the slot first: the unique (reminder_id, sent_on) key stops two server instances sending the same reminder.
      const claim = await adminClient.from('reminder_deliveries').insert({ user_id: uid, reminder_id: r.id, sent_on: day });
      if (claim.error) continue;
      try {
        const res = await fetch(EXPO_PUSH, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(toks.map((to: string) => ({ to, title: 'MY LIFE OS', body: r.title, sound: 'default', data: { kind: r.kind } }))) });
        if (!res.ok) logger.warn({ status: res.status }, 'push send failed'); else sent++;
      } catch { logger.warn('push network error'); }
    }
  }
  return sent;
}

export function startScheduler() {
  const t = setInterval(() => { dispatchDueReminders().catch(() => logger.error('scheduler tick failed')); }, 60_000);
  t.unref();
}
