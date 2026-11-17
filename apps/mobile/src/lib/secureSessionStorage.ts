import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHUNK_SIZE = 1800;
const manifestKey = (key: string) => `${key}.chunks`;
const chunkKey = (key: string, index: number) => `${key}.chunk.${index}`;

async function nativeChunkCount(key: string) {
  const raw = await SecureStore.getItemAsync(manifestKey(key));
  const count = Number(raw);
  return Number.isInteger(count) && count >= 0 ? count : 0;
}

/** Supabase-compatible storage that keeps native sessions in encrypted chunks with AsyncStorage fallback. */
export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    try {
      const count = await nativeChunkCount(key);
      if (count > 0) {
        const parts = await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))));
        if (!parts.some((part) => part === null)) return parts.join('');
      }
    } catch { /* fall back to AsyncStorage */ }
    try { return await AsyncStorage.getItem(key); } catch { return null; }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') { globalThis.localStorage?.setItem(key, value); return; }
    try { await AsyncStorage.setItem(key, value); } catch { /* ignore */ }
    try {
      const previous = await nativeChunkCount(key);
      const parts = Array.from({ length: Math.ceil(value.length / CHUNK_SIZE) }, (_, i) => value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
      await Promise.all(parts.map((part, i) => SecureStore.setItemAsync(chunkKey(key, i), part)));
      await SecureStore.setItemAsync(manifestKey(key), String(parts.length));
      await Promise.all(Array.from({ length: Math.max(0, previous - parts.length) }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, parts.length + i))));
    } catch { /* AsyncStorage already saved the session */ }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') { globalThis.localStorage?.removeItem(key); return; }
    try { await AsyncStorage.removeItem(key); } catch { /* ignore */ }
    try {
      const count = await nativeChunkCount(key);
      await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i))));
      await SecureStore.deleteItemAsync(manifestKey(key));
    } catch { /* ignore */ }
  },
};
