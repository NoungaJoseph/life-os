import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, View } from 'react-native';
import { PinPad } from '../src/components/PinPad';
import { ErrorText, FadeIn, Press, Screen, Text, success } from '../src/components/ui';
import { api } from '../src/lib/api';
import { useLock } from '../src/lib/lock';
import { verifyAccountPin } from '../src/lib/pin';
import { useSession } from '../src/lib/session';
import { signOutDevice } from '../src/lib/signOut';
import { Profile } from '../src/lib/types';
import { useTheme } from '../src/theme/useTheme';

export default function Unlock() {
  const { t } = useTranslation();
  const router = useRouter();
  const th = useTheme();
  const { session } = useSession();
  const { unlock, requirePinSetup } = useLock();
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/profile'), enabled: !!session });
  const [error, setError] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  const name = (profile.data as any)?.first_name ?? profile.data?.display_name ?? '';
  const initials = (name || '?').trim().slice(0, 1).toUpperCase();

  const entered = async (pin: string) => {
    if (busy || locked || !session) return;
    setBusy(true);
    try {
      const r = await verifyAccountPin(session.user.id, pin);
      if (r.ok) {
        success();
        unlock();
        router.replace('/');
        return;
      }
      setReset((n) => n + 1);
      if (r.networkError) {
        setError(t('common.errors.network'));
        return;
      }
      if (r.missing) {
        requirePinSetup();
        router.replace('/create-pin');
        return;
      }
      if (r.locked) {
        setLocked(true);
        setError(t('auth.pin.locked'));
        setTimeout(() => void signOutDevice().then(() => router.replace('/login')), 1800);
        return;
      }
      setError(t('auth.pin.wrong', { n: r.triesLeft }));
    } finally {
      setBusy(false);
    }
  };
  const forgot = () => {
    const go = () => void signOutDevice().then(() => router.replace('/login'));
    if (Platform.OS === 'web') { if (window.confirm(t('auth.pin.forgotBody'))) go(); return; }
    Alert.alert(t('auth.pin.forgot'), t('auth.pin.forgotBody'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('auth.pin.signOutAndReset'), style: 'destructive', onPress: go }]);
  };

  return (
    <Screen>
      <View className="items-center gap-2 pt-10">
        <FadeIn><View className="h-20 w-20 items-center justify-center rounded-full bg-surface-alt"><Text size="xl" serif weight="700" color={th.primary}>{initials}</Text></View></FadeIn>
        <Text size="xl" serif weight="700">{t('auth.pin.unlockTitle', { name })}</Text>
        <Text muted size="sm">{t('auth.pin.unlockBody')}</Text>
      </View>
      <View className="mt-6"><PinPad onComplete={(p) => void entered(p)} resetKey={reset} disabled={locked || busy} /></View>
      <View className="min-h-[24px] items-center"><ErrorText message={error} /></View>
      <Press onPress={forgot} className="items-center py-2"><Text weight="600" color="#12A594">{t('auth.pin.forgot')}</Text></Press>
    </Screen>
  );
}
