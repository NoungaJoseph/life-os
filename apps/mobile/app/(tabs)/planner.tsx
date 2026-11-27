import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { Card, Check, EmptyState, ErrorState, FadeIn, Header, Loading, Pill, Press, Screen, SectionHeader, Text, tap } from '../../src/components/ui';
import { FirstVisitTip } from '../../src/components/Tutorial';
import { currentLocale } from '../../src/i18n';
import { api } from '../../src/lib/api';
import { addDays, dayNum, prettyDate, shortDate, shortDays, weekStart } from '../../src/lib/dates';
import { errorMessage } from '../../src/lib/errors';
import { makeEventReminderCopy, syncCalendarEventNotifications } from '../../src/lib/eventNotifications';
import { eventCountdownDays, eventLocalDate, eventLocalTime } from '../../src/lib/eventRemindersLogic';
import { useDashboard, useRefreshAll, useToggleHabit, useToggleTask } from '../../src/lib/hooks';
import { CalendarEvent, Task } from '../../src/lib/types';
import { useTheme } from '../../src/theme/useTheme';

const isoUtc = (d: Date) => d.toISOString().slice(0, 10);

function JumpDateModal({
  visible,
  value,
  today,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: string;
  today: string;
  onSelect: (d: string) => void;
  onClose: () => void;
}) {
  const th = useTheme();
  const { t: tr } = useTranslation();
  const [month, setMonth] = useState(() => {
    const [y, m] = value.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 1));
  });
  const firstDay = (month.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, i) => i - firstDay + 1);
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(currentLocale(), { weekday: 'narrow', timeZone: 'UTC' }),
  );
  const shiftMonth = (delta: number) =>
    setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + delta, 1)));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="absolute inset-0" onPress={onClose} accessibilityLabel={tr('common.close')} />
        <ScrollView
          className="rounded-t-2xl bg-bg"
          contentContainerClassName="px-5 pb-10 pt-5"
          style={{ maxWidth: 520, maxHeight: '90%', width: '100%', alignSelf: 'center' }}
        >
          <View className="mb-5 flex-row items-center justify-between">
            <Text size="lg" serif>{tr('planner.pickDate')}</Text>
            <Pressable onPress={onClose} accessibilityLabel={tr('common.close')} hitSlop={12}>
              <Ionicons name="close" size={24} color={th.text} />
            </Pressable>
          </View>
          <View className="mb-4 flex-row items-center justify-between">
            <Pressable onPress={() => shiftMonth(-1)} accessibilityLabel={tr('datePicker.previousMonth')} className="p-2">
              <Ionicons name="chevron-back" size={23} color={th.primary} />
            </Pressable>
            <Text weight="600">
              {month.toLocaleDateString(currentLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </Text>
            <Pressable onPress={() => shiftMonth(1)} accessibilityLabel={tr('datePicker.nextMonth')} className="p-2">
              <Ionicons name="chevron-forward" size={23} color={th.primary} />
            </Pressable>
          </View>
          <View className="flex-row">
            {weekdays.map((day, i) => (
              <View key={i} className="flex-1 items-center py-2"><Text size="xs" muted>{day}</Text></View>
            ))}
          </View>
          <View className="flex-row flex-wrap">
            {cells.map((day, i) => {
              const inMonth = day >= 1 && day <= daysInMonth;
              const dStr = inMonth ? isoUtc(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day))) : '';
              const active = dStr === value;
              return (
                <View key={i} style={{ width: '14.2857%' }} className="items-center py-1">
                  {inMonth ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={dStr}
                      accessibilityState={{ selected: active }}
                      onPress={() => { onSelect(dStr); onClose(); }}
                      className="h-11 w-11 items-center justify-center rounded-full"
                      style={active ? { backgroundColor: th.primary } : undefined}
                    >
                      <Text weight={active ? '700' : '400'} color={active ? th.primaryDark : th.text}>{day}</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
          <View className="mt-3 flex-row justify-end">
            <Pressable onPress={() => { onSelect(today); onClose(); }} className="py-3">
              <Text weight="600" color={th.primary}>{tr('datePicker.today')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function Planner() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const router = useRouter();
  const { date: paramDate } = useLocalSearchParams<{ date?: string }>();
  const dash = useDashboard();
  const refresh = useRefreshAll();
  const toggleTask = useToggleTask();
  const toggleHabit = useToggleHabit();
  const today = dash.data?.date;
  const validParamDate = paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate) ? paramDate : null;
  const [pickState, setPickState] = useState<{ forParam: string | null; value: string | null }>({ forParam: null, value: null });
  const picked = pickState.forParam === validParamDate ? pickState.value : null;
  const setPicked = (value: string | null) => setPickState({ forParam: validParamDate, value });
  const [calendarOpen, setCalendarOpen] = useState(false);

  const date = picked ?? validParamDate ?? today;

  const tasks = useQuery({
    queryKey: ['tasks', date],
    queryFn: () => api<Task[]>(`/tasks?from=${date}&to=${date}&pageSize=100`),
    enabled: !!date,
  });
  const eventsQ = useQuery({
    queryKey: ['calendar-events', 'upcoming'],
    queryFn: () => api<CalendarEvent[]>(`/calendar-events?from=${addDays(today!, -7)}&pageSize=100`),
    enabled: !!today,
  });

  const del = useMutation({
    mutationFn: (id: string) => api(`/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => { void refresh(); },
  });
  const delEvent = useMutation({
    mutationFn: (id: string) => api(`/calendar-events/${id}`, { method: 'DELETE' }),
    onSuccess: (_res, deletedId) => {
      const nextList = (eventsQ.data ?? []).filter((e) => e.id !== deletedId);
      void syncCalendarEventNotifications(nextList, makeEventReminderCopy(tr));
      void refresh();
    },
  });

  if (dash.isLoading) return <Loading />;
  if (dash.error || !date || !today) return <Screen><ErrorState message={dash.error ? errorMessage(dash.error, tr) : tr('planner.loadError')} onRetry={() => void dash.refetch()} /></Screen>;

  const start = weekStart(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const isToday = date === today;
  const overdue = isToday ? (dash.data?.priorities ?? []).filter((x) => x.overdue) : [];

  const allEvents = eventsQ.data ?? [];
  const eventDates = new Set(allEvents.map((ev) => eventLocalDate(ev.starts_at)));
  const dayEvents = allEvents.filter((ev) => eventLocalDate(ev.starts_at) === date);
  const upcomingEvents = allEvents.filter((ev) => eventLocalDate(ev.starts_at) >= today && eventLocalDate(ev.starts_at) !== date);

  const confirmDelete = (task: Task) => {
    if (Platform.OS === 'web') { if (window.confirm(tr('planner.deleteConfirm', { title: task.title }))) del.mutate(task.id); return; }
    Alert.alert(tr('planner.deleteTitle'), tr('planner.deleteConfirm', { title: task.title }), [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('common.delete'), style: 'destructive', onPress: () => del.mutate(task.id) }]);
  };

  const confirmDeleteEvent = (ev: CalendarEvent) => {
    if (Platform.OS === 'web') { if (window.confirm(tr('planner.deleteEventConfirm', { title: ev.title }))) delEvent.mutate(ev.id); return; }
    Alert.alert(tr('planner.deleteEventTitle'), tr('planner.deleteEventConfirm', { title: ev.title }), [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('common.delete'), style: 'destructive', onPress: () => delEvent.mutate(ev.id) }]);
  };

  const countdownLabel = (evDate: string) => {
    const diff = eventCountdownDays(evDate, today);
    if (diff === 0) return tr('planner.eventToday');
    if (diff === 1) return tr('planner.eventTomorrow');
    if (diff > 1) return tr('planner.eventInDays', { count: diff });
    return tr('planner.eventPast');
  };

  const TaskLine = ({ task }: { task: Task }) => (
    <View className="flex-row items-center gap-[16px] py-[4px]">
      <Check checked={!!task.completed_at} label={task.title} onPress={() => toggleTask.mutate({ id: task.id, completed: !task.completed_at })} />
      <View className="flex-1">
        <Text numberOfLines={2} muted={!!task.completed_at} style={{ textDecorationLine: task.completed_at ? 'line-through' : 'none' }}>{task.title}</Text>
        {task.overdue ? <Text size="xs" color={t.error}>{tr('home.overdue', { date: task.due_date })}</Text> : null}
      </View>
      {task.priority === 'high' && !task.completed_at ? <Pill label={tr('domain.priority.high')} tone="error" /> : null}
      <Pressable hitSlop={10} accessibilityRole="button" accessibilityLabel={tr('planner.deleteLabel', { title: task.title })} onPress={() => { tap(); confirmDelete(task); }}>
        <Ionicons name="trash-outline" size={18} color={t.textSecondary} />
      </Pressable>
    </View>
  );

  const EventLine = ({ ev, showDate }: { ev: CalendarEvent; showDate?: boolean }) => {
    const evDate = eventLocalDate(ev.starts_at);
    const diff = eventCountdownDays(evDate, today);
    return (
      <View className="flex-row items-start gap-3 py-1.5">
        <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-md border border-line bg-surface-alt">
          <Ionicons name="calendar" size={18} color={t.gold} />
        </View>
        <View className="flex-1 gap-1">
          <Text numberOfLines={2} weight="600">{ev.title}</Text>
          <Text size="xs" muted>
            {showDate ? `${shortDate(evDate)} · ` : ''}
            {eventLocalTime(ev.starts_at)}
            {ev.location ? ` · ${ev.location}` : ''}
          </Text>
          <View className="mt-0.5 flex-row flex-wrap gap-1.5">
            <Pill label={countdownLabel(evDate)} tone={diff >= 0 && diff <= 2 ? 'accent' : 'neutral'} />
            {diff > 0 ? <Pill label={tr('planner.reminderBadges')} tone="info" /> : null}
          </View>
        </View>
        <Pressable
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={tr('planner.deleteLabel', { title: ev.title })}
          onPress={() => { tap(); confirmDeleteEvent(ev); }}
        >
          <Ionicons name="trash-outline" size={18} color={t.textSecondary} />
        </Pressable>
      </View>
    );
  };

  return (
    <Screen onRefresh={() => void refresh()} refreshing={tasks.isRefetching || eventsQ.isRefetching} bottomPad={130}>
      <FirstVisitTip screen="planner" />
      <Header eyebrow="MY LIFE OS / PLAN" title={tr('planner.title')} subtitle={prettyDate(date)} />

      <View className="flex-row gap-2">
        <Press onPress={() => router.push('/goals')} className="min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-md bg-surface-alt px-2">
          <Ionicons name="flag-outline" size={17} color={t.text} />
          <Text size="sm" weight="600">{tr('tabs.goals')}</Text>
        </Press>
        <Press onPress={() => router.push('/areas')} className="min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-md bg-surface-alt px-2">
          <Ionicons name="grid-outline" size={17} color={t.text} />
          <Text size="sm" weight="600">{tr('tabs.areas')}</Text>
        </Press>
        <Press onPress={() => router.push({ pathname: '/new-event', params: { date } })} className="min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-md border border-line bg-surface px-2">
          <Ionicons name="notifications-outline" size={17} color={t.gold} />
          <Text size="sm" weight="600">{tr('planner.addEvent')}</Text>
        </Press>
      </View>

      <View className="flex-row items-center gap-[4px]">
        <Pressable hitSlop={10} accessibilityLabel={tr('planner.prevWeek')} onPress={() => { tap(); setPicked(addDays(date, -7)); }}><Ionicons name="chevron-back" size={22} color={t.primary} /></Pressable>
        <View className="flex-1 flex-row justify-between">
          {days.map((d, i) => {
            const sel = d === date;
            const hasEv = eventDates.has(d);
            return (
              <Pressable key={d} accessibilityRole="button" accessibilityState={{ selected: sel }} accessibilityLabel={prettyDate(d)} onPress={() => { tap(); setPicked(d); }}
                style={{ alignItems: 'center', gap: 4, paddingVertical: 8, width: 40, borderRadius: 14, backgroundColor: sel ? t.primaryDark : 'transparent' }}>
                <Text size="xs" color={sel ? '#9FB3C8' : t.textSecondary} weight="500">{shortDays()[i]}</Text>
                <Text weight="600" color={sel ? '#FFFFFF' : t.text}>{dayNum(d)}</Text>
                <View className="flex-row gap-1">
                  <View className={`h-[5px] w-[5px] rounded-full ${d === today ? 'bg-primary' : 'bg-transparent'}`} />
                  {hasEv ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.gold }} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <Pressable hitSlop={10} accessibilityLabel={tr('planner.nextWeek')} onPress={() => { tap(); setPicked(addDays(date, 7)); }}><Ionicons name="chevron-forward" size={22} color={t.primary} /></Pressable>
      </View>

      <View className="flex-row items-center justify-between">
        {!isToday ? (
          <Pressable onPress={() => setPicked(null)}><Text size="sm" color={t.primary} weight="600">{tr('planner.jumpToday')}</Text></Pressable>
        ) : <View />}
        <Pressable onPress={() => { tap(); setCalendarOpen(true); }} className="flex-row items-center gap-1.5 py-1">
          <Ionicons name="calendar-outline" size={16} color={t.primary} />
          <Text size="sm" color={t.primary} weight="600">{tr('planner.pickDate')}</Text>
        </Pressable>
      </View>

      {overdue.length > 0 && (
        <FadeIn>
          <SectionHeader title={tr('planner.overdue')} />
          <Card>{overdue.map((task) => <TaskLine key={task.id} task={task} />)}</Card>
        </FadeIn>
      )}

      <SectionHeader title={isToday ? tr('planner.today') : tr('planner.tasks')} action={tr('planner.addTask')} onAction={() => router.push({ pathname: '/new-task', params: { date } })} />
      <Card>
        {tasks.isLoading ? <Loading /> : tasks.error ? <ErrorState message={(tasks.error as Error).message} onRetry={() => void tasks.refetch()} />
          : (tasks.data ?? []).length === 0 ? <EmptyState icon="calendar-clear-outline" title={tr('planner.emptyTitle')} body={tr('planner.emptyBody')} action={tr('planner.addATask')} onAction={() => router.push({ pathname: '/new-task', params: { date } })} />
          : (tasks.data ?? []).map((task) => <TaskLine key={task.id} task={task} />)}
      </Card>

      <SectionHeader title={tr('planner.events')} action={tr('planner.addEvent')} onAction={() => router.push({ pathname: '/new-event', params: { date } })} />
      <Card className="gap-2">
        {dayEvents.length === 0 && upcomingEvents.length === 0 ? (
          <EmptyState
            icon="notifications-outline"
            title={tr('planner.noEventsTitle')}
            body={tr('planner.noEventsBody')}
            action={tr('planner.addEvent')}
            onAction={() => router.push({ pathname: '/new-event', params: { date } })}
          />
        ) : (
          <>
            {dayEvents.length > 0 ? (
              <View className="gap-2">
                <Text size="xs" weight="700" color={t.gold}>{tr('planner.eventsOnDay')}</Text>
                {dayEvents.map((ev) => <EventLine key={ev.id} ev={ev} />)}
              </View>
            ) : null}
            {upcomingEvents.length > 0 ? (
              <View className={`gap-2 ${dayEvents.length > 0 ? 'mt-2 border-t border-line pt-3' : ''}`}>
                <Text size="xs" weight="700" muted>{tr('planner.upcomingEvents')}</Text>
                {upcomingEvents.map((ev) => <EventLine key={ev.id} ev={ev} showDate />)}
              </View>
            ) : null}
          </>
        )}
      </Card>

      {isToday && (
        <>
          <SectionHeader title={tr('planner.habits')} action={tr('planner.newHabit')} onAction={() => router.push('/new-habit')} />
          <Card>
            {(dash.data?.habits ?? []).length === 0 ? <EmptyState icon="repeat" title={tr('planner.noHabitsTitle')} body={tr('planner.noHabitsBody')} />
              : (dash.data?.habits ?? []).map((h) => (
                <View key={h.id} className="flex-row items-center gap-[16px] py-[4px]">
                  <Check checked={h.stats.completed_today} label={tr('home.habitLabel', { name: h.name })} onPress={() => toggleHabit.mutate({ id: h.id, date, done: !h.stats.completed_today })} />
                  <Text style={{ flex: 1 }}>{h.name}</Text>
                  {h.stats.streak > 0 ? <Text size="xs" muted>{tr(`domain.unit_${h.stats.streak_unit}`, { count: h.stats.streak })}</Text> : null}
                </View>
              ))}
          </Card>
        </>
      )}

      {calendarOpen ? (
        <JumpDateModal
          visible={calendarOpen}
          value={date}
          today={today}
          onSelect={(d) => setPicked(d === today ? null : d)}
          onClose={() => setCalendarOpen(false)}
        />
      ) : null}
    </Screen>
  );
}
