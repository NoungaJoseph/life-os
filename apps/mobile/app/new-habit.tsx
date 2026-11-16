import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, Chip, ErrorText, Field, Header, Row, Screen, Text, success } from '../src/components/ui';
import { api } from '../src/lib/api';
import { errorMessage } from '../src/lib/errors';
import { useRefreshAll } from '../src/lib/hooks';
import { LifeArea } from '../src/lib/types';

const DAYS: [number, string][] = [[1, 'mon'], [2, 'tue'], [3, 'wed'], [4, 'thu'], [5, 'fri'], [6, 'sat'], [0, 'sun']];
const FREQ = ['daily', 'weekdays', 'custom', 'weekly', 'monthly'] as const;

const makeSchema = (t: TFunction) => z.object({
  name: z.string().trim().min(1, t('newHabit.errors.name')).max(120),
  description: z.string().trim().max(1000).optional(),
  frequency: z.enum(['daily', 'weekdays', 'weekly', 'monthly', 'custom']),
  days_of_week: z.array(z.number()).optional(),
  target_per_period: z.number().int().min(1).max(31),
  preferred_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, t('newHabit.errors.time')).optional().or(z.literal('')),
  life_area_id: z.string().uuid().optional(),
});
type Form = z.infer<ReturnType<typeof makeSchema>>;

export default function NewHabit() {
  const { t } = useTranslation();
  const router = useRouter();
  const refresh = useRefreshAll();
  const areas = useQuery({ queryKey: ['areas'], queryFn: () => api<LifeArea[]>('/life-areas') });
  const [error, setError] = useState<string | null>(null);
  const schema = useMemo(() => makeSchema(t), [t]);
  const { control, handleSubmit, setValue, watch } = useForm<Form>({
    resolver: zodResolver(schema), defaultValues: { name: '', description: '', frequency: 'daily', days_of_week: [], target_per_period: 1, preferred_time: '' },
  });
  const freq = watch('frequency');
  const days = watch('days_of_week') ?? [];
  const target = watch('target_per_period');
  const areaId = watch('life_area_id');

  const create = useMutation({
    mutationFn: (f: Form) => api('/habits', { method: 'POST', body: {
      name: f.name, frequency: f.frequency, target_per_period: f.target_per_period,
      ...(f.description ? { description: f.description } : {}),
      ...(f.frequency === 'custom' ? { days_of_week: f.days_of_week } : {}),
      ...(f.preferred_time ? { preferred_time: f.preferred_time } : {}),
      ...(f.life_area_id ? { life_area_id: f.life_area_id } : {}),
    } }),
    onSuccess: () => { success(); void refresh(); router.back(); },
    onError: (e) => setError(errorMessage(e, t)),
  });

  const submit = handleSubmit((f) => {
    if (f.frequency === 'custom' && !(f.days_of_week?.length)) return setError(t('newHabit.errors.pickDay'));
    setError(null);
    create.mutate(f);
  });

  return (
    <Screen bottomPad={30}>
      <Header title={t('newHabit.title')} subtitle={t('newHabit.subtitle')} back />
      <Controller control={control} name="name" render={({ field, fieldState }) => (
        <Field label={t('newHabit.habit')} value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} placeholder={t('newHabit.habitPlaceholder')} autoFocus />
      )} />
      <Text size="sm" weight="600">{t('newHabit.often')}</Text>
      <Row>{FREQ.map((v) => <Chip key={v} label={t(`newHabit.freq.${v}`)} selected={freq === v} onPress={() => setValue('frequency', v)} />)}</Row>
      {freq === 'custom' && (
        <Row>{DAYS.map(([d, l]) => <Chip key={d} label={t(`newHabit.days.${l}`)} selected={days.includes(d)} onPress={() => setValue('days_of_week', days.includes(d) ? days.filter((x) => x !== d) : [...days, d])} />)}</Row>
      )}
      {(freq === 'weekly' || freq === 'monthly') && (
        <>
          <Text size="sm" weight="600">{freq === 'weekly' ? t('newHabit.timesPerWeek') : t('newHabit.timesPerMonth')}</Text>
          <Row>{[1, 2, 3, 4, 5, 6, 7].map((n) => <Chip key={n} label={String(n)} selected={target === n} onPress={() => setValue('target_per_period', n)} />)}</Row>
        </>
      )}
      <Controller control={control} name="preferred_time" render={({ field, fieldState }) => (
        <Field label={t('newHabit.preferredTime')} value={field.value ?? ''} onChangeText={field.onChange} error={fieldState.error?.message} placeholder="07:30" />
      )} />
      {(areas.data ?? []).length > 0 && (
        <>
          <Text size="sm" weight="600">{t('newHabit.area')}</Text>
          <Row>{(areas.data ?? []).map((a) => <Chip key={a.id} label={a.name} selected={areaId === a.id} onPress={() => setValue('life_area_id', areaId === a.id ? undefined : a.id)} />)}</Row>
        </>
      )}
      <Controller control={control} name="description" render={({ field }) => <Field label={t('newHabit.why')} multiline value={field.value ?? ''} onChangeText={field.onChange} />} />
      <ErrorText message={error} />
      <Button title={t('newHabit.create')} loading={create.isPending} onPress={() => void submit()} />
    </Screen>
  );
}
