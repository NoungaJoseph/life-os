import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ErrorText, Field, Header, Screen, Text } from '../../src/components/ui';
import { errorMessage } from '../../src/lib/errors';
import { supabase } from '../../src/lib/supabase';

export default function Forgot() {
  const { t } = useTranslation();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(null); try { await fn(); } catch (e) { setError(errorMessage(e, t)); } finally { setBusy(false); } };
  const send = () => run(async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError(t('auth.errors.email')); return; }
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    if (sendError) throw sendError;
    setStep(2);
  }).then(() => undefined);
  const reset = () => run(async () => {
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) { setError(t('auth.errors.passwordWeak')); return; }
    const normalizedEmail = email.trim().toLowerCase();
    const { error: verifyError } = await supabase.auth.verifyOtp({ email: normalizedEmail, token: code.trim(), type: 'recovery' });
    if (verifyError) throw verifyError;
    const { error: updateError } = await supabase.auth.updateUser({ password: pw });
    if (updateError) throw updateError;
    await supabase.auth.signOut();
    setDone(true);
  });

  return (
    <Screen>
      <Header title={t('auth.forgot.title')} subtitle={step === 1 ? t('auth.forgot.subtitle') : t('auth.otp.subtitle', { email })} back />
      {done ? (
        <>
          <Text>{t('auth.forgot.done')}</Text>
          <Button title={t('auth.signIn')} onPress={() => router.replace('/login')} />
        </>
      ) : step === 1 ? (
        <>
          <Field label={t('auth.register.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <ErrorText message={error} />
          <Button title={t('auth.forgot.send')} onPress={() => void send()} loading={busy} />
        </>
      ) : (
        <>
          <Field label={t('auth.otp.code')} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 8))} keyboardType="number-pad" />
          <Field label={t('auth.forgot.newPassword')} hint={t('auth.register.passwordHint')} value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" />
          <ErrorText message={error} />
          <Button title={t('auth.forgot.reset')} onPress={() => void reset()} loading={busy} />
        </>
      )}
    </Screen>
  );
}
