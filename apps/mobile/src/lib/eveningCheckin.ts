import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SchedulableTriggerInputTypes,
  cancelScheduledNotificationAsync,
  scheduleNotificationAsync,
} from 'expo-notifications';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { DEFAULT_CHECKIN_TIME, localDateKey, shouldPromptEveningCheckin } from './eveningCheckinLogic';
import {
  NOTIFICATION_CHANNEL_ID,
  configureNotifications,
  ensureLocalNotificationPermission,
  ensureNotificationChannel,
} from './notificationsSetup';
import { parseTime } from './timeInput';

const ENABLED_KEY = 'mylifeos:evening-checkin:enabled';
const TIME_KEY = 'mylifeos:evening-checkin:time';
const DONE_KEY = 'mylifeos:evening-checkin:done-date';
const DISMISSED_KEY = 'mylifeos:evening-checkin:dismissed-date';
const SNOOZE_KEY = 'mylifeos:evening-checkin:snooze-until';
const NOTIF_ID_KEY = 'mylifeos:evening-checkin:notif-id';

export interface EveningCheckinState {
  loaded: boolean;
  enabled: boolean;
  time: string;
  doneDate: string | null;
  dismissedDate: string | null;
  snoozeUntil: number | null;
}

let state: EveningCheckinState = {
  loaded: false,
  enabled: true,
  time: DEFAULT_CHECKIN_TIME,
  doneDate: null,
  dismissedDate: null,
  snoozeUntil: null,
};

const listeners = new Set<() => void>();
const emit = (next: EveningCheckinState) => {
  state = next;
  listeners.forEach((cb) => cb());
};

export const useEveningCheckinState = () =>
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

export async function loadEveningCheckinState(): Promise<EveningCheckinState> {
  try {
    const pairs = await AsyncStorage.multiGet([ENABLED_KEY, TIME_KEY, DONE_KEY, DISMISSED_KEY, SNOOZE_KEY]);
    const map = Object.fromEntries(pairs);
    const enabled = map[ENABLED_KEY] === '0' ? false : true;
    const savedTime = map[TIME_KEY];
    const time = savedTime && parseTime(savedTime) ? savedTime : DEFAULT_CHECKIN_TIME;
    const doneDate = map[DONE_KEY] ?? null;
    const dismissedDate = map[DISMISSED_KEY] ?? null;
    const rawSnooze = map[SNOOZE_KEY];
    const snoozeUntil = rawSnooze && !Number.isNaN(Number(rawSnooze)) ? Number(rawSnooze) : null;
    const next: EveningCheckinState = { loaded: true, enabled, time, doneDate, dismissedDate, snoozeUntil };
    emit(next);
    return next;
  } catch {
    const next = { ...state, loaded: true };
    emit(next);
    return next;
  }
}

export async function setEveningCheckinPrefs(patch: { enabled?: boolean; time?: string }): Promise<EveningCheckinState> {
  const enabled = patch.enabled ?? state.enabled;
  const time = patch.time && parseTime(patch.time) ? patch.time : state.time;
  try {
    await AsyncStorage.multiSet([
      [ENABLED_KEY, enabled ? '1' : '0'],
      [TIME_KEY, time],
    ]);
  } catch {
    /* ignore */
  }
  const next = { ...state, loaded: true, enabled, time };
  emit(next);
  return next;
}

export async function markEveningCheckinDone(date = localDateKey()): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [DONE_KEY, date],
      [SNOOZE_KEY, ''],
    ]);
  } catch {
    /* ignore */
  }
  emit({ ...state, loaded: true, doneDate: date, snoozeUntil: null });
}

export async function dismissEveningCheckinTonight(date = localDateKey()): Promise<void> {
  try {
    await AsyncStorage.multiSet([
      [DISMISSED_KEY, date],
      [SNOOZE_KEY, ''],
    ]);
  } catch {
    /* ignore */
  }
  emit({ ...state, loaded: true, dismissedDate: date, snoozeUntil: null });
}

export async function snoozeEveningCheckin(minutes = 15): Promise<void> {
  const until = Date.now() + minutes * 60_000;
  try {
    await AsyncStorage.setItem(SNOOZE_KEY, String(until));
  } catch {
    /* ignore */
  }
  emit({ ...state, loaded: true, snoozeUntil: until });
}

export function isEveningPromptDue(s: EveningCheckinState, now = new Date()): boolean {
  if (!s.loaded) return false;
  const today = localDateKey(now);
  const doneOrDismissed = s.doneDate === today || s.dismissedDate === today ? today : null;
  return shouldPromptEveningCheckin({
    now,
    startHHMM: s.time,
    doneDate: doneOrDismissed,
    snoozeUntil: s.snoozeUntil,
    enabled: s.enabled,
  });
}

export async function syncEveningCheckinNotification(title: string, body: string, requestIfNeeded = false): Promise<void> {
  if (Platform.OS === 'web') return;
  configureNotifications();
  try {
    const existingId = await AsyncStorage.getItem(NOTIF_ID_KEY);
    if (existingId) {
      await cancelScheduledNotificationAsync(existingId).catch(() => undefined);
      await AsyncStorage.removeItem(NOTIF_ID_KEY);
    }
    const current = state.loaded ? state : await loadEveningCheckinState();
    if (!current.enabled) return;

    const perm = await ensureLocalNotificationPermission({ requestIfNeeded });
    if (perm !== 'granted') return;

    await ensureNotificationChannel(title);

    const parsed = parseTime(current.time) ?? { hour: 22, minute: 0 };
    const id = await scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        data: { route: '/evening-checkin' },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DAILY,
        hour: parsed.hour,
        minute: parsed.minute,
        channelId: NOTIFICATION_CHANNEL_ID,
      },
    });
    await AsyncStorage.setItem(NOTIF_ID_KEY, id);
  } catch {
    /* scheduling requires native permissions/build */
  }
}
