import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button, Card, ErrorState, ErrorText, FadeIn, Field, Header, Loading, Pill, Screen, SectionHeader, Segmented, StatTile, Text, success } from '../src/components/ui';
import { api } from '../src/lib/api';
import { spacing } from '../src/theme/tokens';

type Kind = 'weekly' | 'monthly';
type Current = { period_start: string; period_end: string; stats: Record<string, number>; review: { answers: Record<string, string>; next_priorities: string[] } | null };
const QUESTION_KEYS: Record<Kind, string[]> = {
  weekly: ['wins', 'challenges', 'lessons', 'adjust'],
  monthly: ['wins', 'missed', 'lessons', 'adjust'],
};

export default function Review() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>('weekly');
  const q = useQuery({ queryKey: ['review', kind], queryFn: () => api<Current>(`/reviews/${kind}/current`) });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [prios, setPrios] = useState(['', '', '']);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setAnswers(q.data?.review?.answers ?? {});
    const p = q.data?.review?.next_priorities ?? [];
    setPrios([p[0] ?? '', p[1] ?? '', p[2] ?? '']);
    setSaved(false); setErr(null);
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => api(`/reviews/${kind}/${q.data!.period_start}`, { method: 'PUT', body: { answers, next_priorities: prios.map((p) => p.trim()).filter(Boolean) } }),
    onSuccess: () => { success(); setSaved(true); void qc.invalidateQueries({ queryKey: ['review', kind] }); },
    onError: (e) => setErr((e as Error).message),
  });

  const s = q.data?.stats;
  return (
    <Screen bottomPad={40} onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Header title={t('review.title')} subtitle={t('review.subtitle')} back />
      <Segmented value={kind} onChange={setKind} options={[{ value: 'weekly', label: t('review.week') }, { value: 'monthly', label: t('review.month') }]} />
      {q.isLoading ? <Loading /> : q.error || !q.data ? <ErrorState message={(q.error as Error)?.message ?? t('review.loadError')} onRetry={() => void q.refetch()} /> : (
        <>
          <Text size="sm" muted>{t('review.period', { start: q.data.period_start, end: q.data.period_end })}</Text>
          <SectionHeader title={t('review.numbers')} />
          <View className="flex-row flex-wrap gap-[16px]">
            {[[t('review.tasksDone'), s!.tasks_completed, 'checkmark-done-outline'], [t('review.habitCheckins'), s!.habit_checkins, 'repeat-outline'], [t('review.workouts'), s!.workouts, 'fitness-outline'], [t('review.readingMin'), s!.reading_minutes, 'book-outline']].map(([l, v, i]) => (
              <View key={String(l)} className="w-[47%]"><StatTile label={String(l)} value={String(v)} icon={i as any} /></View>
            ))}
          </View>
          <SectionHeader title={t('review.reflect')} action={q.data.review ? undefined : undefined} />
          {q.data.review && <Pill label={t('review.savedNote')} tone="success" />}
          {QUESTION_KEYS[kind].map((key, i) => (
            <FadeIn key={key} delay={i * 40}><Field label={t(`review.${kind === 'weekly' ? 'weeklyQ' : 'monthlyQ'}.${key}`)} multiline value={answers[key] ?? ''} onChangeText={(v) => { setAnswers((a) => ({ ...a, [key]: v })); setSaved(false); }} /></FadeIn>
          ))}
          <SectionHeader title={t('review.next')} />
          <Card className="gap-[16px]">
            {prios.map((p, i) => <Field key={i} label={t('review.priorityN', { n: i + 1 })} value={p} onChangeText={(v) => setPrios((x) => x.map((y, j) => (j === i ? v : y)))} />)}
          </Card>
          <ErrorText message={err} />
          <Button title={saved ? t('review.saved') : t('review.save')} loading={save.isPending} onPress={() => save.mutate()} />
        </>
      )}
    </Screen>
  );
}
