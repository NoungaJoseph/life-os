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

/** Supabase-compatible storage that keeps native sessions in encrypted chunks. */
export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    const count = await nativeChunkCount(key);
    if (!count) return null;
    const parts = await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))));
    return parts.some((part) => part === null) ? null : parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') { globalThis.localStorage?.setItem(key, value); return; }
    const previous = await nativeChunkCount(key);
    const parts = Array.from({ length: Math.ceil(value.length / CHUNK_SIZE) }, (_, i) => value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    await Promise.all(parts.map((part, i) => SecureStore.setItemAsync(chunkKey(key, i), part)));
    await SecureStore.setItemAsync(manifestKey(key), String(parts.length));
    await Promise.all(Array.from({ length: Math.max(0, previous - parts.length) }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, parts.length + i))));
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') { globalThis.localStorage?.removeItem(key); return; }
    const count = await nativeChunkCount(key);
    await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i))));
    await SecureStore.deleteItemAsync(manifestKey(key));
  },
};
