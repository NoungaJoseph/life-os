import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { z } from 'zod';
import { DateField } from '../src/components/DateField';
import { TimeField } from '../src/components/TimeField';
import { Button, Card, Chip, ErrorText, Field, Header, Row, Screen, Text, success } from '../src/components/ui';
import { api } from '../src/lib/api';
import { addDays } from '../src/lib/dates';
import { errorMessage } from '../src/lib/errors';
import { makeEventReminderCopy, syncCalendarEventNotifications } from '../src/lib/eventNotifications';
import { useDashboard, useRefreshAll } from '../src/lib/hooks';
import { CalendarEvent } from '../src/lib/types';
import { useTheme } from '../src/theme/useTheme';

const KINDS = ['event', 'meeting', 'follow_up', 'reminder'] as const;

const makeSchema = (t: TFunction) =>
  z.object({
    title: z.string().trim().min(1, t('newEvent.errors.title')).max(200),
    kind: z.enum(KINDS),
    event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t('newEvent.errors.date')),
    event_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, t('onboarding.errors.time')),
    location: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(1000).optional(),
  });
type Form = z.infer<ReturnType<typeof makeSchema>>;

function toLocalIso(ymd: string, hhmm: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0).toISOString();
}

export default function NewEvent() {
  const { t } = useTranslation();
  const th = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const dash = useDashboard();
  const refresh = useRefreshAll();
  const today = dash.data?.date ?? new Date().toISOString().slice(0, 10);
  const initialDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : addDays(today, 7);
  const [error, setError] = useState<string | null>(null);
  const schema = useMemo(() => makeSchema(t), [t]);
  const { control, handleSubmit, setValue, watch } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      kind: 'event',
      event_date: initialDate,
      event_time: '09:00',
      location: '',
      notes: '',
    },
  });
  const selectedDate = watch('event_date');
  const selectedKind = watch('kind');

  const create = useMutation({
    mutationFn: (f: Form) =>
      api<CalendarEvent>('/calendar-events', {
        method: 'POST',
        body: {
          title: f.title,
          kind: f.kind,
          starts_at: toLocalIso(f.event_date, f.event_time),
          ...(f.location?.trim() ? { location: f.location.trim() } : {}),
          ...(f.notes?.trim() ? { notes: f.notes.trim() } : {}),
        },
      }),
    onSuccess: (createdEv) => {
      const existing = qc.getQueryData<CalendarEvent[]>(['calendar-events', 'upcoming']) ?? [];
      const nextList = [createdEv, ...existing.filter((ev) => ev.id !== createdEv.id)];
      qc.setQueryData(['calendar-events', 'upcoming'], nextList);
      void syncCalendarEventNotifications(nextList, makeEventReminderCopy(t), true);
      success();
      void refresh();
      router.back();
    },
    onError: (e) => setError(errorMessage(e, t)),
  });

  return (
    <Screen bottomPad={30}>
      <Header title={t('newEvent.title')} back />
      <Controller
        control={control}
        name="title"
        render={({ field, fieldState }) => (
          <Field
            label={t('newEvent.what')}
            placeholder={t('newEvent.whatPlaceholder')}
            value={field.value}
            onChangeText={field.onChange}
            error={fieldState.error?.message}
            autoFocus
          />
        )}
      />

      <Text size="sm" weight="600">{t('newEvent.kind')}</Text>
      <Row>
        {KINDS.map((k) => (
          <Chip
            key={k}
            label={t(`newEvent.kinds.${k}`)}
            selected={selectedKind === k}
            onPress={() => setValue('kind', k)}
          />
        ))}
      </Row>

      <Text size="sm" weight="600">{t('newEvent.when')}</Text>
      <Row>
        <Chip label={t('newEvent.tomorrow')} selected={selectedDate === addDays(today, 1)} onPress={() => setValue('event_date', addDays(today, 1))} />
        <Chip label={t('newEvent.inOneWeek')} selected={selectedDate === addDays(today, 7)} onPress={() => setValue('event_date', addDays(today, 7))} />
        <Chip label={t('newEvent.inTwoWeeks')} selected={selectedDate === addDays(today, 14)} onPress={() => setValue('event_date', addDays(today, 14))} />
        <Chip label={t('newEvent.inOneMonth')} selected={selectedDate === addDays(today, 30)} onPress={() => setValue('event_date', addDays(today, 30))} />
      </Row>

      <Controller
        control={control}
        name="event_date"
        render={({ field, fieldState }) => (
          <DateField label={t('newEvent.eventDate')} value={field.value} onChange={field.onChange} error={fieldState.error?.message} required />
        )}
      />

      <Controller
        control={control}
        name="event_time"
        render={({ field, fieldState }) => (
          <TimeField label={t('newEvent.eventTime')} value={field.value} onChange={field.onChange} error={fieldState.error?.message} required />
        )}
      />

      <Card className="flex-row items-start gap-3">
        <Ionicons name="notifications-outline" size={20} color={th.gold} style={{ marginTop: 2 }} />
        <View className="flex-1 gap-1">
          <Text size="sm" weight="600">{t('newEvent.reminderInfoTitle')}</Text>
          <Text size="xs" muted>{t('newEvent.reminderInfoBody')}</Text>
        </View>
      </Card>

      <Controller
        control={control}
        name="location"
        render={({ field }) => (
          <Field
            label={t('newEvent.location')}
            placeholder={t('newEvent.locationPlaceholder')}
            value={field.value ?? ''}
            onChangeText={field.onChange}
          />
        )}
      />

      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <Field label={t('newEvent.notes')} multiline value={field.value ?? ''} onChangeText={field.onChange} />
        )}
      />

      <ErrorText message={error} />
      <Button
        title={t('newEvent.submit')}
        loading={create.isPending}
        onPress={handleSubmit((f) => {
          setError(null);
          create.mutate(f);
        })}
      />
    </Screen>
  );
}
