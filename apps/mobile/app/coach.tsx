import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button, Card, Chip, FadeIn, Field, Header, Row, Screen, Text } from '../src/components/ui';
import i18n from '../src/i18n';
import { api, ApiError } from '../src/lib/api';
import { spacing } from '../src/theme/tokens';
import { useTheme } from '../src/theme/useTheme';

interface Msg { role: 'user' | 'coach' | 'error'; text: string }
export default function Coach() {
  const theme = useTheme();
  const { t } = useTranslation();
  const presets = t('coach.presets', { returnObjects: true }) as string[];
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');

  const ask = useMutation({
    mutationFn: (message?: string) => api<{ reply: string }>('/ai/coach', { method: 'POST', body: { ...(message ? { message } : {}), lang: i18n.language === 'fr' ? 'fr' : 'en' } }),
    onSuccess: (r) => setMsgs((m) => [...m, { role: 'coach', text: r.reply }]),
    onError: (e) => setMsgs((m) => [...m, {
      role: 'error',
      text: e instanceof ApiError && e.code === 'AI_NOT_CONFIGURED'
        ? t('coach.notConfigured')
        : (e as Error).message,
    }]),
  });

  const send = (text?: string) => {
    const message = (text ?? input).trim();
    if (ask.isPending) return;
    setMsgs((m) => [...m, { role: 'user', text: message || t('coach.defaultPrompt') }]);
    setInput('');
    ask.mutate(message || undefined);
  };

  return (
    <Screen bottomPad={30}>
      <Header title={t('coach.title')} subtitle={t('coach.subtitle')} back />
      {msgs.length === 0 && (
        <FadeIn>
          <Card className="items-center gap-[8px]">
            <Ionicons name="sparkles" size={28} color={theme.primary} />
            <Text weight="600">{t('coach.help')}</Text>
            <Text size="sm" muted style={{ textAlign: 'center' }}>{t('coach.intro')}</Text>
          </Card>
        </FadeIn>
      )}
      {msgs.map((m, i) => (
        <FadeIn key={i}>
          <View style={{ alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <View style={{
              maxWidth: '90%', borderRadius: 18, padding: spacing.md,
              backgroundColor: m.role === 'user' ? theme.primaryDark : m.role === 'error' ? `${theme.error}18` : theme.surface,
              borderWidth: m.role === 'user' ? 0 : 1, borderColor: m.role === 'error' ? theme.error : theme.border,
            }}>
              <Text color={m.role === 'user' ? '#FFFFFF' : m.role === 'error' ? theme.error : theme.text}>{m.text}</Text>
            </View>
          </View>
        </FadeIn>
      ))}
      {ask.isPending && <Text size="sm" muted>{t('coach.thinking')}</Text>}
      <Row>{presets.map((p) => <Chip key={p} label={p} selected={false} onPress={() => send(p)} />)}</Row>
      <Field label={t('coach.inputLabel')} value={input} onChangeText={setInput} multiline placeholder={t('coach.inputPlaceholder')} maxLength={1000} />
      <Button title={t('coach.send')} icon="send" onPress={() => send()} loading={ask.isPending} />
      <Text size="xs" muted style={{ textAlign: 'center' }}>{t('coach.disclaimer')}</Text>
    </Screen>
  );
}
