import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Button, Card, ErrorText, Field, Header, Screen, Text } from '../src/components/ui';
import { formatNumber } from '../src/i18n';
import { api } from '../src/lib/api';
import { errorMessage } from '../src/lib/errors';
import { useTheme } from '../src/theme/useTheme';

type Preview = { name: string; contribution_amount: number; frequency: 'daily' | 'weekly' | 'monthly'; end_date: string };

export default function JoinGroup() {
  const { t } = useTranslation();
  const th = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [accepted, setAccepted] = useState(false);
  const normalized = code.trim().toUpperCase();
  const preview = useQuery({
    queryKey: ['group-preview', normalized],
    queryFn: () => api<Preview>(`/groups/preview/${encodeURIComponent(normalized)}`),
    enabled: normalized.length >= 8,
    retry: false,
  });
  const join = useMutation({
    mutationFn: () => api<{ id: string }>('/groups/join', { method: 'POST', body: { invite_code: normalized, lock_accepted: accepted } }),
    onSuccess: (group) => { void qc.invalidateQueries({ queryKey: ['groups'] }); router.replace(`/group/${group.id}`); },
  });

  return <Screen>
    <Header title={t('groups.join')} back />
    <Card className="gap-3">
      <View className="items-center"><Ionicons name="people-circle-outline" size={72} color={th.primary} /></View>
      <Field label={t('groups.code')} value={code} onChangeText={(value) => { setCode(value); setAccepted(false); }} autoCapitalize="characters" />
      {preview.data && <View className="gap-1">
        <Text size="xl" weight="700">{preview.data.name}</Text>
        <Text>{formatNumber(preview.data.contribution_amount)} FCFA · {t(`groups.${preview.data.frequency}`)}</Text>
        <Text muted>{t('groups.endHint', { date: preview.data.end_date })}</Text>
      </View>}
      {preview.error && <ErrorText message={errorMessage(preview.error, t)} />}
      <Text size="xl" weight="700">{t('groups.lockTitle')}</Text>
      <Text muted>{t('groups.lockBody')}</Text>
      <Pressable onPress={() => setAccepted(!accepted)} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} className="flex-row items-start gap-3">
        <Ionicons name={accepted ? 'checkbox' : 'square-outline'} size={24} color={th.primary} />
        <Text style={{ flex: 1 }}>{t('groups.lockCheck')}</Text>
      </Pressable>
    </Card>
    <ErrorText message={join.error ? errorMessage(join.error, t) : null} />
    <Button title={t('groups.joinAction')} disabled={!accepted || !preview.data || preview.isFetching} loading={join.isPending} onPress={() => join.mutate()} />
  </Screen>;
}
