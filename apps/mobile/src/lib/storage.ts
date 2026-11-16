import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Secrets (PIN hash, device id) go in the phone's secure keystore. The browser preview has none, so it falls back to local storage. */
const native = Platform.OS !== 'web';
export const secureGet = async (k: string) => { try { return native ? await SecureStore.getItemAsync(k) : await AsyncStorage.getItem(k); } catch { return null; } };
export const secureSet = async (k: string, v: string) => { try { if (native) await SecureStore.setItemAsync(k, v); else await AsyncStorage.setItem(k, v); } catch { /* ignore */ } };
export const secureDel = async (k: string) => { try { if (native) await SecureStore.deleteItemAsync(k); else await AsyncStorage.removeItem(k); } catch { /* ignore */ } };
