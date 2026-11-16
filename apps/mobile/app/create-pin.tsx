import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PinPad } from '../src/components/PinPad';
import { ErrorText, FadeIn, Screen, Text, success } from '../src/components/ui';
import { useLock } from '../src/lib/lock';
import { isWeakPin, setLocalPin } from '../src/lib/pin';
import { useSession } from '../src/lib/session';
import { useTheme } from '../src/theme/useTheme';

/** Two steps: choose, then confirm. The PIN is stored securely on this device. */
export default function CreatePin() {
  const { t } = useTranslation();
  const router = useRouter();
  const th = useTheme();
  const { session } = useSession();
  const { pinCreated } = useLock();
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);

  const entered = async (pin: string) => {
    setError(null);
    if (!first) {
      if (isWeakPin(pin)) { setError(t('auth.pin.weak')); setReset((n) => n + 1); return; }
      setFirst(pin); setReset((n) => n + 1); return;
    }
    if (pin !== first) { setError(t('auth.pin.mismatch')); setFirst(null); setReset((n) => n + 1); return; }
    setBusy(true);
    try {
      await setLocalPin(session!.user.id, pin);
      success(); pinCreated(); router.replace('/');
    } catch { setError(t('common.errors.generic')); setFirst(null); setReset((n) => n + 1); }
    finally { setBusy(false); }
  };

  return (
    <Screen scroll>
      <View className="items-center gap-2 pt-10">
        <FadeIn><View className="h-16 w-16 items-center justify-center rounded-full bg-surface-alt"><Ionicons name="keypad" size={30} color={th.primary} /></View></FadeIn>
        <Text size="xl" serif weight="700" style={{ textAlign: 'center' }}>{first ? t('auth.pin.confirmTitle') : t('auth.pin.createTitle')}</Text>
        <Text muted size="sm" style={{ textAlign: 'center' }}>{first ? t('auth.pin.confirmBody') : t('auth.pin.createBody')}</Text>
      </View>
      <View className="mt-6"><PinPad onComplete={(p) => void entered(p)} resetKey={reset} disabled={busy} /></View>
      <View className="min-h-[24px] items-center"><ErrorText message={error} /></View>
    </Screen>
  );
}
