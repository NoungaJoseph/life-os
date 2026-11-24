import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { api } from './api';
import { Preferences, Profile } from './types';

export const TIP_SCREENS = ['home', 'goals', 'planner', 'habits', 'finance', 'wallet', 'vault', 'groups', 'transformation', 'screenTime', 'settings'] as const;
export type TipScreen = typeof TIP_SCREENS[number];
const prefix = (userId: string) => `mylifeos:tutorial:${userId}`;
const tourKey = (userId: string) => `${prefix(userId)}:tour`;
const tipKey = (userId: string, screen: TipScreen) => `${prefix(userId)}:tip:${screen}`;
const introKey = 'mylifeos:intro:seen';
let introSeen: boolean | undefined;
const introListeners = new Set<() => void>();
const emitIntro = (seen: boolean) => { introSeen = seen; introListeners.forEach((listener) => listener()); };
export async function loadIntro() {
  try { emitIntro((await AsyncStorage.getItem(introKey)) === '1'); }
  catch { emitIntro(false); }
}
export async function finishIntro() {
  try { await AsyncStorage.setItem(introKey, '1'); } catch { /* allow the flow to continue */ }
  emitIntro(true);
}
export const useIntroSeen = () => useSyncExternalStore((listener) => {
  introListeners.add(listener);
  return () => { introListeners.delete(listener); };
}, () => introSeen, () => introSeen);

export async function hasSeenTour(userId: string, profile?: Profile | null) {
  if (profile?.preferences?.tutorial?.tour_seen) return true;
  return (await AsyncStorage.getItem(tourKey(userId))) === '1';
}
const mergedPreferences = (profile: Profile, patch: Partial<NonNullable<Preferences['tutorial']>>): Preferences => ({ ...profile.preferences, tutorial: { ...profile.preferences?.tutorial, ...patch } });
export async function finishTour(userId: string, profile: Profile, qc: QueryClient) {
  const updated = await api<Profile>('/profile', { method: 'PATCH', body: { preferences: mergedPreferences(profile, { tour_seen: true }) } });
  await AsyncStorage.setItem(tourKey(userId), '1');
  qc.setQueryData(['profile'], updated);
}
export async function hasSeenTip(userId: string, profile: Profile | undefined, screen: TipScreen) {
  if (profile?.preferences?.tutorial?.seen?.[screen]) return true;
  return (await AsyncStorage.getItem(tipKey(userId, screen))) === '1';
}
export async function finishTip(userId: string, profile: Profile, screen: TipScreen, qc: QueryClient) {
  const seen = { ...profile.preferences?.tutorial?.seen, [screen]: true };
  const updated = await api<Profile>('/profile', { method: 'PATCH', body: { preferences: mergedPreferences(profile, { seen }) } });
  await AsyncStorage.setItem(tipKey(userId, screen), '1');
  qc.setQueryData(['profile'], updated);
}
export async function resetTutorial(userId: string, profile: Profile, qc: QueryClient) {
  const updated = await api<Profile>('/profile', { method: 'PATCH', body: { preferences: { ...profile.preferences, tutorial: { tour_seen: false, seen: {} } } } });
  await Promise.all([AsyncStorage.removeItem(tourKey(userId)), ...TIP_SCREENS.map((screen) => AsyncStorage.removeItem(tipKey(userId, screen)))]);
  qc.setQueryData(['profile'], updated);
}
