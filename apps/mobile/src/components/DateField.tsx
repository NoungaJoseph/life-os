import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '../i18n';
import { useTheme } from '../theme/useTheme';
import { Text } from './ui';

const iso = (date: Date) => date.toISOString().slice(0, 10);
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) || iso(date) !== value ? null : date;
};

export function DateField({ label, value, onChange, error, required = false }: {
  label: string; value: string; onChange: (value: string) => void; error?: string; required?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const date = validDate(value) ?? new Date();
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  });
  const selected = validDate(value);
  const firstDay = (month.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((firstDay + days) / 7) * 7 }, (_, i) => i - firstDay + 1);
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(currentLocale(), { weekday: 'narrow', timeZone: 'UTC' }));
  const changeMonth = (delta: number) => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + delta, 1)));
  const show = () => {
    const date = selected ?? new Date();
    setMonth(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
    setOpen(true);
  };
  return <View className="gap-1">
    <Text size="sm" weight="600">{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value || t('datePicker.choose')}`} onPress={show}
      className="min-h-[50px] flex-row items-center justify-between border-b border-line py-3">
      <Text color={value ? theme.text : theme.textSecondary}>{selected ? selected.toLocaleDateString(currentLocale(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : t('datePicker.choose')}</Text>
      <Ionicons name="calendar-outline" size={22} color={theme.primary} />
    </Pressable>
    {error ? <Text size="xs" color={theme.error}>{error}</Text> : null}
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="absolute inset-0" onPress={() => setOpen(false)} accessibilityLabel={t('common.close')} />
        <ScrollView className="rounded-t-2xl bg-bg" contentContainerClassName="px-5 pb-10 pt-5" style={{ maxWidth: 520, maxHeight: '90%', width: '100%', alignSelf: 'center' }}>
          <View className="mb-5 flex-row items-center justify-between">
            <Text size="lg" serif>{label}</Text>
            <Pressable onPress={() => setOpen(false)} accessibilityLabel={t('common.close')} hitSlop={12}><Ionicons name="close" size={24} color={theme.text} /></Pressable>
          </View>
          <View className="mb-4 flex-row items-center justify-between">
            <Pressable onPress={() => changeMonth(-1)} accessibilityLabel={t('datePicker.previousMonth')} className="p-2"><Ionicons name="chevron-back" size={23} color={theme.primary} /></Pressable>
            <Text weight="600">{month.toLocaleDateString(currentLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' })}</Text>
            <Pressable onPress={() => changeMonth(1)} accessibilityLabel={t('datePicker.nextMonth')} className="p-2"><Ionicons name="chevron-forward" size={23} color={theme.primary} /></Pressable>
          </View>
          <View className="flex-row">{weekdays.map((day, i) => <View key={i} className="flex-1 items-center py-2"><Text size="xs" muted>{day}</Text></View>)}</View>
          <View className="flex-row flex-wrap">{cells.map((day, i) => {
            const inMonth = day >= 1 && day <= days;
            const date = inMonth ? iso(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day))) : '';
            const active = date === value;
            return <View key={i} style={{ width: '14.2857%' }} className="items-center py-1">
              {inMonth ? <Pressable accessibilityRole="button" accessibilityLabel={date} accessibilityState={{ selected: active }}
                onPress={() => { onChange(date); setOpen(false); }}
                className="h-11 w-11 items-center justify-center rounded-full" style={active ? { backgroundColor: theme.primary } : undefined}>
                <Text weight={active ? '700' : '400'} color={active ? theme.primaryDark : theme.text}>{day}</Text>
              </Pressable> : null}
            </View>;
          })}</View>
          <View className="mt-3 flex-row justify-between">
            {!required ? <Pressable onPress={() => { onChange(''); setOpen(false); }} className="py-3"><Text color={theme.textSecondary}>{t('datePicker.clear')}</Text></Pressable> : <View />}
            <Pressable onPress={() => { onChange(iso(new Date())); setOpen(false); }} className="py-3"><Text weight="600" color={theme.primary}>{t('datePicker.today')}</Text></Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  </View>;
}
