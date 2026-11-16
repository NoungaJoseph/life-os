import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { secureGet, secureSet } from './storage';

let cached: { id: string; name: string; platform: string } | null = null;

/** A random id created once per install, plus a readable name for the "devices" screen. */
export async function deviceInfo() {
  if (cached) return cached;
  let id = await secureGet('device-id');
  if (!id) { id = Crypto.randomUUID(); await secureSet('device-id', id); }
  const name = Device.deviceName || Device.modelName || (Platform.OS === 'web' ? 'Web browser' : 'Phone');
  cached = { id, name, platform: Platform.OS };
  return cached;
}
