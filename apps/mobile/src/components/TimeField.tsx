import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { formatTime, parseTime } from '../lib/timeInput';
import { useTheme } from '../theme/useTheme';
import { Button, Chip, Text, tap } from './ui';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const QUICK_MINUTES = [0, 15, 30, 45];
const ROW_HEIGHT = 42;

export function TimeField({
  label,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const parsed = parseTime(value);
  const [hour, setHour] = useState(parsed?.hour ?? 9);
  const [minute, setMinute] = useState(parsed?.minute ?? 0);
  const hourScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const minScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const openPicker = () => {
    if (disabled) return;
    tap();
    const current = parseTime(value) ?? { hour: 9, minute: 0 };
    setHour(current.hour);
    setMinute(current.minute);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      hourScrollRef.current?.scrollTo({ y: Math.max(0, (hour - 2) * ROW_HEIGHT), animated: false });
      minScrollRef.current?.scrollTo({ y: Math.max(0, (minute - 2) * ROW_HEIGHT), animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, [open, hour, minute]);

  return (
    <View className="gap-1">
      <Text size="sm" weight="600">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${parsed ? formatTime(parsed.hour, parsed.minute) : t('timePicker.choose')}`}
        disabled={disabled}
        onPress={openPicker}
        className="min-h-[50px] flex-row items-center justify-between border-b border-line py-3"
        style={disabled ? { opacity: 0.45 } : undefined}
      >
        <Text color={parsed ? theme.text : theme.textSecondary}>
          {parsed ? formatTime(parsed.hour, parsed.minute) : t('timePicker.choose')}
        </Text>
        <Ionicons name="time-outline" size={22} color={theme.primary} />
      </Pressable>
      {error ? <Text size="xs" color={theme.error}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <Pressable className="absolute inset-0" onPress={() => setOpen(false)} accessibilityLabel={t('common.close')} />
          <View
            className="rounded-t-2xl bg-bg px-5 pb-8 pt-5"
            style={{ maxWidth: 520, maxHeight: '90%', width: '100%', alignSelf: 'center' }}
          >
            <View className="mb-4 flex-row items-center justify-between">
              <Text size="lg" serif>{label}</Text>
              <Pressable onPress={() => setOpen(false)} accessibilityLabel={t('common.close')} hitSlop={12}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>

            <View className="mb-4 items-center rounded-lg bg-surface py-3">
              <Text size="xxl" serif color={theme.primary}>
                {`${String(hour).padStart(2, '0')} : ${String(minute).padStart(2, '0')}`}
              </Text>
            </View>

            <View className="mb-4 flex-row flex-wrap justify-center gap-2">
              {QUICK_MINUTES.map((m) => (
                <Chip
                  key={m}
                  label={`:${String(m).padStart(2, '0')}`}
                  selected={minute === m}
                  onPress={() => setMinute(m)}
                />
              ))}
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1 gap-2">
                <Text size="xs" weight="600" muted style={{ textAlign: 'center' }}>
                  {t('timePicker.hour')}
                </Text>
                <ScrollView
                  ref={hourScrollRef}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  style={{ height: 220, borderRadius: 12, backgroundColor: theme.surface }}
                >
                  {HOURS.map((h) => {
                    const active = h === hour;
                    return (
                      <Pressable
                        key={h}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => { tap(); setHour(h); }}
                        style={{
                          height: ROW_HEIGHT,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: active ? theme.primary : 'transparent',
                        }}
                      >
                        <Text weight={active ? '700' : '400'} color={active ? '#06231F' : theme.text}>
                          {String(h).padStart(2, '0')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View className="flex-1 gap-2">
                <Text size="xs" weight="600" muted style={{ textAlign: 'center' }}>
                  {t('timePicker.minute')}
                </Text>
                <ScrollView
                  ref={minScrollRef}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  style={{ height: 220, borderRadius: 12, backgroundColor: theme.surface }}
                >
                  {MINUTES.map((m) => {
                    const active = m === minute;
                    return (
                      <Pressable
                        key={m}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => { tap(); setMinute(m); }}
                        style={{
                          height: ROW_HEIGHT,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: active ? theme.primary : 'transparent',
                        }}
                      >
                        <Text weight={active ? '700' : '400'} color={active ? '#06231F' : theme.text}>
                          {String(m).padStart(2, '0')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            <View className="mt-5 flex-row items-center justify-between gap-3">
              {!required ? (
                <Pressable onPress={() => { onChange(''); setOpen(false); }} className="py-3">
                  <Text color={theme.textSecondary}>{t('timePicker.clear')}</Text>
                </Pressable>
              ) : (
                <View />
              )}
              <View className="flex-1" style={{ maxWidth: 180 }}>
                <Button
                  title={t('common.done')}
                  onPress={() => {
                    onChange(formatTime(hour, minute));
                    setOpen(false);
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
