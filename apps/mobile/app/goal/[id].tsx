import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, View } from 'react-native';
import { GoalRow, PACE_TONE } from '../../src/components/domain';
import { MoneyField } from '../../src/components/MoneyField';
import {
  Button, Card, Celebration, Check, EmptyState, ErrorState, ErrorText, Field, Header, Loading, Pill, ProgressRing, Screen, SectionHeader, Text, success,
} from '../../src/components/ui';
import i18n, { formatNumber } from '../../src/i18n';
import { api, ApiError } from '../../src/lib/api';
import { shortDate } from '../../src/lib/dates';
import { useGoalsOverview, useRefreshAll } from '../../src/lib/hooks';
import { parseMoneyInput } from '../../src/lib/moneyInput';
import { Milestone } from '../../src/lib/types';
import { spacing } from '../../src/theme/tokens';

interface Step { title: string; goal_type: string; rationale?: string }

export default function GoalDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const refresh = useRefreshAll();
  const overview = useGoalsOverview();
  const goal = overview.data?.find((g) => g.id === id);
  const children = overview.data?.filter((g) => g.parent_goal_id === id) ?? [];

  const ms = useQuery({ queryKey: ['goals', id, 'milestones'], queryFn: () => api<Milestone[]>(`/goals/${id}/milestones`), enabled: !!id });
  const [newMs, setNewMs] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [added, setAdded] = useState<Record<number, boolean>>({});
  const [celebrating, setCelebrating] = useState(false);

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(`/goals/${id}`, { method: 'PATCH', body }),
    onSuccess: () => { void refresh(); },
    onError: (e) => setError((e as Error).message),
  });
  const addMs = useMutation({
    mutationFn: (title: string) => api(`/goals/${id}/milestones`, { method: 'POST', body: { title } }),
    onSuccess: () => { setNewMs(''); void ms.refetch(); void refresh(); },
    onError: (e) => setError((e as Error).message),
  });
  const toggleMs = useMutation({
    mutationFn: (m: Milestone) => api(`/goals/${id}/milestones/${m.id}`, { method: 'PATCH', body: { completed: !m.completed_at } }),
    onSuccess: () => { void ms.refetch(); void refresh(); },
  });
  const breakdown = useMutation({
    mutationFn: () => api<{ steps: Step[] }>('/ai/goal-breakdown', {
      method: 'POST',
      body: { title: goal!.title, goal_type: goal!.goal_type, ...(goal!.description ? { description: goal!.description } : {}), ...(goal!.target_date ? { target_date: goal!.target_date } : {}), lang: i18n.language === 'fr' ? 'fr' : 'en' },
    }),
    onSuccess: (r) => { setSteps(r.steps); setAdded({}); setError(null); },
    onError: (e) => setError(e instanceof ApiError && e.code === 'AI_NOT_CONFIGURED' ? t('goalDetail.aiNotConfigured') : (e as Error).message),
  });
  const addStep = useMutation({
    mutationFn: ({ step }: { step: Step; index: number }) => api('/goals', {
      method: 'POST',
      body: { title: step.title, goal_type: step.goal_type, parent_goal_id: id, status: 'active',
        ...(goal!.pillar_id ? { pillar_id: goal!.pillar_id } : {}), ...(goal!.life_area_id ? { life_area_id: goal!.life_area_id } : {}) },
    }),
    onSuccess: (_r, v) => { setAdded((a) => ({ ...a, [v.index]: true })); void refresh(); },
    onError: (e) => setError((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: () => api(`/goals/${id}`, { method: 'DELETE' }),
    onSuccess: () => { void refresh(); router.replace('/goals'); },
    onError: (e) => setError((e as Error).message),
  });

  if (overview.isLoading) return <Loading />;
  if (!goal) return <Screen><Header title={t('goalDetail.goal')} back /><ErrorState message={t('goalDetail.notFound')} onRetry={() => router.replace('/goals')} /></Screen>;

  const pace = { label: t(`domain.pace.${goal.projection.status}`), tone: PACE_TONE[goal.projection.status] };
  const p = goal.projection;
  const canLogProgress = goal.measurement_type !== 'milestones' && goal.child_count === 0 && goal.status !== 'completed';

  const confirmDelete = () => {
    if (Platform.OS === 'web') { if (window.confirm(t('goalDetail.deleteConfirm'))) remove.mutate(); return; }
    Alert.alert(t('goalDetail.delete'), t('goalDetail.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' }, { text: t('goalDetail.delete'), style: 'destructive', onPress: () => remove.mutate() },
    ]);
  };

  return (
    <Screen bottomPad={30}>
      <Header title={goal.title} subtitle={`${t(`domain.goalType.${goal.goal_type}`, { defaultValue: goal.goal_type })}${goal.target_date ? ` · ${t('goalDetail.due', { date: shortDate(goal.target_date) })}` : ''}`} back />

      <Card className="flex-row items-center gap-[16px]">
        <Celebration active={celebrating} />
        <ProgressRing value={goal.progress} size={92} label={`${Math.round(goal.progress * 100)}%`} />
        <View className="flex-1 gap-[6px]">
          <Pill label={pace.label} tone={pace.tone} />
          {p.projected_completion && goal.status !== 'completed' ? (
            <Text size="sm" muted>
              {t('goalDetail.atPace', { date: shortDate(p.projected_completion) })}
              {p.days_late !== null && p.days_late > 0 ? t('goalDetail.daysAfter', { count: p.days_late }) : p.days_late !== null ? t('goalDetail.onOrBefore') : ''}
            </Text>
          ) : <Text size="sm" muted>{goal.status === 'completed' ? t('goalDetail.completedMsg') : t('goalDetail.noForecast')}</Text>}
          {p.days_remaining !== null && goal.status !== 'completed'
            ? <Text size="xs" muted>{p.days_remaining >= 0 ? t('goalDetail.daysLeft', { count: p.days_remaining }) : t('goalDetail.daysPast', { count: -p.days_remaining })}</Text> : null}
        </View>
      </Card>

      {goal.description ? <Text muted>{goal.description}</Text> : null}

      {canLogProgress && (
        <Card>
          <Text weight="600">{t('goalDetail.updateProgress')}</Text>
          <Text size="xs" muted>
            {t('goalDetail.currently', {
              value: goal.measurement_type === 'currency' ? formatNumber(goal.current_value) : goal.current_value,
              rest: `${goal.measurement_type === 'percentage' ? '%' : goal.target_value ? t('goalDetail.ofTarget', { target: goal.measurement_type === 'currency' ? formatNumber(goal.target_value) : goal.target_value }) : ''}${goal.unit ? ` ${goal.unit}` : ''}`,
            })}
          </Text>
          {goal.measurement_type === 'currency' ? (
            <MoneyField allowDecimal label={t('goalDetail.newValue')} value={value} onChangeText={setValue} />
          ) : (
            <Field label={goal.measurement_type === 'percentage' ? t('goalDetail.newPercentage') : t('goalDetail.newValue')} keyboardType="numeric" value={value} onChangeText={setValue} />
          )}
          <Button title={t('goalDetail.saveProgress')} variant="dark" loading={patch.isPending} disabled={value.trim() === '' || Number.isNaN(parseMoneyInput(value))}
            onPress={() => { setError(null); patch.mutate({ current_value: parseMoneyInput(value) }, { onSuccess: () => { setValue(''); success(); } }); }} />
        </Card>
      )}

      <SectionHeader title={t('goalDetail.milestones')} />
      <Card>
        {ms.isLoading ? <Loading /> : (ms.data ?? []).length === 0 ? (
          <Text size="sm" muted>{t('goalDetail.noMilestones')}</Text>
        ) : (ms.data ?? []).map((m) => (
          <View key={m.id} className="flex-row items-center gap-[16px] py-[4px]">
            <Check checked={!!m.completed_at} label={m.title} onPress={() => toggleMs.mutate(m)} />
            <Text style={{ flex: 1, textDecorationLine: m.completed_at ? 'line-through' : 'none' }} muted={!!m.completed_at}>{m.title}</Text>
          </View>
        ))}
        <Field label={t('goalDetail.addMilestoneLabel')} value={newMs} onChangeText={setNewMs} placeholder={t('goalDetail.addMilestonePlaceholder')} />
        <Button title={t('goalDetail.addMilestone')} variant="ghost" icon="add" disabled={!newMs.trim()} loading={addMs.isPending} onPress={() => addMs.mutate(newMs.trim())} />
        {goal.measurement_type !== 'milestones' && (ms.data ?? []).length > 0 ? (
          <Text size="xs" muted>{t('goalDetail.measuredBy', { measure: t(`goalDetail.measures.${goal.measurement_type}`) })}</Text>
        ) : null}
      </Card>

      <SectionHeader title={t('goalDetail.smallerSteps')} />
      {children.length > 0 ? children.map((c) => <GoalRow key={c.id} goal={c} />)
        : <EmptyState icon="git-branch-outline" title={t('goalDetail.noSubGoals')} body={t('goalDetail.noSubGoalsBody')} />}
      <Button title={t('goalDetail.breakDown')} icon="sparkles" variant="dark" loading={breakdown.isPending} onPress={() => { setError(null); breakdown.mutate(); }} />
      {steps?.map((st, i) => (
        <Card key={`${st.title}-${i}`}>
          <Pill label={t(`domain.goalType.${st.goal_type}`, { defaultValue: st.goal_type })} tone="info" />
          <Text weight="600">{st.title}</Text>
          {st.rationale ? <Text size="sm" muted>{st.rationale}</Text> : null}
          <Button title={added[i] ? t('goalDetail.added') : t('goalDetail.addAsSub')} variant="ghost" disabled={!!added[i]} icon={added[i] ? 'checkmark' : 'add'}
            loading={addStep.isPending && addStep.variables?.index === i} onPress={() => addStep.mutate({ step: st, index: i })} />
        </Card>
      ))}

      <ErrorText message={error} />
      {goal.status !== 'completed' ? (
        <Button title={t('goalDetail.markCompleted')} icon="checkmark-circle-outline" loading={patch.isPending}
          onPress={() => { setError(null); patch.mutate({ status: 'completed' }, { onSuccess: () => { success(); setCelebrating(true); setTimeout(() => setCelebrating(false), 1500); } }); }} />
      ) : (
        <Button title={t('goalDetail.reopen')} variant="ghost" onPress={() => patch.mutate({ status: 'active' })} loading={patch.isPending} />
      )}
      <Button title={t('goalDetail.delete')} variant="danger" icon="trash-outline" onPress={confirmDelete} loading={remove.isPending} />
    </Screen>
  );
}
