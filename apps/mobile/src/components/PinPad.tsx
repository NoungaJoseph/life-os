import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { Press, Text, tap } from './ui';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

/** 4-digit entry with dots and a number pad. Bump `resetKey` to shake and clear after a wrong or mismatched entry. */
export function PinPad({ onComplete, resetKey = 0, disabled = false }: { onComplete: (pin: string) => void; resetKey?: number; disabled?: boolean }) {
  const th = useTheme();
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const shake = useRef(new Animated.Value(0)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setPin('');
    Animated.sequence([-1, 1, -1, 1, 0].map((v) => Animated.timing(shake, { toValue: v * 10, duration: 60, useNativeDriver: true }))).start();
  }, [resetKey, shake]);

  const press = (k: string) => {
    if (disabled) return;
    tap();
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) setTimeout(() => onComplete(next), 120);
  };

  return (
    <View className="items-center gap-10">
      <Animated.View style={{ transform: [{ translateX: shake }], flexDirection: 'row', gap: 16 }} accessibilityLabel={t('ui.pinEntered', { n: pin.length })}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} className={`h-[18px] w-[18px] rounded-full border-2 ${i < pin.length ? 'border-primary bg-primary' : 'border-line bg-transparent'}`} />
        ))}
      </Animated.View>
      <View className="w-full max-w-[300px] flex-row flex-wrap justify-between gap-y-4">
        {KEYS.map((k, i) => (
          <View key={i} className="w-[30%] items-center">
            {k === '' ? <View className="h-[68px] w-[68px]" /> : (
              <Press onPress={() => press(k)} disabled={disabled} label={k === 'del' ? t('ui.pinDelete') : k}
                className="h-[68px] w-[68px] items-center justify-center rounded-full border border-line bg-surface">
                {k === 'del' ? <Ionicons name="backspace-outline" size={26} color={th.text} /> : <Text size="xl" weight="500">{k}</Text>}
              </Press>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
