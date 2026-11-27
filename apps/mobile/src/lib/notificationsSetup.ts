import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AndroidImportance,
  AndroidNotificationVisibility,
  SchedulableTriggerInputTypes,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
} from 'expo-notifications';
import { Platform } from 'react-native';

export const NOTIFICATION_CHANNEL_ID = 'default';
const ASKED_KEY = 'mylifeos:notif:asked';

let configured = false;

/** Configure foreground display + sound handling once at boot. */
export function configureNotifications(): void {
  if (Platform.OS === 'web' || configured) return;
  configured = true;
  setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Ensure Android uses a high-importance channel so banners & sound appear reliably. */
export async function ensureNotificationChannel(channelName: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  await setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: channelName,
    importance: AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
  });
}

/** Check or request OS notification permission. When onceOnly=true, only prompts automatically once. */
export async function ensureLocalNotificationPermission(
  opts: { requestIfNeeded?: boolean; onceOnly?: boolean } = {},
): Promise<'granted' | 'denied' | 'web'> {
  if (Platform.OS === 'web') return 'web';
  try {
    let { status } = await getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (!opts.requestIfNeeded) return 'denied';
    if (opts.onceOnly) {
      const asked = await AsyncStorage.getItem(ASKED_KEY).catch(() => null);
      if (asked === '1') return 'denied';
      await AsyncStorage.setItem(ASKED_KEY, '1').catch(() => undefined);
    }
    status = (await requestPermissionsAsync()).status;
    return status === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

/** Schedule an immediate 5-second local test notification so users can verify alerts right away. */
export async function sendTestNotification(
  title: string,
  body: string,
  channelName: string,
): Promise<'scheduled' | 'denied' | 'web'> {
  const perm = await ensureLocalNotificationPermission({ requestIfNeeded: true });
  if (perm !== 'granted') return perm;
  configureNotifications();
  await ensureNotificationChannel(channelName);
  await scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data: { route: '/(tabs)/planner' },
    },
    trigger: {
      type: SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      channelId: NOTIFICATION_CHANNEL_ID,
    },
  });
  return 'scheduled';
}
