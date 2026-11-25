import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import {
  Button, Card, Check, Chip, ErrorState, ErrorText, Field, Header, Hero, Loading, Pill, Row, Screen, SectionHeader, Text, success,
} from '../src/components/ui';
import { api } from '../src/lib/api';
import { addDays, prettyDate } from '../src/lib/dates';
import { errorMessage } from '../src/lib/errors';
import { localDateKey } from '../src/lib/eveningCheckinLogic';
import { useDashboard, useRefreshAll, useToggleTask } from '../src/lib/hooks';
import { markMorningPlanDone } from '../src/lib/routineNotifications';
import { Task } from '../src/lib/types';
import { useTheme } from '../src/theme/useTheme';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type SavedMeal = { id: string; name: string; meal_type: MealType; ingredients?: string | null };
type MealPlan = { id: string; meal_id: string | null; plan_date: string; meal_type: MealType; custom_name: string | null; prep_notes?: string | null };
type FoodLog = { id: string; logged_on: string; meal_type: MealType; description: string };
type DailySchedule = { id: string; schedule_date: string; main_priority: string | null; support_priorities: string[] | null };
type DailyReview = { id: string; review_date: string; tomorrow_priorities: string | null };
type CalendarEvent = { id: string; title: string; kind: string; starts_at: string; location?: string | null };

const SLOTS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const PRIORITIES: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];

export default function MorningPlan() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { meal: focusMeal } = useLocalSearchParams<{ meal?: string }>();
  const dash = useDashboard();
  const toggleTask = useToggleTask();
  const refreshAll = useRefreshAll();

  const today = dash.data?.date ?? localDateKey();
  const yesterday = addDays(today, -1);

  const yesterdayReviewQ = useQuery({
    queryKey: ['morning-yesterday-review', yesterday],
    queryFn: () => api<DailyReview[]>(`/daily-reviews?from=${yesterday}&to=${yesterday}&pageSize=5`),
  });
  const scheduleQ = useQuery({
    queryKey: ['daily-schedule', today],
    queryFn: () => api<DailySchedule[]>(`/daily-schedules?from=${today}&to=${today}&pageSize=5`),
  });
  const tasksQ = useQuery({
    queryKey: ['tasks', today],
    queryFn: () => api<Task[]>(`/tasks?from=${today}&to=${today}&pageSize=100`),
  });
  const eventsQ = useQuery({
    queryKey: ['morning-events', today],
    queryFn: () => api<CalendarEvent[]>(`/calendar-events?from=${today}&to=${today}&pageSize=50`),
  });
  const mealsQ = useQuery({
    queryKey: ['meals-library'],
    queryFn: () => api<SavedMeal[]>('/meals?pageSize=50'),
  });
  const mealPlansQ = useQuery({
    queryKey: ['meal-plans', today],
    queryFn: () => api<MealPlan[]>(`/meal-plans?from=${today}&to=${today}&pageSize=50`),
  });
  const foodLogsQ = useQuery({
    queryKey: ['food-logs', today],
    queryFn: () => api<FoodLog[]>(`/food-logs?from=${today}&to=${today}&pageSize=50`),
  });

  const existingSchedule = scheduleQ.data?.[0];
  const [mainPriority, setMainPriority] = useState<string | undefined>(undefined);
  const [supportOne, setSupportOne] = useState<string | undefined>(undefined);
  const [supportTwo, setSupportTwo] = useState<string | undefined>(undefined);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPrio, setTaskPrio] = useState<'low' | 'medium' | 'high'>('medium');
  const [mealInputs, setMealInputs] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState(false);

  const currentMain = mainPriority ?? existingSchedule?.main_priority ?? '';
  const currentSupportOne = supportOne ?? existingSchedule?.support_priorities?.[0] ?? '';
  const currentSupportTwo = supportTwo ?? existingSchedule?.support_priorities?.[1] ?? '';

  const addTask = useMutation({
    mutationFn: () => {
      if (!taskTitle.trim()) throw new Error(t('newTask.errors.title'));
      return api('/tasks', { method: 'POST', body: { title: taskTitle.trim(), priority: taskPrio, due_date: today } });
    },
    onSuccess: () => {
      success();
      setTaskTitle('');
      setErr(null);
      void qc.invalidateQueries({ queryKey: ['tasks', today] });
      void refreshAll();
    },
    onError: (e) => setErr(errorMessage(e, t)),
  });

  const planMeal = useMutation({
    mutationFn: ({ slot, name, mealId }: { slot: MealType; name: string; mealId?: string }) =>
      api('/meal-plans', {
        method: 'POST',
        body: {
          plan_date: today,
          meal_type: slot,
          ...(mealId ? { meal_id: mealId } : {}),
          custom_name: name.trim(),
        },
      }),
    onSuccess: (_d, vars) => {
      success();
      setMealInputs((m) => ({ ...m, [vars.slot]: '' }));
      setErr(null);
      void qc.invalidateQueries({ queryKey: ['meal-plans', today] });
    },
    onError: (e) => setErr(errorMessage(e, t)),
  });

  const logMeal = useMutation({
    mutationFn: ({ slot, description }: { slot: MealType; description: string }) =>
      api('/food-logs', {
        method: 'POST',
        body: { logged_on: today, meal_type: slot, description: description.trim() },
      }),
    onSuccess: (_d, vars) => {
      success();
      setMealInputs((m) => ({ ...m, [vars.slot]: '' }));
      setErr(null);
      void qc.invalidateQueries({ queryKey: ['food-logs', today] });
    },
    onError: (e) => setErr(errorMessage(e, t)),
  });

  const savePlan = useMutation({
    mutationFn: () => {
      const supports = [currentSupportOne.trim(), currentSupportTwo.trim()].filter(Boolean);
      return api('/daily-schedules', {
        method: 'POST',
        body: {
          schedule_date: today,
          ...(currentMain.trim() ? { main_priority: currentMain.trim() } : {}),
          support_priorities: supports,
        },
      });
    },
    onSuccess: async () => {
      await markMorningPlanDone(today);
      success();
      setErr(null);
      setSavedBanner(true);
      void qc.invalidateQueries({ queryKey: ['daily-schedule', today] });
      void refreshAll();
    },
    onError: (e) => setErr(errorMessage(e, t)),
  });

  if (dash.isLoading) return <Loading />;
  if (dash.error) {
    return (
      <Screen>
        <Header title={t('morningPlan.title')} back />
        <ErrorState message={errorMessage(dash.error, t)} onRetry={() => void dash.refetch()} />
      </Screen>
    );
  }

  const carryOver = yesterdayReviewQ.data?.[0]?.tomorrow_priorities;
  const mealNamesById = new Map((mealsQ.data ?? []).map((m) => [m.id, m.name]));
  const orderedSlots = focusMeal && SLOTS.includes(focusMeal as MealType)
    ? [focusMeal as MealType, ...SLOTS.filter((s) => s !== focusMeal)]
    : SLOTS;

  return (
    <Screen bottomPad={50}>
      <Header
        eyebrow={t('morningPlan.eyebrow')}
        title={t('morningPlan.title')}
        subtitle={prettyDate(today)}
        back
      />

      {carryOver ? (
        <Hero colors={['#14213D', '#223E66']}>
          <Text size="xs" color="#C9A24B" weight="700" style={{ letterSpacing: 1.4 }}>{t('morningPlan.carryOverTitle')}</Text>
          <Text size="sm" color="#FFFFFF" style={{ marginTop: 4 }}>{carryOver}</Text>
        </Hero>
      ) : null}

      <SectionHeader title={t('morningPlan.prioritiesTitle')} />
      <Card className="gap-3">
        <Field
          label={t('morningPlan.mainPriority')}
          value={currentMain}
          onChangeText={(v) => { setMainPriority(v); setSavedBanner(false); }}
          placeholder={t('morningPlan.mainPlaceholder')}
        />
        <Field
          label={t('morningPlan.supportOne')}
          value={currentSupportOne}
          onChangeText={(v) => { setSupportOne(v); setSavedBanner(false); }}
          placeholder={t('morningPlan.supportPlaceholder')}
        />
        <Field
          label={t('morningPlan.supportTwo')}
          value={currentSupportTwo}
          onChangeText={(v) => { setSupportTwo(v); setSavedBanner(false); }}
          placeholder={t('morningPlan.supportPlaceholder')}
        />
      </Card>

      <SectionHeader title={t('morningPlan.scheduleTitle')} />
      {(eventsQ.data ?? []).length > 0 && (
        <Card className="gap-2">
          <Text size="sm" weight="600">{t('morningPlan.eventsToday')}</Text>
          {(eventsQ.data ?? []).map((ev) => (
            <View key={ev.id} className="flex-row items-center justify-between py-1">
              <Text size="sm" style={{ flex: 1 }}>{ev.title}</Text>
              <Text size="xs" muted>{ev.starts_at.slice(11, 16)}{ev.location ? ` · ${ev.location}` : ''}</Text>
            </View>
          ))}
        </Card>
      )}

      <Card className="gap-3">
        <Text size="sm" weight="600">{t('morningPlan.tasksToday')}</Text>
        {(tasksQ.data ?? []).length === 0 ? (
          <Text size="xs" muted>{t('morningPlan.noTasksToday')}</Text>
        ) : (
          (tasksQ.data ?? []).map((task) => (
            <View key={task.id} className="flex-row items-center gap-3 py-1">
              <Check
                checked={!!task.completed_at}
                label={task.title}
                onPress={() => toggleTask.mutate({ id: task.id, completed: !task.completed_at })}
              />
              <Text style={{ flex: 1, textDecorationLine: task.completed_at ? 'line-through' : 'none' }} muted={!!task.completed_at}>
                {task.title}
              </Text>
              <Pill label={t(`newTask.priorities.${task.priority}`)} tone={task.priority === 'high' ? 'error' : 'neutral'} />
            </View>
          ))
        )}
        <Field
          label={t('morningPlan.addTaskLabel')}
          value={taskTitle}
          onChangeText={setTaskTitle}
          placeholder={t('morningPlan.addTaskPlaceholder')}
        />
        <Row>
          {PRIORITIES.map((p) => (
            <Chip key={p} label={t(`newTask.priorities.${p}`)} selected={taskPrio === p} onPress={() => setTaskPrio(p)} />
          ))}
        </Row>
        <Button title={t('morningPlan.addTaskBtn')} variant="ghost" icon="add" loading={addTask.isPending} onPress={() => addTask.mutate()} />
      </Card>

      <SectionHeader title={t('morningPlan.foodTitle')} />
      <Text size="xs" muted>{t('morningPlan.foodSubtitle')}</Text>
      {orderedSlots.map((slot) => {
        const plans = (mealPlansQ.data ?? []).filter((p) => p.meal_type === slot);
        const latestPlan = plans[plans.length - 1];
        const plannedName = latestPlan ? (latestPlan.custom_name || (latestPlan.meal_id ? mealNamesById.get(latestPlan.meal_id) : '') || '') : '';
        const logged = (foodLogsQ.data ?? []).filter((f) => f.meal_type === slot);
        const savedForSlot = (mealsQ.data ?? []).filter((m) => m.meal_type === slot).slice(0, 6);
        const typed = mealInputs[slot] ?? '';

        return (
          <Card key={slot} className="gap-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Ionicons name="restaurant-outline" size={18} color={theme.primary} />
                <Text weight="700">{t(`modules.opt.${slot}`)}</Text>
              </View>
              {logged.length > 0 ? (
                <Pill label={t('morningPlan.mealLogged')} tone="success" />
              ) : plannedName ? (
                <Pill label={t('morningPlan.mealPlanned')} tone="info" />
              ) : (
                <Pill label={t('morningPlan.mealOpen')} tone="neutral" />
              )}
            </View>

            {plannedName ? (
              <View className="gap-2 rounded-md bg-surface-alt p-3">
                <Text size="xs" muted>{t('morningPlan.plannedLabel')}</Text>
                <Text weight="600">{plannedName}</Text>
                {logged.length === 0 && (
                  <Button
                    title={t('morningPlan.confirmTaken')}
                    variant="dark"
                    icon="checkmark-outline"
                    loading={logMeal.isPending && logMeal.variables?.slot === slot}
                    onPress={() => logMeal.mutate({ slot, description: plannedName })}
                  />
                )}
              </View>
            ) : null}

            {logged.map((entry) => (
              <View key={entry.id} className="flex-row items-center gap-2">
                <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                <Text size="sm" muted>{entry.description}</Text>
              </View>
            ))}

            {savedForSlot.length > 0 && (
              <Row>
                {savedForSlot.map((m) => (
                  <Chip
                    key={m.id}
                    label={m.name}
                    selected={typed === m.name}
                    onPress={() => setMealInputs((prev) => ({ ...prev, [slot]: m.name }))}
                  />
                ))}
              </Row>
            )}

            <Field
              label={t('morningPlan.mealInputLabel', { meal: t(`modules.opt.${slot}`).toLowerCase() })}
              value={typed}
              onChangeText={(v) => setMealInputs((prev) => ({ ...prev, [slot]: v }))}
              placeholder={t('morningPlan.mealInputPlaceholder')}
            />
            <Row>
              <View className="flex-1">
                <Button
                  title={t('morningPlan.setPlanBtn')}
                  variant="ghost"
                  disabled={!typed.trim()}
                  loading={planMeal.isPending && planMeal.variables?.slot === slot}
                  onPress={() => {
                    const matched = savedForSlot.find((m) => m.name.toLowerCase() === typed.trim().toLowerCase());
                    planMeal.mutate({ slot, name: typed, mealId: matched?.id });
                  }}
                />
              </View>
              <View className="flex-1">
                <Button
                  title={t('morningPlan.logAteBtn')}
                  disabled={!typed.trim()}
                  loading={logMeal.isPending && logMeal.variables?.slot === slot}
                  onPress={() => logMeal.mutate({ slot, description: typed })}
                />
              </View>
            </Row>
          </Card>
        );
      })}

      <ErrorText message={err} />
      {savedBanner ? <Pill label={t('morningPlan.savedBanner')} tone="success" /> : null}
      <Button title={t('morningPlan.saveDayPlan')} icon="sunny-outline" loading={savePlan.isPending} onPress={() => savePlan.mutate()} />
      <Button title={t('common.back')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
