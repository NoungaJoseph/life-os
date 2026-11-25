import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Secrets (PIN hash, device id) go in the phone's secure keystore. The browser preview has none, so it falls back to local storage. */
const native = Platform.OS !== 'web';

/** Expo SecureStore only allows [A-Za-z0-9._-]; colons or spaces silently fail or throw on Android/iOS. */
export function sanitizeSecureKey(k: string): string {
  const safe = k.replace(/[^a-zA-Z0-9._-]/g, '_');
  return safe || 'key';
}

export const secureGet = async (k: string): Promise<string | null> => {
  const safe = sanitizeSecureKey(k);
  if (!native) {
    try {
      const primary = await AsyncStorage.getItem(k);
      if (primary !== null) return primary;
      return safe !== k ? await AsyncStorage.getItem(safe) : null;
    } catch {
      return null;
    }
  }
  try {
    const val = await SecureStore.getItemAsync(safe);
    if (val !== null) return val;
  } catch { /* fall through to AsyncStorage fallback */ }
  try {
    return await AsyncStorage.getItem(safe);
  } catch {
    return null;
  }
};

export const secureSet = async (k: string, v: string): Promise<void> => {
  const safe = sanitizeSecureKey(k);
  if (!native) {
    await AsyncStorage.setItem(k, v);
    return;
  }
  try {
    await SecureStore.setItemAsync(safe, v);
    await AsyncStorage.removeItem(safe).catch(() => undefined);
    return;
  } catch {
    await AsyncStorage.setItem(safe, v);
  }
};

export const secureDel = async (k: string): Promise<void> => {
  const safe = sanitizeSecureKey(k);
  if (native) {
    try { await SecureStore.deleteItemAsync(safe); } catch { /* ignore */ }
  }
  try { await AsyncStorage.removeItem(safe); } catch { /* ignore */ }
  if (safe !== k) {
    try { await AsyncStorage.removeItem(k); } catch { /* ignore */ }
  }
};
