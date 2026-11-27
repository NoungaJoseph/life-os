import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SchedulableTriggerInputTypes,
  cancelScheduledNotificationAsync,
  scheduleNotificationAsync,
} from 'expo-notifications';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { localDateKey } from './eveningCheckinLogic';
import {
  NOTIFICATION_CHANNEL_ID,
  configureNotifications,
  ensureLocalNotificationPermission,
  ensureNotificationChannel,
} from './notificationsSetup';
import { DEFAULT_ROUTINE_TIMES, MealSlot } from './routineLogic';
import { parseTime } from './timeInput';

const PREFIX = 'mylifeos:routine:';
const KEYS = {
  morningEnabled: `${PREFIX}morning-enabled`,
  morningTime: `${PREFIX}morning-time`,
  mealsEnabled: `${PREFIX}meals-enabled`,
  breakfastTime: `${PREFIX}breakfast-time`,
  lunchTime: `${PREFIX}lunch-time`,
  dinnerTime: `${PREFIX}dinner-time`,
  monthlyReportEnabled: `${PREFIX}monthly-report-enabled`,
  morningDoneDate: `${PREFIX}morning-done-date`,
  morningDismissedDate: `${PREFIX}morning-dismissed-date`,
  morningSnoozeUntil: `${PREFIX}morning-snooze-until`,
  mealDismissedDate: `${PREFIX}meal-dismissed-date`,
  mealDismissedSlots: `${PREFIX}meal-dismissed-slots`,
  mealSnoozeUntil: `${PREFIX}meal-snooze-until`,
  notifIds: `${PREFIX}notif-ids`,
} as const;

export interface RoutineState {
  loaded: boolean;
  morningEnabled: boolean;
  morningTime: string;
  mealsEnabled: boolean;
  breakfastTime: string;
  lunchTime: string;
  dinnerTime: string;
  monthlyReportEnabled: boolean;
  morningDoneDate: string | null;
  morningDismissedDate: string | null;
  morningSnoozeUntil: number | null;
  mealDismissedDate: string | null;
  mealDismissedSlots: MealSlot[];
  mealSnoozeUntil: number | null;
}

let state: RoutineState = {
  loaded: false,
  morningEnabled: true,
  morningTime: DEFAULT_ROUTINE_TIMES.morning,
  mealsEnabled: true,
  breakfastTime: DEFAULT_ROUTINE_TIMES.breakfast,
  lunchTime: DEFAULT_ROUTINE_TIMES.lunch,
  dinnerTime: DEFAULT_ROUTINE_TIMES.dinner,
  monthlyReportEnabled: true,
  morningDoneDate: null,
  morningDismissedDate: null,
  morningSnoozeUntil: null,
  mealDismissedDate: null,
  mealDismissedSlots: [],
  mealSnoozeUntil: null,
};

const listeners = new Set<() => void>();
const emit = (next: RoutineState) => {
  state = next;
  listeners.forEach((cb) => cb());
};

export const useRoutineState = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => state,
    () => state,
  );

export async function requestLocalNotificationPermission(): Promise<'granted' | 'denied' | 'web'> {
  return ensureLocalNotificationPermission({ requestIfNeeded: true });
}

function validTime(raw: string | null | undefined, fallback: string): string {
  return raw && parseTime(raw) ? raw : fallback;
}

export async function loadRoutineState(): Promise<RoutineState> {
  try {
    const pairs = await AsyncStorage.multiGet(Object.values(KEYS));
    const map = Object.fromEntries(pairs);
    const rawSlots = map[KEYS.mealDismissedSlots];
    let mealDismissedSlots: MealSlot[] = [];
    if (rawSlots) {
      try {
        const parsed = JSON.parse(rawSlots);
        if (Array.isArray(parsed)) mealDismissedSlots = parsed.filter((s) => s === 'breakfast' || s === 'lunch' || s === 'dinner');
      } catch {
        mealDismissedSlots = [];
      }
    }
    const rawMSnooze = map[KEYS.morningSnoozeUntil];
    const rawMealSnooze = map[KEYS.mealSnoozeUntil];
    const next: RoutineState = {
      loaded: true,
      morningEnabled: map[KEYS.morningEnabled] === '0' ? false : true,
      morningTime: validTime(map[KEYS.morningTime], DEFAULT_ROUTINE_TIMES.morning),
      mealsEnabled: map[KEYS.mealsEnabled] === '0' ? false : true,
      breakfastTime: validTime(map[KEYS.breakfastTime], DEFAULT_ROUTINE_TIMES.breakfast),
      lunchTime: validTime(map[KEYS.lunchTime], DEFAULT_ROUTINE_TIMES.lunch),
      dinnerTime: validTime(map[KEYS.dinnerTime], DEFAULT_ROUTINE_TIMES.dinner),
      monthlyReportEnabled: map[KEYS.monthlyReportEnabled] === '0' ? false : true,
      morningDoneDate: map[KEYS.morningDoneDate] || null,
      morningDismissedDate: map[KEYS.morningDismissedDate] || null,
      morningSnoozeUntil: rawMSnooze && !Number.isNaN(Number(rawMSnooze)) ? Number(rawMSnooze) : null,
      mealDismissedDate: map[KEYS.mealDismissedDate] || null,
      mealDismissedSlots,
      mealSnoozeUntil: rawMealSnooze && !Number.isNaN(Number(rawMealSnooze)) ? Number(rawMealSnooze) : null,
    };
    emit(next);
    return next;
  } catch {
    const next = { ...state, loaded: true };
    emit(next);
    return next;
  }
}

export async function setRoutinePrefs(
  patch: Partial<
    Pick<
      RoutineState,
      'morningEnabled' | 'morningTime' | 'mealsEnabled' | 'breakfastTime' | 'lunchTime' | 'dinnerTime' | 'monthlyReportEnabled'
    >
  >,
): Promise<RoutineState> {
  const next: RoutineState = {
    ...state,
    loaded: true,
    morningEnabled: patch.morningEnabled ?? state.morningEnabled,
    morningTime: validTime(patch.morningTime, state.morningTime),
    mealsEnabled: patch.mealsEnabled ?? state.mealsEnabled,
    breakfastTime: validTime(patch.breakfastTime, state.breakfastTime),
    lunchTime: validTime(patch.lunchTime, state.lunchTime),
    dinnerTime: validTime(patch.dinnerTime, state.dinnerTime),
    monthlyReportEnabled: patch.monthlyReportEnabled ?? state.monthlyReportEnabled,
  };
  try {
    await AsyncStorage.multiSet([
      [KEYS.morningEnabled, next.morningEnabled ? '1' : '0'],
      [KEYS.morningTime, next.morningTime],
      [KEYS.mealsEnabled, next.mealsEnabled ? '1' : '0'],
      [KEYS.breakfastTime, next.breakfastTime],
      [KEYS.lunchTime, next.lunchTime],
      [KEYS.dinnerTime, next.dinnerTime],
      [KEYS.monthlyReportEnabled, next.monthlyReportEnabled ? '1' : '0'],
    ]);
  } catch {
    /* ignore */
  }
  emit(next);
  return next;
}

export async function markMorningPlanDone(date = localDateKey()): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [KEYS.morningDoneDate, date],
      [KEYS.morningSnoozeUntil, ''],
    ]);
  } catch {
    /* ignore */
  }
  emit({ ...state, loaded: true, morningDoneDate: date, morningSnoozeUntil: null });
}

export async function dismissMorningToday(date = localDateKey()): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [KEYS.morningDismissedDate, date],
      [KEYS.morningSnoozeUntil, ''],
    ]);
  } catch {
    /* ignore */
  }
  emit({ ...state, loaded: true, morningDismissedDate: date, morningSnoozeUntil: null });
}

export async function snoozeMorning(minutes = 15): Promise<void> {
  const until = Date.now() + minutes * 60_000;
  try {
    await AsyncStorage.setItem(KEYS.morningSnoozeUntil, String(until));
  } catch {
    /* ignore */
  }
  emit({ ...state, loaded: true, morningSnoozeUntil: until });
}

export async function dismissMealSlotToday(slot: MealSlot, date = localDateKey()): Promise<void> {
  const base = state.mealDismissedDate === date ? state.mealDismissedSlots : [];
  const nextSlots = [...new Set([...base, slot])];
  try {
    await AsyncStorage.multiSet([
      [KEYS.mealDismissedDate, date],
      [KEYS.mealDismissedSlots, JSON.stringify(nextSlots)],
      [KEYS.mealSnoozeUntil, ''],
    ]);
  } catch {
    /* ignore */
  }
  emit({ ...state, loaded: true, mealDismissedDate: date, mealDismissedSlots: nextSlots, mealSnoozeUntil: null });
}

export async function snoozeMealFollowUp(minutes = 15): Promise<void> {
  const until = Date.now() + minutes * 60_000;
  try {
    await AsyncStorage.setItem(KEYS.mealSnoozeUntil, String(until));
  } catch {
    /* ignore */
  }
  emit({ ...state, loaded: true, mealSnoozeUntil: until });
}

export interface RoutineNotificationCopy {
  channelName: string;
  morningTitle: string;
  morningBody: string;
  breakfastTitle: string;
  breakfastBody: string;
  lunchTitle: string;
  lunchBody: string;
  dinnerTitle: string;
  dinnerBody: string;
  monthlyTitle: string;
  monthlyBody: string;
}

export async function syncRoutineNotifications(copy: RoutineNotificationCopy, requestIfNeeded = false): Promise<'scheduled' | 'denied' | 'web'> {
  if (Platform.OS === 'web') return 'web';
  configureNotifications();
  try {
    const rawIds = await AsyncStorage.getItem(KEYS.notifIds);
    if (rawIds) {
      const oldIds = JSON.parse(rawIds) as string[];
      if (Array.isArray(oldIds)) {
        await Promise.all(oldIds.map((id) => cancelScheduledNotificationAsync(id).catch(() => undefined)));
      }
      await AsyncStorage.removeItem(KEYS.notifIds);
    }

    const current = state.loaded ? state : await loadRoutineState();
    const perm = await ensureLocalNotificationPermission({ requestIfNeeded });
    if (perm !== 'granted') return 'denied';

    await ensureNotificationChannel(copy.channelName);

    const scheduledIds: string[] = [];

    if (current.morningEnabled) {
      const m = parseTime(current.morningTime) ?? { hour: 7, minute: 0 };
      try {
        const id = await scheduleNotificationAsync({
          content: { title: copy.morningTitle, body: copy.morningBody, sound: 'default', data: { route: '/morning-plan' } },
          trigger: { type: SchedulableTriggerInputTypes.DAILY, hour: m.hour, minute: m.minute, channelId: NOTIFICATION_CHANNEL_ID },
        });
        scheduledIds.push(id);
      } catch { /* continue scheduling other alerts */ }
    }

    if (current.mealsEnabled) {
      const meals: [MealSlot, string, string, string][] = [
        ['breakfast', current.breakfastTime, copy.breakfastTitle, copy.breakfastBody],
        ['lunch', current.lunchTime, copy.lunchTitle, copy.lunchBody],
        ['dinner', current.dinnerTime, copy.dinnerTitle, copy.dinnerBody],
      ];
      for (const [slot, hhmm, title, body] of meals) {
        const parsed = parseTime(hhmm);
        if (!parsed) continue;
        try {
          const id = await scheduleNotificationAsync({
            content: { title, body, sound: 'default', data: { route: '/morning-plan', meal: slot } },
            trigger: { type: SchedulableTriggerInputTypes.DAILY, hour: parsed.hour, minute: parsed.minute, channelId: NOTIFICATION_CHANNEL_ID },
          });
          scheduledIds.push(id);
        } catch { /* continue scheduling other alerts */ }
      }
    }

    if (current.monthlyReportEnabled) {
      try {
        const id = await scheduleNotificationAsync({
          content: { title: copy.monthlyTitle, body: copy.monthlyBody, sound: 'default', data: { route: '/review', tab: 'report' } },
          trigger: { type: SchedulableTriggerInputTypes.MONTHLY, day: 1, hour: 9, minute: 0, channelId: NOTIFICATION_CHANNEL_ID },
        });
        scheduledIds.push(id);
      } catch { /* monthly calendar trigger fallback skipped safely */ }
    }

    await AsyncStorage.setItem(KEYS.notifIds, JSON.stringify(scheduledIds));
    return 'scheduled';
  } catch {
    return 'denied';
  }
}
