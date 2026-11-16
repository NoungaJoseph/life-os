import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button, Card, Check, Chip, EmptyState, ErrorState, ErrorText, Field, Header, Loading, Pill, ProgressBar, Row, Screen, SectionHeader, StatTile, Text, success } from '../../src/components/ui';
import { formatNumber } from '../../src/i18n';
import { api } from '../../src/lib/api';
import { spacing } from '../../src/theme/tokens';

type Dash = {
  project: { id: string; name: string; status: string; kind: string; description?: string | null };
  tasks: { total: number; done: number; doing: number; overdue: number; follow_ups: { id: string; title: string }[] };
  metrics: { metric: string; value: number; unit?: string | null; recorded_on: string }[]; revenue: number; costs: number; profit: number;
};
const fmt = formatNumber;

export default function ProjectScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['project', id], queryFn: () => api<Dash>(`/projects/${id}/dashboard`) });
  const tasks = useQuery({ queryKey: ['project-tasks', id], queryFn: () => api<any[]>(`/project-tasks?project_id=${id}&pageSize=200`) });
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('task');
  const [metric, setMetric] = useState('');
  const [value, setValue] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['project', id] }); void qc.invalidateQueries({ queryKey: ['project-tasks', id] }); };

  const addTask = useMutation({
    mutationFn: () => { if (!title.trim()) throw new Error(t('project.writeTask')); return api('/project-tasks', { method: 'POST', body: { project_id: id, title: title.trim(), kind } }); },
    onSuccess: () => { success(); setTitle(''); setErr(null); refresh(); }, onError: (e) => setErr((e as Error).message),
  });
  const toggle = useMutation({ mutationFn: (t: any) => api(`/project-tasks/${t.id}`, { method: 'PATCH', body: { status: t.status === 'done' ? 'todo' : 'done' } }), onSettled: refresh });
  const addMetric = useMutation({
    mutationFn: () => { const n = Number(value); if (!metric.trim() || Number.isNaN(n) || value === '') throw new Error(t('project.metricNeeded')); return api('/project-metrics', { method: 'POST', body: { project_id: id, metric: metric.trim(), value: n } }); },
    onSuccess: () => { success(); setMetric(''); setValue(''); setErr(null); refresh(); }, onError: (e) => setErr((e as Error).message),
  });

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <Screen><ErrorState message={(q.error as Error)?.message ?? t('project.loadError')} onRetry={() => void q.refetch()} /></Screen>;
  const d = q.data;
  const pct = d.tasks.total ? (d.tasks.done / d.tasks.total) * 100 : 0;

  return (
    <Screen bottomPad={40}>
      <Header title={d.project.name} subtitle={t('project.subtitle', { kind: t(`modules.opt.${d.project.kind}`, { defaultValue: d.project.kind }), status: t(`modules.opt.${d.project.status}`, { defaultValue: d.project.status }) })} back />
      {d.project.description ? <Text muted>{d.project.description}</Text> : null}
      <Card className="gap-[6px]">
        <View className="flex-row justify-between"><Text weight="600">{t('project.tasks')}</Text><Text size="sm" muted>{t('project.doneOf', { done: d.tasks.done, total: d.tasks.total })}</Text></View>
        <ProgressBar value={pct} tone="success" />
        <Row>{d.tasks.overdue > 0 && <Pill label={t('project.overdue', { count: d.tasks.overdue })} tone="error" />}{d.tasks.follow_ups.length > 0 && <Pill label={t('project.followUps', { count: d.tasks.follow_ups.length })} tone="warning" />}</Row>
      </Card>
      <Row gap={spacing.md}>
        <View className="flex-1"><StatTile label={t('project.revenue')} value={fmt(d.revenue)} icon="cash-outline" tone="success" /></View>
        <View className="flex-1"><StatTile label={t('project.profit')} value={fmt(d.profit)} sub={t('project.costs', { amount: fmt(d.costs) })} icon="stats-chart-outline" tone={d.profit < 0 ? 'error' : 'accent'} /></View>
      </Row>
      <Text size="xs" muted>{t('project.footer')}</Text>

      <SectionHeader title={t('project.tasksAndFollowUps')} />
      {(tasks.data ?? []).length === 0 ? <EmptyState icon="list-outline" title={t('project.noTasks')} body={t('project.noTasksBody')} /> :
        (tasks.data ?? []).map((task) => (
          <Card key={task.id}><View className="flex-row items-center gap-[16px]">
            <Check checked={task.status === 'done'} label={t('project.toggle', { title: task.title })} onPress={() => toggle.mutate(task)} />
            <View className="flex-1"><Text weight="600">{task.title}</Text><Text size="sm" muted>{t(`modules.opt.${task.kind}`, { defaultValue: String(task.kind).replace('_', ' ') })}{task.due_date ? ` · ${t('project.due', { date: task.due_date })}` : ''}</Text></View>
          </View></Card>
        ))}
      <Card className="gap-[16px]">
        <Field label={t('project.newTask')} value={title} onChangeText={setTitle} placeholder={t('project.newTaskPlaceholder')} />
        <Row>{['task', 'follow_up', 'customer', 'improvement'].map((k) => <Chip key={k} label={k.replace('_', ' ')} selected={kind === k} onPress={() => setKind(k)} />)}</Row>
        <Button title={t('project.addTask')} loading={addTask.isPending} onPress={() => addTask.mutate()} />
      </Card>

      <SectionHeader title={t('project.metrics')} />
      {d.metrics.map((m) => <Card key={m.metric}><View className="flex-row justify-between"><Text weight="600">{m.metric}</Text><Text>{fmt(m.value)} {m.unit ?? ''}</Text></View><Text size="xs" muted>{t('project.asOf', { date: m.recorded_on })}</Text></Card>)}
      <Card className="gap-[16px]">
        <Field label={t('project.metricLabel')} value={metric} onChangeText={setMetric} />
        <Field label={t('project.value')} value={value} onChangeText={setValue} keyboardType="decimal-pad" />
        <Button title={t('project.recordMetric')} variant="ghost" loading={addMetric.isPending} onPress={() => addMetric.mutate()} />
      </Card>
      <ErrorText message={err} />
    </Screen>
  );
}
