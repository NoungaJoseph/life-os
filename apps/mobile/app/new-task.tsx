import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, Chip, ErrorText, Field, Header, Row, Screen, Text, success } from '../src/components/ui';
import { api } from '../src/lib/api';
import { errorMessage } from '../src/lib/errors';
import { addDays } from '../src/lib/dates';
import { DateField } from '../src/components/DateField';
import { useDashboard, useGoalsOverview, useRefreshAll } from '../src/lib/hooks';

const makeSchema = (t: TFunction) => z.object({
  title: z.string().trim().min(1, t('newTask.errors.title')).max(200),
  notes: z.string().trim().max(4000).optional(),
  priority: z.enum(['low', 'medium', 'high']),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t('newTask.errors.date')).optional().or(z.literal('')),
  goal_id: z.string().uuid().optional(),
});
type Form = z.infer<ReturnType<typeof makeSchema>>;

export default function NewTask() {
  const { t } = useTranslation();
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const dash = useDashboard();
  const goals = useGoalsOverview();
  const refresh = useRefreshAll();
  const today = dash.data?.date ?? new Date().toISOString().slice(0, 10);
  const [error, setError] = useState<string | null>(null);
  const schema = useMemo(() => makeSchema(t), [t]);
  const { control, handleSubmit, setValue, watch } = useForm<Form>({
    resolver: zodResolver(schema), defaultValues: { title: '', notes: '', priority: 'medium', due_date: date ?? today },
  });
  const due = watch('due_date');
  const prio = watch('priority');
  const goalId = watch('goal_id');

  const create = useMutation({
    mutationFn: (f: Form) => api('/tasks', { method: 'POST', body: {
      title: f.title, priority: f.priority, ...(f.notes ? { notes: f.notes } : {}), ...(f.due_date ? { due_date: f.due_date } : {}), ...(f.goal_id ? { goal_id: f.goal_id } : {}),
    } }),
    onSuccess: () => { success(); void refresh(); router.back(); },
    onError: (e) => setError(errorMessage(e, t)),
  });
  const activeGoals = (goals.data ?? []).filter((g) => g.status === 'active');

  return (
    <Screen bottomPad={30}>
      <Header title={t('newTask.title')} back />
      <Controller control={control} name="title" render={({ field, fieldState }) => (
        <Field label={t('newTask.what')} value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} autoFocus />
      )} />
      <Text size="sm" weight="600">{t('newTask.when')}</Text>
      <Row>
        <Chip label={t('newTask.today')} selected={due === today} onPress={() => setValue('due_date', today)} />
        <Chip label={t('newTask.tomorrow')} selected={due === addDays(today, 1)} onPress={() => setValue('due_date', addDays(today, 1))} />
        <Chip label={t('newTask.nextWeek')} selected={due === addDays(today, 7)} onPress={() => setValue('due_date', addDays(today, 7))} />
        <Chip label={t('newTask.noDate')} selected={!due} onPress={() => setValue('due_date', '')} />
      </Row>
      <Controller control={control} name="due_date" render={({ field, fieldState }) => (
        <DateField label={t('newTask.orDate')} value={field.value ?? ''} onChange={field.onChange} error={fieldState.error?.message} />
      )} />
      <Text size="sm" weight="600">{t('newTask.priority')}</Text>
      <Row>{(['low', 'medium', 'high'] as const).map((p) => <Chip key={p} label={t(`newTask.priorities.${p}`)} selected={prio === p} onPress={() => setValue('priority', p)} />)}</Row>
      {activeGoals.length > 0 && (
        <>
          <Text size="sm" weight="600">{t('newTask.goal')}</Text>
          <Row>{activeGoals.slice(0, 12).map((g) => <Chip key={g.id} label={g.title.length > 28 ? `${g.title.slice(0, 27)}…` : g.title} selected={goalId === g.id} onPress={() => setValue('goal_id', goalId === g.id ? undefined : g.id)} />)}</Row>
        </>
      )}
      <Controller control={control} name="notes" render={({ field }) => <Field label={t('newTask.notes')} multiline value={field.value ?? ''} onChangeText={field.onChange} />} />
      <ErrorText message={error} />
      <Button title={t('newTask.add')} loading={create.isPending} onPress={handleSubmit((f) => { setError(null); create.mutate(f); })} />
    </Screen>
  );
}
