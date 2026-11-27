import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DateField } from '../src/components/DateField';
import { MoneyField } from '../src/components/MoneyField';
import type { TFunction } from 'i18next';
import { z } from 'zod';
import { Button, Chip, ErrorText, Field, Header, Row, Screen, Text, success } from '../src/components/ui';
import { api } from '../src/lib/api';
import { errorMessage } from '../src/lib/errors';
import { useGoalsOverview, useRefreshAll } from '../src/lib/hooks';
import { parseMoneyInput } from '../src/lib/moneyInput';
import { LifeArea, Pillar } from '../src/lib/types';

const TYPES = ['long_term', 'annual', 'quarterly', 'monthly', 'weekly', 'daily'] as const;
const MEASURES = ['percentage', 'numeric', 'currency', 'milestones'] as const;

const makeSchema = (t: TFunction) => z.object({
  title: z.string().trim().min(1, t('newGoal.errors.title')).max(200),
  description: z.string().trim().max(4000).optional(),
  goal_type: z.enum(TYPES),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t('newGoal.errors.date')).optional().or(z.literal('')),
  measurement_type: z.enum(['percentage', 'numeric', 'currency', 'milestones']),
  target_value: z.string().optional(),
  parent_goal_id: z.string().uuid().optional(),
  pillar_id: z.string().uuid().optional(),
  life_area_id: z.string().uuid().optional(),
});
type Form = z.infer<ReturnType<typeof makeSchema>>;

export default function NewGoal() {
  const { t } = useTranslation();
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const refresh = useRefreshAll();
  const goals = useGoalsOverview();
  const pillars = useQuery({ queryKey: ['pillars'], queryFn: () => api<Pillar[]>('/pillars') });
  const areas = useQuery({ queryKey: ['areas'], queryFn: () => api<LifeArea[]>('/life-areas') });
  const [error, setError] = useState<string | null>(null);
  const schema = useMemo(() => makeSchema(t), [t]);
  const { control, handleSubmit, setValue, watch } = useForm<Form>({
    resolver: zodResolver(schema), defaultValues: { title: '', description: '', goal_type: 'monthly', target_date: '', measurement_type: 'percentage', target_value: '' },
  });
  const type = watch('goal_type');
  const measure = watch('measurement_type');
  const parent = watch('parent_goal_id');
  const pillar = watch('pillar_id');
  const area = watch('life_area_id');

  const create = useMutation({
    mutationFn: (f: Form) => {
      const needsTarget = f.measurement_type === 'numeric' || f.measurement_type === 'currency';
      const parsedTarget = needsTarget ? parseMoneyInput(f.target_value ?? '') : NaN;
      return api<{ id: string }>('/goals', {
        method: 'POST',
        body: {
          title: f.title,
          goal_type: f.goal_type,
          status: 'active',
          measurement_type: f.measurement_type,
          ...(f.description ? { description: f.description } : {}),
          ...(f.target_date ? { target_date: f.target_date } : {}),
          ...(needsTarget && parsedTarget > 0 ? { target_value: parsedTarget } : {}),
          ...(f.parent_goal_id ? { parent_goal_id: f.parent_goal_id } : {}),
          ...(f.pillar_id ? { pillar_id: f.pillar_id } : {}),
          ...(f.life_area_id ? { life_area_id: f.life_area_id } : {}),
        },
      });
    },
    onSuccess: (g) => {
      success();
      void refresh();
      if (from === 'vault') router.back();
      else router.replace({ pathname: '/goal/[id]', params: { id: g.id } });
    },
    onError: (e) => setError(errorMessage(e, t)),
  });

  const submit = handleSubmit((f) => {
    if ((f.measurement_type === 'numeric' || f.measurement_type === 'currency') && !(parseMoneyInput(f.target_value ?? '') > 0)) return setError(t('newGoal.errors.target'));
    setError(null);
    create.mutate(f);
  });

  const parents = (goals.data ?? []).filter((g) => g.status === 'active' && TYPES.indexOf(g.goal_type as (typeof TYPES)[number]) < TYPES.indexOf(type));

  return (
    <Screen bottomPad={30}>
      <Header title={t('newGoal.title')} subtitle={t('newGoal.subtitle')} back />
      <Controller control={control} name="title" render={({ field, fieldState }) => (
        <Field label={t('newGoal.goal')} value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} placeholder={t('newGoal.goalPlaceholder')} autoFocus />
      )} />
      <Text size="sm" weight="600">{t('newGoal.level')}</Text>
      <Row>{TYPES.map((v) => <Chip key={v} label={t(`newGoal.types.${v}`)} selected={type === v} onPress={() => { setValue('goal_type', v); setValue('parent_goal_id', undefined); }} />)}</Row>
      <Text size="sm" weight="600">{t('newGoal.measure')}</Text>
      <Row>{MEASURES.map((v) => <Chip key={v} label={t(`newGoal.measures.${v}`)} selected={measure === v} onPress={() => setValue('measurement_type', v)} />)}</Row>
      {(measure === 'numeric' || measure === 'currency') && (
        <Controller control={control} name="target_value" render={({ field }) => (
          measure === 'currency' ? (
            <MoneyField allowDecimal label={t('newGoal.targetAmount')} value={field.value ?? ''} onChangeText={field.onChange} />
          ) : (
            <Field label={t('newGoal.targetNumber')} keyboardType="numeric" value={field.value ?? ''} onChangeText={field.onChange} />
          )
        )} />
      )}
      <Controller control={control} name="target_date" render={({ field, fieldState }) => (
        <DateField label={t('newGoal.targetDate')} value={field.value ?? ''} onChange={field.onChange} error={fieldState.error?.message} />
      )} />
      {parents.length > 0 && (
        <>
          <Text size="sm" weight="600">{t('newGoal.parent')}</Text>
          <Row>{parents.slice(0, 12).map((g) => <Chip key={g.id} label={g.title.length > 28 ? `${g.title.slice(0, 27)}…` : g.title} selected={parent === g.id} onPress={() => setValue('parent_goal_id', parent === g.id ? undefined : g.id)} />)}</Row>
        </>
      )}
      {(pillars.data ?? []).length > 0 && (
        <>
          <Text size="sm" weight="600">{t('newGoal.pillar')}</Text>
          <Row>{(pillars.data ?? []).map((p) => <Chip key={p.id} label={p.name} selected={pillar === p.id} onPress={() => setValue('pillar_id', pillar === p.id ? undefined : p.id)} />)}</Row>
        </>
      )}
      {(areas.data ?? []).length > 0 && (
        <>
          <Text size="sm" weight="600">{t('newGoal.area')}</Text>
          <Row>{(areas.data ?? []).map((a) => <Chip key={a.id} label={a.name} selected={area === a.id} onPress={() => setValue('life_area_id', area === a.id ? undefined : a.id)} />)}</Row>
        </>
      )}
      <Controller control={control} name="description" render={({ field }) => <Field label={t('newGoal.why')} multiline value={field.value ?? ''} onChangeText={field.onChange} />} />
      <ErrorText message={error} />
      <Button title={t('newGoal.create')} loading={create.isPending} onPress={() => void submit()} />
    </Screen>
  );
}
