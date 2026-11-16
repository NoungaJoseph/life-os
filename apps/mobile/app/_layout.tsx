import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Loading, Text } from '../src/components/ui';
import { useTranslation } from 'react-i18next';
import { loadLanguage, useChosenLanguage } from '../src/i18n';
import { api, setRevokedHandler } from '../src/lib/api';
import { LockProvider, useLock } from '../src/lib/lock';
import { signOutDevice } from '../src/lib/signOut';
import { SessionProvider, useSession } from '../src/lib/session';
import { Profile } from '../src/lib/types';
import { hasSeenTour } from '../src/lib/tutorial';

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
  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: () => api<Profile>('/profile'),
    enabled: !!session,
  });

  const { t } = useTranslation();
  const lock = useLock();
  const chosen = useChosenLanguage();
  const group = segments[0] as string | undefined;
  const visualTutorial = process.env.EXPO_PUBLIC_VISUAL_TESTS === '1' && group === 'tutorial';
  const done = profile.data?.onboarding_completed;
  const [tourSeen, setTourSeen] = useState<boolean | undefined>(undefined);

  useEffect(() => { void loadLanguage(); }, []);
  useEffect(() => {
    let active = true;
    if (!session?.user.id || !profile.data) { setTourSeen(undefined); return; }
    void hasSeenTour(session.user.id, profile.data).then((seen) => { if (active) setTourSeen(seen); });
    return () => { active = false; };
  }, [profile.data, session?.user.id]);
  // A device that was signed out from another phone is dropped back to the welcome screen.
  useEffect(() => { setRevokedHandler(() => { void signOutDevice(); }); return () => setRevokedHandler(null); }, []);

  useEffect(() => {
    if (visualTutorial) return;
    if (loading || chosen === undefined) return;
    if (chosen === null) { if (group !== 'language') router.replace('/language'); return; }
    if (!session) { if (group !== '(auth)' && group !== 'language') router.replace('/welcome'); return; }
    if (lock.hasPin === null) return;
    if (!lock.hasPin) { if (group !== 'create-pin') router.replace('/create-pin'); return; }
    if (lock.locked) { if (group !== 'unlock') router.replace('/unlock'); return; }
    if (!profile.data) return;
    if (!done && group !== 'onboarding') router.replace('/onboarding');
    else if (done && tourSeen === false && group !== 'tutorial') router.replace('/tutorial');
    else if (done && tourSeen && (group === '(auth)' || group === 'unlock' || group === 'create-pin' || group === 'tutorial')) router.replace('/');
  }, [loading, chosen, session, lock.hasPin, lock.locked, profile.data, done, tourSeen, group, router, visualTutorial]);

  const waiting = !visualTutorial && (loading || chosen === undefined || (session && (lock.hasPin === null || (!lock.locked && lock.hasPin && (profile.isLoading || (done === true && tourSeen === undefined))))));
  if (waiting) return <Loading />;
  return (
    <View className="flex-1 bg-bg" style={themeVars(scheme)}>
    {!online && <View className="bg-[#14213D] pb-1.5 pt-8"><Text size="xs" color="#E9D9A6" style={{ textAlign: 'center' }}>{t('common.offline')}</Text></View>}
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="new-task" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="new-habit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="new-goal" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
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
