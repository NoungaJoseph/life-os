import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Modal, Platform, Pressable, View } from 'react-native';
import { api } from '../lib/api';
import { addDays } from '../lib/dates';
import { errorMessage } from '../lib/errors';
import { isEveningPromptDue, syncEveningCheckinNotification, useEveningCheckinState } from '../lib/eveningCheckin';
import { localDateKey } from '../lib/eveningCheckinLogic';
import { makeEventReminderCopy, syncCalendarEventNotifications } from '../lib/eventNotifications';
import { ensureLocalNotificationPermission } from '../lib/notificationsSetup';
import { enablePush } from '../lib/push';
import {
  activeMealSlot,
  shouldPromptMealFollowUp,
  shouldPromptMorningPlan,
} from '../lib/routineLogic';
import {
  dismissMealSlotToday,
  dismissMorningToday,
  loadRoutineState,
  snoozeMealFollowUp,
  snoozeMorning,
  syncRoutineNotifications,
  useRoutineState,
} from '../lib/routineNotifications';
import { CalendarEvent } from '../lib/types';
import { useTheme } from '../theme/useTheme';
import { Button, Chip, ErrorText, Field, IconBadge, Row, Text, success } from './ui';

type MealPlan = { id: string; meal_id: string | null; meal_type: string; custom_name: string | null };
type FoodLog = { id: string; meal_type: string; description: string };
type SavedMeal = { id: string; name: string; meal_type: string };

export function RoutinePrompts({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const routine = useRoutineState();
  const evening = useEveningCheckinState();
  const [tick, setTick] = useState(() => Date.now());
  const [customMeal, setCustomMeal] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void loadRoutineState();
  }, []);

  const syncAllRoutines = () =>
    syncRoutineNotifications({
      channelName: t('ui.push.channel'),
      morningTitle: t('routine.notif.morningTitle'),
      morningBody: t('routine.notif.morningBody'),
      breakfastTitle: t('routine.notif.breakfastTitle'),
      breakfastBody: t('routine.notif.breakfastBody'),
      lunchTitle: t('routine.notif.lunchTitle'),
      lunchBody: t('routine.notif.lunchBody'),
      dinnerTitle: t('routine.notif.dinnerTitle'),
      dinnerBody: t('routine.notif.dinnerBody'),
      monthlyTitle: t('routine.notif.monthlyTitle'),
      monthlyBody: t('routine.notif.monthlyBody'),
    });

  useEffect(() => {
    if (!active || !routine.loaded) return;
    let cancelled = false;
    void (async () => {
      const perm = await ensureLocalNotificationPermission({ requestIfNeeded: true, onceOnly: true });
      if (cancelled || perm !== 'granted') return;
      await Promise.all([
        syncAllRoutines(),
        syncEveningCheckinNotification(t('eveningCheckin.notifTitle'), t('eveningCheckin.notifBody')),
        enablePush().catch(() => undefined),
      ]);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, routine.loaded]);

  useEffect(() => {
    if (!active || !routine.loaded) return;
    void syncAllRoutines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    active,
    routine.loaded,
    routine.morningEnabled,
    routine.morningTime,
    routine.mealsEnabled,
    routine.breakfastTime,
    routine.lunchTime,
    routine.dinnerTime,
    routine.monthlyReportEnabled,
    t,
  ]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick(Date.now()), 60_000);
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') setTick(Date.now());
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [active]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const handleTap = (data: { route?: string; meal?: string; tab?: string; date?: string } | undefined) => {
      if (!data?.route) return;
      if (data.route === '/morning-plan') {
        router.push(data.meal ? { pathname: '/morning-plan', params: { meal: data.meal } } : '/morning-plan');
      } else if (data.route === '/review') {
        router.push(data.tab ? { pathname: '/review', params: { tab: data.tab } } : '/review');
      } else if (data.route === '/(tabs)/planner') {
        router.push(data.date ? { pathname: '/(tabs)/planner', params: { date: data.date } } : '/(tabs)/planner');
      }
    };
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      const data = response?.notification.request.content.data as any;
      if (data?.route === '/morning-plan' || data?.route === '/review' || data?.route === '/(tabs)/planner') {
        void Notifications.clearLastNotificationResponseAsync();
        handleTap(data);
      }
    });
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleTap(response.notification.request.content.data as any);
    });
    return () => sub.remove();
  }, [router]);

  const now = new Date(tick);
  const today = localDateKey(now);
  const eventsQ = useQuery({
    queryKey: ['calendar-events', 'upcoming'],
    queryFn: () => api<CalendarEvent[]>(`/calendar-events?from=${addDays(today, -1)}&pageSize=100`),
    enabled: active,
  });

  useEffect(() => {
    if (!active || !eventsQ.data) return;
    void syncCalendarEventNotifications(eventsQ.data, makeEventReminderCopy(t));
  }, [active, eventsQ.data, t]);
  const mealTimes = {
    breakfast: routine.breakfastTime,
    lunch: routine.lunchTime,
    dinner: routine.dinnerTime,
  };
  const candidateSlot = routine.loaded && routine.mealsEnabled ? activeMealSlot(now, mealTimes) : null;

  const foodLogsQ = useQuery({
    queryKey: ['food-logs', today],
    queryFn: () => api<FoodLog[]>(`/food-logs?from=${today}&to=${today}&pageSize=50`),
    enabled: active && !!candidateSlot,
  });
  const mealPlansQ = useQuery({
    queryKey: ['meal-plans', today],
    queryFn: () => api<MealPlan[]>(`/meal-plans?from=${today}&to=${today}&pageSize=50`),
    enabled: active && !!candidateSlot,
  });
  const mealsQ = useQuery({
    queryKey: ['meals-library'],
    queryFn: () => api<SavedMeal[]>('/meals?pageSize=50'),
    enabled: active && !!candidateSlot,
  });

  const logMeal = useMutation({
    mutationFn: ({ slot, description }: { slot: string; description: string }) =>
      api('/food-logs', {
        method: 'POST',
        body: { logged_on: today, meal_type: slot, description: description.trim() },
      }),
    onSuccess: () => {
      success();
      setCustomMeal('');
      setErr(null);
      void qc.invalidateQueries({ queryKey: ['food-logs', today] });
    },
    onError: (e) => setErr(errorMessage(e, t)),
  });

  if (!active || !routine.loaded) return null;
  if (isEveningPromptDue(evening, now)) return null;

  const showMorning = shouldPromptMorningPlan({
    now,
    morningTime: routine.morningTime,
    doneDate: routine.morningDoneDate,
    dismissedDate: routine.morningDismissedDate,
    snoozeUntil: routine.morningSnoozeUntil,
    enabled: routine.morningEnabled,
  });

  if (showMorning) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={() => void snoozeMorning(15)}>
        <View className="flex-1 justify-end bg-black/60 p-4 sm:justify-center">
          <View className="gap-4 rounded-2xl border border-line bg-bg p-6" style={{ maxWidth: 460, width: '100%', alignSelf: 'center' }}>
            <View className="flex-row items-center gap-3">
              <IconBadge icon="sunny" tone="accent" size={44} />
              <View className="flex-1">
                <Text size="xs" weight="700" color={theme.gold} style={{ letterSpacing: 1.5 }}>{t('routine.morningPopup.eyebrow')}</Text>
                <Text size="lg" serif>{t('routine.morningPopup.title')}</Text>
              </View>
            </View>
            <Text size="sm" muted>{t('routine.morningPopup.body')}</Text>
            <View className="gap-2">
              <Button title={t('routine.morningPopup.start')} icon="sunny-outline" onPress={() => router.push('/morning-plan')} />
              <Button title={t('eveningCheckin.snooze15')} variant="ghost" onPress={() => void snoozeMorning(15)} />
            </View>
            <Pressable accessibilityRole="button" onPress={() => void dismissMorningToday(today)} className="items-center py-2">
              <Text size="xs" muted>{t('routine.morningPopup.skip')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  if (!foodLogsQ.isSuccess) return null;

  const dismissedSlotsToday = routine.mealDismissedDate === today ? routine.mealDismissedSlots : [];
  const loggedSlots = (foodLogsQ.data ?? []).map((f) => f.meal_type);
  const dueMeal = shouldPromptMealFollowUp({
    now,
    mealTimes,
    loggedMealsToday: loggedSlots,
    dismissedSlotsToday,
    snoozeUntil: routine.mealSnoozeUntil,
    enabled: routine.mealsEnabled,
  });

  if (!dueMeal) return null;

  const mealNamesById = new Map((mealsQ.data ?? []).map((m) => [m.id, m.name]));
  const plansForSlot = (mealPlansQ.data ?? []).filter((p) => p.meal_type === dueMeal);
  const latestPlan = plansForSlot[plansForSlot.length - 1];
  const plannedName = latestPlan ? (latestPlan.custom_name || (latestPlan.meal_id ? mealNamesById.get(latestPlan.meal_id) : '') || '') : '';
  const savedSuggestions = (mealsQ.data ?? []).filter((m) => m.meal_type === dueMeal).slice(0, 5);
  const mealLabel = t(`modules.opt.${dueMeal}`);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => void snoozeMealFollowUp(15)}>
      <View className="flex-1 justify-end bg-black/60 p-4 sm:justify-center">
        <View className="gap-4 rounded-2xl border border-line bg-bg p-6" style={{ maxWidth: 460, width: '100%', alignSelf: 'center' }}>
          <View className="flex-row items-center gap-3">
            <IconBadge icon="restaurant" tone="info" size={44} />
            <View className="flex-1">
              <Text size="xs" weight="700" color={theme.gold} style={{ letterSpacing: 1.5 }}>{t('routine.mealPopup.eyebrow')}</Text>
              <Text size="lg" serif>{t('routine.mealPopup.title', { meal: mealLabel })}</Text>
            </View>
          </View>

          {plannedName ? (
            <View className="gap-3 rounded-lg bg-surface-alt p-3">
              <Text size="sm" muted>{t('routine.mealPopup.plannedPrompt', { meal: mealLabel.toLowerCase(), name: plannedName })}</Text>
              <Button
                title={t('routine.mealPopup.yesTookIt')}
                icon="checkmark-circle-outline"
                loading={logMeal.isPending}
                onPress={() => logMeal.mutate({ slot: dueMeal, description: plannedName })}
              />
            </View>
          ) : (
            <Text size="sm" muted>{t('routine.mealPopup.askPrompt', { meal: mealLabel.toLowerCase() })}</Text>
          )}

          {savedSuggestions.length > 0 && (
            <Row>
              {savedSuggestions.map((m) => (
                <Chip key={m.id} label={m.name} selected={customMeal === m.name} onPress={() => setCustomMeal(m.name)} />
              ))}
            </Row>
          )}

          <Field
            label={plannedName ? t('routine.mealPopup.somethingElse') : t('routine.mealPopup.whatAte')}
            value={customMeal}
            onChangeText={setCustomMeal}
            placeholder={t('morningPlan.mealInputPlaceholder')}
          />
          <ErrorText message={err} />

          <View className="gap-2">
            <Button
              title={t('routine.mealPopup.logBtn')}
              variant={plannedName ? 'ghost' : 'primary'}
              disabled={!customMeal.trim()}
              loading={logMeal.isPending}
              onPress={() => logMeal.mutate({ slot: dueMeal, description: customMeal })}
            />
            <Button title={t('eveningCheckin.snooze15')} variant="ghost" onPress={() => void snoozeMealFollowUp(15)} />
          </View>
          <Pressable accessibilityRole="button" onPress={() => void dismissMealSlotToday(dueMeal, today)} className="items-center py-2">
            <Text size="xs" muted>{t('routine.mealPopup.skip')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
