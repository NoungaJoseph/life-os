import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import i18n from '../i18n';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export type PushResult = { ok: true } | { ok: false; reason: 'web' | 'emulator' | 'expoGo' | 'noProject' | 'blocked' };

/** Ask permission, get an Expo push token, and register it with the API. Needs a real device and a development/production build. */
export async function enablePush(): Promise<PushResult> {
  if (Platform.OS === 'web') return { ok: false, reason: 'web' };
  if (!Device.isDevice) return { ok: false, reason: 'emulator' };
  if (Constants.appOwnership === 'expo') return { ok: false, reason: 'expoGo' };
  const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
  if (!projectId) return { ok: false, reason: 'noProject' };
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name: i18n.t('ui.push.channel') as string, importance: Notifications.AndroidImportance.DEFAULT });
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return { ok: false, reason: 'blocked' };
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await api('/push-tokens', { method: 'PUT', body: { token, platform: Platform.OS } });
  return { ok: true };
}
