import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import { ErrorText, Header, Press, Screen, Text, success } from '../../src/components/ui';
import { adoptSession, AuthSession, publicApi } from '../../src/lib/api';
import { endOtpFlow } from '../../src/lib/authFlow';
import { errorMessage } from '../../src/lib/errors';
import { useLock } from '../../src/lib/lock';
import { useTheme } from '../../src/theme/useTheme';

const RESEND_SECONDS = 30;

export default function Otp() {
  const { t } = useTranslation();
  const th = useTheme();
  const qc = useQueryClient();
  const router = useRouter();
  const { unlock } = useLock();
  const { email, resend } = useLocalSearchParams<{ email: string; resend?: string }>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [wait, setWait] = useState(RESEND_SECONDS);
  const returnToRegister = () => { endOtpFlow(); router.replace('/register'); };

  useEffect(() => {
    if (!email) router.replace('/login');
  }, [email, router]);
  useEffect(() => { if (wait <= 0) return; const id = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(id); }, [wait]);
  useEffect(() => { if (resend && email) void publicApi('/resend-otp', { email }).catch(() => undefined); }, [resend, email]);

  const verify = async (value: string) => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const session = await publicApi<AuthSession>('/verify-otp', { email, token: value });
      await adoptSession(session);
      endOtpFlow();
      unlock();
      void qc.invalidateQueries({ queryKey: ['profile'] });
      success();
      router.replace('/onboarding');
    }
    catch (e) { setError(errorMessage(e, t)); setCode(''); }
    finally { setBusy(false); }
  };
  const onChange = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 6); setCode(d); if (d.length === 6) void verify(d); };
  const resendCode = async () => {
    try {
      await publicApi('/resend-otp', { email });
      setInfo(t('auth.otp.sent')); setWait(RESEND_SECONDS);
    } catch (e) { setError(errorMessage(e, t)); }
  };

  return (
    <Screen>
      <Header title={t('auth.otp.title')} subtitle={t('auth.otp.subtitle', { email })} back onBack={returnToRegister} />
      <View className="my-4 items-center">
        <TextInput value={code} onChangeText={onChange} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} autoFocus
          accessibilityLabel={t('auth.otp.code')} placeholder="••••••" placeholderTextColor={th.border}
          className="w-full rounded-lg border-2 border-line bg-surface py-4 text-center font-bold text-[32px] text-ink" style={{ letterSpacing: 10 }} />
      </View>
      <ErrorText message={error} />
      {info ? <Text size="sm" color={th.success} style={{ textAlign: 'center' }}>{info}</Text> : null}
      <Press onPress={() => void resendCode()} disabled={wait > 0} className="items-center py-2">
        <Text weight="600" color={wait > 0 ? th.textSecondary : th.primary}>{wait > 0 ? t('auth.otp.resendIn', { s: wait }) : t('auth.otp.resend')}</Text>
      </Press>
      <Press onPress={returnToRegister} className="items-center py-1"><Text size="sm" muted>{t('auth.otp.wrongEmail')}</Text></Press>
    </Screen>
  );
}
