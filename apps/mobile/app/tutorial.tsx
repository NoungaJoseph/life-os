import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { Button, Card, ErrorText, Pill, ProgressBar, Row, Screen, Text, tap } from '../src/components/ui';
import { errorMessage } from '../src/lib/errors';
import { useLock } from '../src/lib/lock';
import { useSession } from '../src/lib/session';
import { finishIntro, finishTour, markLocalTourSeen } from '../src/lib/tutorial';
import { Profile } from '../src/lib/types';
import { useTheme } from '../src/theme/useTheme';

const cards = [
  { key: 'one', icon: 'compass-outline' },
  { key: 'two', icon: 'checkmark-done-outline' },
  { key: 'three', icon: 'leaf-outline' },
  { key: 'four', icon: 'wallet-outline' },
  { key: 'five', icon: 'shield-checkmark-outline' },
] as const;

function TourArt({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  const th = useTheme();
  return (
    <View className="h-44 items-center justify-center">
      <Svg width={160} height={160} viewBox="0 0 160 160" accessibilityElementsHidden>
        <Circle cx="80" cy="80" r="70" fill="none" stroke={th.border} strokeWidth={1.2} />
        <Circle cx="80" cy="80" r="52" fill={th.surfaceAlt} stroke={th.gold} strokeWidth={1.5} strokeOpacity={0.7} />
        <Line x1="16" y1="80" x2="144" y2="80" stroke={th.border} strokeWidth={1} strokeOpacity={0.6} />
        <Line x1="80" y1="16" x2="80" y2="144" stroke={th.border} strokeWidth={1} strokeOpacity={0.6} />
      </Svg>
      <View className="absolute h-16 w-16 items-center justify-center rounded-md border border-line bg-surface">
        <Ionicons name={icon} size={34} color={th.primary} />
      </View>
    </View>
  );
}

export default function TutorialScreen() {
  const { t } = useTranslation();
  const th = useTheme();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useSession();
  const lock = useLock();
  const profile = qc.getQueryData<Profile>(['profile']);
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const goTo = (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(cards.length - 1, nextIndex));
    setIndex(clamped);
    ref.current?.scrollTo({ x: width * clamped, animated: true });
  };

  const finish = async () => {
    try {
      if (session?.user.id) {
        if (profile) {
          await finishTour(session.user.id, profile, qc);
        } else {
          await markLocalTourSeen(session.user.id);
        }
        router.replace(lock.hasPin === false ? '/create-pin' : '/');
      } else {
        await finishIntro();
        router.replace('/login');
      }
    } catch (e) {
      setError(errorMessage(e, t));
    }
  };

  const next = () => (index === cards.length - 1 ? void finish() : goTo(index + 1));
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <Screen scroll={false}>
      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text size="xs" weight="700" color={th.gold} style={{ letterSpacing: 1.6 }}>
            {t('common.appName')}
          </Text>
          <View className="flex-row items-center gap-3">
            <Pill label={t('tutorial.progress', { current: index + 1, total: cards.length })} tone="accent" />
            <Pressable
              onPress={() => { tap(); void finish(); }}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text size="sm" color={th.primary} weight="600">{t('tutorial.skip')}</Text>
            </Pressable>
          </View>
        </View>
        <ProgressBar value={(index + 1) / cards.length} tone="accent" height={5} />
      </View>

      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ marginHorizontal: -24 }}
      >
        {cards.map((card) => (
          <View key={card.key} style={{ width, paddingHorizontal: 24 }} className="justify-center">
            <Card className="items-center gap-5 py-6">
              <TourArt icon={card.icon} />
              <View className="gap-2">
                <Text size="xl" serif weight="700" style={{ textAlign: 'center' }}>
                  {t(`tutorial.cards.${card.key}Title`)}
                </Text>
                <Text size="sm" muted style={{ textAlign: 'center', lineHeight: 21 }}>
                  {t(`tutorial.cards.${card.key}Body`)}
                </Text>
              </View>
            </Card>
          </View>
        ))}
      </ScrollView>

      <View className="items-center gap-3">
        <View className="flex-row gap-2">
          {cards.map((card, i) => (
            <View
              key={card.key}
              style={{
                width: i === index ? 24 : 8,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === index ? th.primary : th.border,
              }}
            />
          ))}
        </View>
      </View>

      <ErrorText message={error} />
      <Row gap={10}>
        {index > 0 ? (
          <View className="flex-1">
            <Button title={t('common.back')} variant="ghost" onPress={() => goTo(index - 1)} />
          </View>
        ) : null}
        <View className="flex-1">
          <Button title={t(index === cards.length - 1 ? 'tutorial.finish' : 'tutorial.next')} onPress={next} />
        </View>
      </Row>
    </Screen>
  );
}
