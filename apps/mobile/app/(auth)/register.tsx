import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { z } from 'zod';
import { Button, ErrorText, Field, Header, Press, Screen, Text } from '../../src/components/ui';
import { adoptSession, AuthSession, publicApi } from '../../src/lib/api';
import { beginOtpFlow } from '../../src/lib/authFlow';
import { errorMessage } from '../../src/lib/errors';
import { useLock } from '../../src/lib/lock';
import { useTheme } from '../../src/theme/useTheme';

export default function Register() {
  const { t } = useTranslation();
  const th = useTheme();
  const qc = useQueryClient();
  const router = useRouter();
  const { unlock } = useLock();
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  const schema = useMemo(() => z.object({
    first_name: z.string().trim().min(1, t('auth.errors.name')).max(60),
    last_name: z.string().trim().min(1, t('auth.errors.name')).max(60),
    email: z.string().trim().email(t('auth.errors.email')),
    phone: z.string().trim().refine((v) => v.replace(/\D/g, '').length >= 8, t('auth.errors.phone')),
    password: z.string().min(8, t('auth.errors.passwordShort')).regex(/[A-Za-z]/, t('auth.errors.passwordWeak')).regex(/\d/, t('auth.errors.passwordWeak')),
    repeat: z.string(),
  }).refine((d) => d.password === d.repeat, { path: ['repeat'], message: t('auth.errors.passwordMatch') }), [t]);
  type Form = z.infer<typeof schema>;

  const { control, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { first_name: '', last_name: '', email: '', phone: '', password: '', repeat: '' } });

  const onSubmit = handleSubmit(async ({ repeat: _r, ...body }) => {
    setError(null);
    try {
      const email = body.email.trim().toLowerCase();
      const res = await publicApi<{ next: string; email: string; session?: AuthSession }>('/register', {
        first_name: body.first_name.trim(),
        last_name: body.last_name.trim(),
        email,
        phone: body.phone.trim(),
        password: body.password,
      });
      if (res.session) {
        await adoptSession(res.session);
        unlock();
        void qc.invalidateQueries({ queryKey: ['profile'] });
        router.replace('/onboarding');
        return;
      }
      beginOtpFlow(res.email || email);
      router.push({ pathname: '/otp', params: { email: res.email || email } });
    } catch (e) { setError(errorMessage(e, t)); }
  });

  const toggle = (
    <Press onPress={() => setShow((s) => !s)} label={show ? t('auth.login.hide') : t('auth.login.show')}>
      <Text size="sm" weight="600" color={th.primary}>{show ? t('auth.login.hide') : t('auth.login.show')}</Text>
    </Press>
  );

  return (
    <Screen bottomPad={30}>
      <View className="flex-row items-center justify-between">
        <Text size="xs" weight="700" color={th.gold} style={{ letterSpacing: 1.6 }}>{t('common.appName')}</Text>
        <Press
          onPress={() => router.push({ pathname: '/language', params: { from: 'auth' } })}
          label={t('language.settingsTitle')}
          className="flex-row items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5"
        >
          <Ionicons name="language-outline" size={14} color={th.primary} />
          <Text size="xs" weight="600" color={th.primary}>{t('language.settingsTitle')}</Text>
        </Press>
      </View>
      <Header title={t('auth.register.title')} subtitle={t('auth.register.subtitle')} />
      <View className="flex-row gap-3">
        <View className="flex-1"><Controller control={control} name="first_name" render={({ field, fieldState }) => (
          <Field label={t('auth.register.firstName')} value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} autoComplete="given-name" textContentType="givenName" />)} /></View>
        <View className="flex-1"><Controller control={control} name="last_name" render={({ field, fieldState }) => (
          <Field label={t('auth.register.lastName')} value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} autoComplete="family-name" textContentType="familyName" />)} /></View>
      </View>
      <Controller control={control} name="email" render={({ field, fieldState }) => (
        <Field label={t('auth.register.email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />)} />
      <Controller control={control} name="phone" render={({ field, fieldState }) => (
        <Field label={t('auth.register.phone')} hint={t('auth.register.phoneHint')} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />)} />
      <Controller control={control} name="password" render={({ field, fieldState }) => (
        <Field label={t('auth.register.password')} hint={t('auth.register.passwordHint')} secureTextEntry={!show} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" right={toggle} value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />)} />
      <Controller control={control} name="repeat" render={({ field, fieldState }) => (
        <Field label={t('auth.register.repeatPassword')} secureTextEntry={!show} autoCapitalize="none" autoComplete="new-password" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />)} />
      <ErrorText message={error} />
      <Button title={t('auth.register.submit')} onPress={onSubmit} loading={formState.isSubmitting} />
      <Text size="xs" muted style={{ textAlign: 'center' }}>{t('auth.register.terms')}</Text>
      <Press onPress={() => router.replace('/login')} className="items-center py-1"><Text muted>{t('auth.haveAccount')} <Text weight="600" color={th.primary}>{t('auth.signIn')}</Text></Text></Press>
    </Screen>
  );
}
