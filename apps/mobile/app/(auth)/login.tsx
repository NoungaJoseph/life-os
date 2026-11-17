import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, ErrorText, Field, Header, Press, Screen, Text } from '../../src/components/ui';
import { adoptSession, ApiError, AuthSession, publicApi } from '../../src/lib/api';
import { beginOtpFlow } from '../../src/lib/authFlow';
import { errorMessage } from '../../src/lib/errors';
import { hasLocalPin } from '../../src/lib/pin';

export default function Login() {
  const { t } = useTranslation();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const schema = useMemo(() => z.object({ identifier: z.string().trim().min(3, t('auth.errors.invalidCredentials')), password: z.string().min(1, t('common.errors.required')) }), [t]);
  const { control, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { identifier: '', password: '' } });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    const identifier = v.identifier.trim();
    try {
      const session = await publicApi<AuthSession>('/login', { identifier, password: v.password });
      await adoptSession(session);
      router.replace((await hasLocalPin(session.user.id)) ? '/unlock' : '/create-pin');
    }
    catch (e) {
      if (e instanceof ApiError && e.code === 'EMAIL_NOT_CONFIRMED') {
        const email = e.details?.email ?? identifier.toLowerCase();
        beginOtpFlow(email);
        return router.push({ pathname: '/otp', params: { email, resend: '1' } });
      }
      setError(errorMessage(e, t));
    }
  });

  return (
    <Screen>
      <Header title={t('auth.login.title')} subtitle={t('auth.login.subtitle')} />
      <Controller control={control} name="identifier" render={({ field, fieldState }) => (
        <Field label={t('auth.login.identifier')} autoCapitalize="none" autoComplete="username" textContentType="username" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />)} />
      <Controller control={control} name="password" render={({ field, fieldState }) => (
        <Field label={t('auth.login.password')} secureTextEntry={!show} autoCapitalize="none" autoComplete="password" textContentType="password" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message}
          right={<Press onPress={() => setShow((s) => !s)} label={show ? t('auth.login.hide') : t('auth.login.show')}><Text size="sm" weight="600" color="#12A594">{show ? t('auth.login.hide') : t('auth.login.show')}</Text></Press>} />)} />
      <Press onPress={() => router.push('/forgot')} className="items-end"><Text size="sm" weight="600" color="#12A594">{t('auth.login.forgot')}</Text></Press>
      <ErrorText message={error} />
      <Button title={t('auth.login.submit')} onPress={onSubmit} loading={formState.isSubmitting} />
      <Press onPress={() => router.replace('/register')} className="items-center py-1"><Text muted>{t('auth.noAccount')} <Text weight="600">{t('auth.createAccount')}</Text></Text></Press>
    </Screen>
  );
}
