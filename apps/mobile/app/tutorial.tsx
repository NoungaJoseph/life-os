import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, ScrollViewInstance, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Button, ErrorText, Screen, Text } from '../src/components/ui';
import { errorMessage } from '../src/lib/errors';
import { useSession } from '../src/lib/session';
import { finishTour } from '../src/lib/tutorial';
import { Profile } from '../src/lib/types';
import { useTheme } from '../src/theme/useTheme';

const cards = [
  { key: 'one', icon: 'compass-outline' }, { key: 'two', icon: 'checkmark-done-outline' }, { key: 'three', icon: 'leaf-outline' },
  { key: 'four', icon: 'wallet-outline' }, { key: 'five', icon: 'shield-checkmark-outline' },
] as const;

function TourArt({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  const th = useTheme();
  return <View className="h-56 items-center justify-center"><Svg width="240" height="190" viewBox="0 0 240 190"><Circle cx="120" cy="94" r="76" fill={th.surfaceAlt} /><Path d="M35 132 C68 78 94 154 128 92 S184 45 211 84" fill="none" stroke={th.primary} strokeWidth="5" strokeLinecap="round" /><Rect x="75" y="52" width="90" height="84" rx="24" fill={th.surface} stroke={th.gold} strokeWidth="3" /></Svg><View className="absolute"><Ionicons name={icon} size={58} color={th.primary} /></View></View>;
}

export default function TutorialScreen() {
  const { t } = useTranslation();
  const th = useTheme();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useSession();
  const profile = qc.getQueryData<Profile>(['profile']);
  const ref = useRef<ScrollViewInstance>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const finish = async () => {
    if (!session?.user.id || !profile) return;
    try { await finishTour(session.user.id, profile, qc); router.replace('/'); } catch (e) { setError(errorMessage(e, t)); }
  };
  const next = () => index === cards.length - 1 ? void finish() : ref.current?.scrollTo({ x: width * (index + 1), animated: true });
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  return (
    <Screen scroll={false}>
      <View className="flex-row justify-end"><Pressable onPress={() => void finish()} accessibilityRole="button"><Text color={th.primary} weight="600">{t('tutorial.skip')}</Text></Pressable></View>
      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScrollEnd} style={{ marginHorizontal: -24 }}>
        {cards.map((card) => <View key={card.key} style={{ width, paddingHorizontal: 24 }} className="justify-center gap-5"><TourArt icon={card.icon} /><View className="gap-3"><Text size="xxl" serif style={{ textAlign: 'center' }}>{t(`tutorial.cards.${card.key}Title`)}</Text><Text muted style={{ textAlign: 'center' }}>{t(`tutorial.cards.${card.key}Body`)}</Text></View></View>)}
      </ScrollView>
      <View className="items-center gap-4"><View className="flex-row gap-2">{cards.map((card, i) => <View key={card.key} style={{ width: i === index ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: i === index ? th.primary : th.border }} />)}</View><Text size="xs" muted>{t('tutorial.progress', { current: index + 1, total: cards.length })}</Text></View>
      <ErrorText message={error} />
      <Button title={t(index === cards.length - 1 ? 'tutorial.finish' : 'tutorial.next')} onPress={next} />
    </Screen>
  );
}
