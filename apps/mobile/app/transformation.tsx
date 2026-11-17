import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { FirstVisitTip } from '../src/components/Tutorial';
import { Button, Card, Chip, EmptyState, ErrorText, Field, Header, Loading, Row, Screen, Text } from '../src/components/ui';
import { api } from '../src/lib/api';
import { errorMessage } from '../src/lib/errors';

type Category = 'relationships' | 'addictions' | 'health' | 'finance' | 'character';
type Area = { id: string; category: Category; title: string; target_self: string };
const categories: Category[] = ['relationships', 'addictions', 'health', 'finance', 'character'];

export default function TransformationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { create: previewCreate } = useLocalSearchParams<{ create?: string }>();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(process.env.EXPO_PUBLIC_VISUAL_TESTS === '1' && previewCreate === '1');
  const [category, setCategory] = useState<Category>('health');
  const [title, setTitle] = useState('');
  const [current, setCurrent] = useState('');
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const [goalId, setGoalId] = useState<string | null>(null);
  const visual = process.env.EXPO_PUBLIC_VISUAL_TESTS === '1';
  const areas = useQuery({ queryKey: ['transformation'], queryFn: () => visual ? Promise.resolve([{ id: 'preview', category: 'health', title: t('transformation.preview.title'), target_self: t('transformation.preview.target') }] as Area[]) : api<Area[]>('/transformation') });
  const goals = useQuery({ queryKey: ['transformation-goals'], queryFn: () => api<{ id: string; title: string }[]>('/goals?pageSize=50'), enabled: creating });
  const create = useMutation({
    mutationFn: () => api<Area>('/transformation', { method: 'POST', body: { category, title: title.trim(), current_self: current, target_self: target, reason, goal_id: goalId } }),
    onSuccess: (area) => { void qc.invalidateQueries({ queryKey: ['transformation'] }); router.push(`/transformation/${area.id}`); },
  });
  if (areas.isLoading) return <Loading />;
  return <Screen onRefresh={() => areas.refetch().then(() => undefined)} refreshing={areas.isRefetching}>
    <FirstVisitTip screen="transformation" />
    <Header title={t('transformation.title')} subtitle={t('transformation.subtitle')} back />
    {!creating && <Button title={t('transformation.add')} icon="add" onPress={() => setCreating(true)} />}
    {creating && <Card className="gap-3">
      <Text weight="700">{t('transformation.category')}</Text>
      <Row>{categories.map((value) => <Chip key={value} label={t(`transformation.categories.${value}`)} selected={value === category} onPress={() => { setCategory(value); setTitle(''); }} />)}</Row>
      <Text size="sm" muted>{t('transformation.name')}</Text>
      <Row>{[0, 1, 2, 3, 4].map((index) => <Chip key={index} label={t(`transformation.templates.${category}.${index}`)} selected={title === t(`transformation.templates.${category}.${index}`)} onPress={() => setTitle(t(`transformation.templates.${category}.${index}`))} />)}</Row>
      <Field label={t('transformation.name')} value={title} onChangeText={setTitle} />
      <Field label={t('transformation.current')} value={current} onChangeText={setCurrent} multiline />
      <Field label={t('transformation.target')} value={target} onChangeText={setTarget} multiline />
      <Field label={t('transformation.reason')} value={reason} onChangeText={setReason} multiline />
      <Text weight="700">{t('transformation.linkGoal')}</Text>
      <Row><Chip label={t('transformation.none')} selected={!goalId} onPress={() => setGoalId(null)} />{goals.data?.map((goal) => <Chip key={goal.id} label={goal.title} selected={goalId === goal.id} onPress={() => setGoalId(goal.id)} />)}</Row>
      <ErrorText message={create.error ? errorMessage(create.error, t) : null} />
      <Button title={t('transformation.create')} disabled={title.trim().length < 2} loading={create.isPending} onPress={() => create.mutate()} />
    </Card>}
    {!areas.data?.length && !creating && <Card><EmptyState icon="leaf-outline" title={t('transformation.empty')} /></Card>}
    {areas.data?.map((area) => <Card key={area.id} onPress={() => router.push(`/transformation/${area.id}`)}>
      <View className="gap-1"><Text size="sm" muted>{t(`transformation.categories.${area.category}`)}</Text><Text weight="700">{area.title}</Text>{!!area.target_self && <Text size="sm" muted>{area.target_self}</Text>}</View>
    </Card>)}
  </Screen>;
}
