import { adminClient } from '../config/supabase';
import { logger } from '../utils/logger';
import { CalendarEventRow, formatEventReminderMessage, pickDueEventReminders } from './event-reminders';
import { pickDue, PrefRow, ReminderRow, todayFor } from './reminders';
import { contributionDates } from './group-savings';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';
const DEFAULT_PREFS: PrefRow = { quiet_start: '23:00', quiet_end: '07:00', max_per_day: 6, push_enabled: true };

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

/** Sends one bilingual reminder on the day before a group contribution is due and releases matured shares. */
export async function dispatchGroupSavings(now = new Date()): Promise<number> {
  await adminClient.rpc('release_due_group_savings', {});
  const tomorrow = new Date(now); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1); const dueOn = tomorrow.toISOString().slice(0, 10);
  const groups = await adminClient.from('savings_groups').select('*').eq('status','active').lte('start_date',dueOn).gte('end_date',dueOn);
  const dueGroups=(groups.data??[]).filter((g:any)=>contributionDates(g.start_date,g.end_date,g.frequency).includes(dueOn)); if(!dueGroups.length)return 0;
  const members=await adminClient.from('savings_group_members').select('*').in('group_id',dueGroups.map((g:any)=>g.id)).is('left_at',null);let sent=0;
  for(const member of members.data??[]){
    const paid=await adminClient.from('savings_group_contributions').select('id').eq('member_id',member.id).eq('due_on',dueOn).maybeSingle();if(paid.data)continue;
    const claim=await adminClient.from('savings_group_reminder_deliveries').insert({member_id:member.id,due_on:dueOn});if(claim.error)continue;
    const [profile,tokens]=await Promise.all([adminClient.from('profiles').select('language').eq('id',member.user_id).maybeSingle(),adminClient.from('push_tokens').select('token').eq('user_id',member.user_id)]);const group=dueGroups.find((g:any)=>g.id===member.group_id);const french=profile.data?.language==='fr';
    const payload=(tokens.data??[]).map((token:any)=>({to:token.token,title:'MY LIFE OS',body:french?`Votre épargne « ${group.name} » est prévue demain.`:`Your “${group.name}” savings contribution is due tomorrow.`,sound:'default',data:{kind:'group_savings',groupId:group.id}}));if(!payload.length)continue;
    try{const response=await fetch(EXPO_PUSH,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload)});if(response.ok)sent++;}catch{logger.warn('group savings push network error');}
  }return sent;
}

export async function dispatchCalendarEventReminders(now = new Date()): Promise<number> {
  const windowEnd = new Date(now.getTime() + 9 * 86_400_000).toISOString();
  const { data: events, error } = await adminClient
    .from('calendar_events')
    .select('id,user_id,title,starts_at,location')
    .gte('starts_at', now.toISOString())
    .lte('starts_at', windowEnd);
  if (error || !events?.length) {
    if (error && error.code !== 'PGRST205' && error.code !== '42P01') {
      logger.error({ code: error.code }, 'calendar event reminder query failed');
    }
    return 0;
  }

  const eventIds = events.map((e: any) => e.id);
  const { data: deliveries, error: delErr } = await adminClient
    .from('calendar_event_reminder_deliveries')
    .select('event_id,offset_days')
    .in('event_id', eventIds);
  if (delErr) {
    if (delErr.code === 'PGRST205' || delErr.code === '42P01') return 0;
    logger.error({ code: delErr.code }, 'calendar event deliveries query failed');
    return 0;
  }

  const sentKeys = new Set((deliveries ?? []).map((d: any) => `${d.event_id}:${d.offset_days}`));
  const byUser = new Map<string, CalendarEventRow[]>();
  for (const ev of events as CalendarEventRow[]) {
    byUser.set(ev.user_id, [...(byUser.get(ev.user_id) ?? []), ev]);
  }
  const userIds = [...byUser.keys()];
  const [profiles, prefs, tokens] = await Promise.all([
    adminClient.from('profiles').select('id,timezone,language').in('id', userIds),
    adminClient.from('notification_preferences').select('*').in('user_id', userIds),
    adminClient.from('push_tokens').select('user_id,token').in('user_id', userIds),
  ]);

  let sent = 0;
  for (const uid of userIds) {
    const profile = profiles.data?.find((p: any) => p.id === uid);
    const tz = profile?.timezone ?? 'UTC';
    const lang = profile?.language ?? 'en';
    const toks = (tokens.data ?? []).filter((t: any) => t.user_id === uid).map((t: any) => t.token);
    if (!toks.length) continue;

    const due = pickDueEventReminders({
      now,
      tz,
      events: byUser.get(uid)!,
      prefs: (prefs.data?.find((p: any) => p.user_id === uid) as PrefRow) ?? DEFAULT_PREFS,
      sentKeys,
    });
    for (const item of due) {
      const claim = await adminClient
        .from('calendar_event_reminder_deliveries')
        .insert({ event_id: item.event.id, user_id: uid, offset_days: item.offsetDays, sent_on: todayFor(now, tz) });
      if (claim.error) continue;
      const msg = formatEventReminderMessage(item.event.title, item.offsetDays, lang, item.event.location);
      try {
        const res = await fetch(EXPO_PUSH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(
            toks.map((to: string) => ({
              to,
              title: msg.title,
              body: msg.body,
              sound: 'default',
              data: { kind: 'calendar_event', route: '/(tabs)/planner', date: item.eventDate, eventId: item.event.id },
            })),
          ),
        });
        if (res.ok) sent++;
      } catch {
        logger.warn('calendar event push network error');
      }
    }
  }
  return sent;
}

export function startScheduler() {
  const t = setInterval(() => {
    Promise.all([dispatchDueReminders(), dispatchGroupSavings(), dispatchCalendarEventReminders()]).catch(() =>
      logger.error('scheduler tick failed'),
    );
  }, 60_000);
  t.unref();
}
