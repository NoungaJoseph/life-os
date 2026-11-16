import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { PinPad } from '../src/components/PinPad';
import { ErrorText, Header, Screen, Text, success } from '../src/components/ui';
import { isWeakPin, setLocalPin, verifyLocalPin } from '../src/lib/pin';
import { useSession } from '../src/lib/session';

type Step = 'current' | 'new' | 'confirm';

export default function ChangePin() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const [step, setStep] = useState<Step>('current');
  const [fresh, setFresh] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const bump = () => setReset((n) => n + 1);

  const entered = async (pin: string) => {
    setError(null);
    if (step === 'current') {
      const r = await verifyLocalPin(session!.user.id, pin);
      if (!r.ok) { setError(t('auth.pin.wrong', { n: r.triesLeft })); bump(); return; }
      setStep('new'); bump(); return;
    }
    if (step === 'new') {
      if (isWeakPin(pin)) { setError(t('auth.pin.weak')); bump(); return; }
      setFresh(pin); setStep('confirm'); bump(); return;
    }
    if (pin !== fresh) { setError(t('auth.pin.mismatch')); setStep('new'); bump(); return; }
    try {
      await setLocalPin(session!.user.id, pin);
      success(); router.back();
    } catch { setError(t('common.errors.generic')); setStep('current'); bump(); }
  };

  const title = step === 'current' ? t('auth.pin.currentTitle') : step === 'new' ? t('auth.pin.createTitle') : t('auth.pin.confirmTitle');
  return (
    <Screen>
      <Header title={t('sessions.changePin')} back />
      <View className="items-center gap-2 pt-4"><Text size="lg" serif weight="700">{title}</Text></View>
      <View className="mt-4"><PinPad onComplete={(p) => void entered(p)} resetKey={reset} /></View>
      <View className="min-h-[24px] items-center"><ErrorText message={error} /></View>
    </Screen>
  );
}
