import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient, useQueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack, useRouter, useSegments } from 'expo-router';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import '../global.css';
import React, { useEffect, useState } from 'react';
import { useColorScheme, View } from 'react-native';
import { themeVars } from '../src/theme/vars';
import { EveningCheckinPrompt } from '../src/components/EveningCheckinPrompt';
import { Loading, Text } from '../src/components/ui';
import { useTranslation } from 'react-i18next';
import { loadLanguage, useChosenLanguage } from '../src/i18n';
import { setRevokedHandler } from '../src/lib/api';
import { LockProvider, useLock } from '../src/lib/lock';
import { signOutDevice } from '../src/lib/signOut';
import { SessionProvider, useSession } from '../src/lib/session';
import { loadIntro, useIntroSeen } from '../src/lib/tutorial';

const CACHE_KEY = 'mylifeos-query-cache';
const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: CACHE_KEY, throttleTime: 2000 });

/** Tracks connectivity so queries pause offline and the app shows cached data instead of errors. */
function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => NetInfo.addEventListener((s) => {
    const on = s.isConnected !== false && s.isInternetReachable !== false;
    onlineManager.setOnline(on); setOnline(on);
  }), []);
  return online;
}

function Gate() {
  const { session, loading } = useSession();
  const qc = useQueryClient();
  const online = useOnline();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  // Cached data belongs to one person. Wipe it the moment they sign out so the next user never sees it.
  const hadSession = React.useRef(false);
  useEffect(() => {
    if (session) { hadSession.current = true; return; }
    if (!loading && hadSession.current) { hadSession.current = false; qc.clear(); void AsyncStorage.removeItem(CACHE_KEY); }
  }, [session, loading, qc]);
  const segments = useSegments();
  const router = useRouter();
  const { t } = useTranslation();
  const lock = useLock();
  const chosen = useChosenLanguage();
  const introSeen = useIntroSeen();
  const group = segments[0] as string | undefined;
  const visualTutorial = process.env.EXPO_PUBLIC_VISUAL_TESTS === '1' && ['tutorial','wallet','vault','groups','group','group-create','group-join','transformation','screen-time'].includes(group ?? '');
  useEffect(() => { void loadLanguage(); }, []);
  useEffect(() => { void loadIntro(); }, []);
  // A device that was signed out from another phone is dropped back to the welcome screen.
  useEffect(() => { setRevokedHandler(() => { void signOutDevice(); }); return () => setRevokedHandler(null); }, []);

  useEffect(() => {
    if (visualTutorial) return;
    if (loading || chosen === undefined || introSeen === undefined) return;
    if (chosen === null) { if (group !== 'language') router.replace('/language'); return; }
    if (!session) {
      if (!introSeen) { if (group !== 'tutorial' && group !== 'language') router.replace('/tutorial'); return; }
      if (group !== '(auth)' && group !== 'language') router.replace('/login');
      return;
    }
    if (lock.hasPin && lock.locked) {
      if (group !== 'unlock') router.replace('/unlock');
      return;
    }
    if (group === '(auth)' || group === 'unlock') {
      router.replace('/');
    }
  }, [loading, chosen, introSeen, session, lock.hasPin, lock.locked, group, router, visualTutorial]);

  const waiting = !visualTutorial && (loading || chosen === undefined || introSeen === undefined);
  if (waiting) return <Loading />;
  const promptActive = !visualTutorial && !!session && !(lock.hasPin && lock.locked) && !['evening-checkin', 'onboarding', 'tutorial', 'language', '(auth)', 'unlock'].includes(group ?? '');
  return (
    <View className="flex-1 bg-bg" style={themeVars(scheme)}>
    {!online && <View className="bg-[#14213D] pb-1.5 pt-8"><Text size="xs" color="#E9D9A6" style={{ textAlign: 'center' }}>{t('common.offline')}</Text></View>}
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="new-task" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="new-habit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="new-goal" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="evening-checkin" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
    <EveningCheckinPrompt active={promptActive} />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold });
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000, gcTime: 1000 * 60 * 60 * 24 * 7 } } }));
  if (!fontsLoaded && !fontError) return <Loading />;
  return (
    <PersistQueryClientProvider client={client} persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7 }}>
      <SessionProvider>
        <LockProvider>
          <StatusBar style="auto" />
          <Gate />
        </LockProvider>
      </SessionProvider>
    </PersistQueryClientProvider>
  );
}
