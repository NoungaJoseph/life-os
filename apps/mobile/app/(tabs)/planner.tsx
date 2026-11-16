import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, View } from 'react-native';
import { Card, Check, EmptyState, ErrorState, FadeIn, Header, Loading, Pill, Screen, SectionHeader, Text, tap } from '../../src/components/ui';
import { api } from '../../src/lib/api';
import { errorMessage } from '../../src/lib/errors';
import { addDays, dayNum, prettyDate, shortDays, weekStart } from '../../src/lib/dates';
import { useDashboard, useRefreshAll, useToggleHabit, useToggleTask } from '../../src/lib/hooks';
import { Task } from '../../src/lib/types';
import { spacing } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/useTheme';

export default function Planner() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const router = useRouter();
  const dash = useDashboard();
  const refresh = useRefreshAll();
  const toggleTask = useToggleTask();
  const toggleHabit = useToggleHabit();
  const today = dash.data?.date;
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? today;

  const tasks = useQuery({
    queryKey: ['tasks', date],
    queryFn: () => api<Task[]>(`/tasks?from=${date}&to=${date}&pageSize=100`),
    enabled: !!date,
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => { void refresh(); },
  });

  if (dash.isLoading) return <Loading />;
  if (dash.error || !date || !today) return <Screen><ErrorState message={dash.error ? errorMessage(dash.error, tr) : tr('planner.loadError')} onRetry={() => void dash.refetch()} /></Screen>;

  const start = weekStart(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const isToday = date === today;
  const overdue = isToday ? (dash.data?.priorities ?? []).filter((x) => x.overdue) : [];

  const confirmDelete = (task: Task) => {
    if (Platform.OS === 'web') { if (window.confirm(tr('planner.deleteConfirm', { title: task.title }))) del.mutate(task.id); return; }
    Alert.alert(tr('planner.deleteTitle'), tr('planner.deleteConfirm', { title: task.title }), [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('common.delete'), style: 'destructive', onPress: () => del.mutate(task.id) }]);
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

  return (
    <Screen onRefresh={() => void refresh()} refreshing={tasks.isRefetching} bottomPad={130}>
      <Header title={tr('planner.title')} subtitle={prettyDate(date)} />

      <View className="flex-row items-center gap-[4px]">
        <Pressable hitSlop={10} accessibilityLabel={tr('planner.prevWeek')} onPress={() => { tap(); setPicked(addDays(date, -7)); }}><Ionicons name="chevron-back" size={22} color={t.primary} /></Pressable>
        <View className="flex-1 flex-row justify-between">
          {days.map((d, i) => {
            const sel = d === date;
            return (
              <Pressable key={d} accessibilityRole="button" accessibilityState={{ selected: sel }} accessibilityLabel={prettyDate(d)} onPress={() => { tap(); setPicked(d); }}
                style={{ alignItems: 'center', gap: 4, paddingVertical: 8, width: 40, borderRadius: 14, backgroundColor: sel ? t.primaryDark : 'transparent' }}>
                <Text size="xs" color={sel ? '#9FB3C8' : t.textSecondary} weight="500">{shortDays()[i]}</Text>
                <Text weight="600" color={sel ? '#FFFFFF' : t.text}>{dayNum(d)}</Text>
                <View className={`h-[5px] w-[5px] rounded-full ${d === today ? 'bg-primary' : 'bg-transparent'}`} />
              </Pressable>
            );
          })}
        </View>
        <Pressable hitSlop={10} accessibilityLabel={tr('planner.nextWeek')} onPress={() => { tap(); setPicked(addDays(date, 7)); }}><Ionicons name="chevron-forward" size={22} color={t.primary} /></Pressable>
      </View>
      {!isToday && <Pressable onPress={() => setPicked(null)}><Text size="sm" color={t.primary} weight="600">{tr('planner.jumpToday')}</Text></Pressable>}

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
    </Screen>
  );
}
