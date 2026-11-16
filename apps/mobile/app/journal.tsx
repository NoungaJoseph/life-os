import { useMutation, useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorState, ErrorText, Field, Header, Loading, Row, Screen, SectionHeader, Text, success } from '../src/components/ui';
import i18n from '../src/i18n';
import { api, ApiError } from '../src/lib/api';
import { shortDate } from '../src/lib/dates';
import { useDashboard, useRefreshAll } from '../src/lib/hooks';
import { JournalEntry } from '../src/lib/types';
import { spacing } from '../src/theme/tokens';
import { useTheme } from '../src/theme/useTheme';

export default function Journal() {
  useTheme();
  const { t } = useTranslation();
  const moods = t('journal.moods', { returnObjects: true }) as string[];
  const dash = useDashboard();
  const refresh = useRefreshAll();
  const list = useQuery({ queryKey: ['journal'], queryFn: () => api<JournalEntry[]>('/journal?pageSize=30') });
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () => api('/journal', { method: 'POST', body: { content: content.trim(), ...(mood ? { mood } : {}), ...(dash.data?.date ? { entry_date: dash.data.date } : {}) } }),
    onSuccess: () => { setContent(''); setMood(null); setError(null); success(); void refresh(); },
    onError: (e) => setError((e as Error).message),
  });
  const reflect = useMutation({
    mutationFn: (id: string) => api<{ reply: string }>('/ai/reflect', { method: 'POST', body: { journal_id: id, lang: i18n.language === 'fr' ? 'fr' : 'en' } }),
    onSuccess: (r, id) => setReplies((m) => ({ ...m, [id]: r.reply })),
    onError: (e, id) => setReplies((m) => ({ ...m, [id]: e instanceof ApiError && e.code === 'AI_NOT_CONFIGURED' ? t('journal.aiNotConfigured') : (e as Error).message })),
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/journal/${id}`, { method: 'DELETE' }),
    onSuccess: () => { void refresh(); },
  });

  return (
    <Screen bottomPad={30}>
      <Header title={t('journal.title')} subtitle={t('journal.subtitle')} back />
      <Card>
        <Text weight="600">{t('journal.howWas')}</Text>
        <Row>{moods.map((m, i) => <Chip key={m} label={m} selected={mood === i + 1} onPress={() => setMood(mood === i + 1 ? null : i + 1)} />)}</Row>
        <Field label={t('journal.reflection')} multiline value={content} onChangeText={setContent} placeholder={t('journal.placeholder')} maxLength={8000} />
        <ErrorText message={error} />
        <Button title={t('journal.save')} disabled={!content.trim()} loading={save.isPending} onPress={() => save.mutate()} />
      </Card>

      <SectionHeader title={t('journal.past')} />
      {list.isLoading ? <Loading /> : list.error ? <ErrorState message={(list.error as Error).message} onRetry={() => void list.refetch()} />
        : (list.data ?? []).length === 0 ? <EmptyState icon="book-outline" title={t('journal.emptyTitle')} body={t('journal.emptyBody')} />
        : (list.data ?? []).map((e) => (
          <Card key={e.id}>
            <View className="flex-row justify-between">
              <Text size="sm" weight="600">{shortDate(e.entry_date)}</Text>
              {e.mood ? <Text size="sm" muted>{moods[e.mood - 1]}</Text> : null}
            </View>
            <Text>{e.content}</Text>
            {replies[e.id] ? (
              <View className="rounded-[12px] bg-surface-alt p-4"><Text size="sm">{replies[e.id]}</Text></View>
            ) : null}
            <View className="flex-row gap-[8px]">
              <View className="flex-1"><Button title={t('journal.reflect')} icon="sparkles-outline" variant="ghost" loading={reflect.isPending && reflect.variables === e.id} onPress={() => reflect.mutate(e.id)} /></View>
              <View className="flex-1"><Button title={t('journal.delete')} icon="trash-outline" variant="danger" loading={del.isPending && del.variables === e.id} onPress={() => del.mutate(e.id)} /></View>
            </View>
          </Card>
        ))}
    </Screen>
  );
}
