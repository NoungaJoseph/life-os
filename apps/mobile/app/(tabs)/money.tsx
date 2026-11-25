import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Header, IconBadge, Press, Screen, SectionHeader, Text } from '../../src/components/ui';
import { useTheme } from '../../src/theme/useTheme';

const EVERYDAY = [
  { key: 'wallet', icon: 'wallet-outline', route: '/wallet' },
  { key: 'overview', icon: 'analytics-outline', route: '/finance' },
  { key: 'debts', icon: 'receipt-outline', route: '/debts' },
] as const;

const BUILDING = [
  { key: 'savings', icon: 'trending-up-outline', route: '/savings' },
  { key: 'family', icon: 'people-outline', route: '/family-savings' },
  { key: 'groups', icon: 'git-network-outline', route: '/groups' },
  { key: 'vault', icon: 'lock-closed-outline', route: '/vault' },
] as const;

type Item = (typeof EVERYDAY)[number] | (typeof BUILDING)[number];

export default function Money() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();

  const row = (item: Item) => (
    <Press key={item.key} onPress={() => router.push(item.route)} label={t(`moneyHub.${item.key}`)}>
      <View className="min-h-[72px] flex-row items-center gap-3 border-b border-line py-3">
        <IconBadge icon={item.icon} tone={item.key === 'wallet' ? 'accent' : 'neutral'} size={40} />
        <View className="flex-1">
          <Text weight="600">{t(`moneyHub.${item.key}`)}</Text>
          <Text size="xs" muted>{t(`moneyHub.${item.key}Body`)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </View>
    </Press>
  );

  return (
    <Screen bottomPad={120}>
      <Header eyebrow="MY LIFE OS / MONEY" title={t('moneyHub.title')} subtitle={t('moneyHub.subtitle')} />
      <SectionHeader title={t('moneyHub.everyday')} />
      <View>{EVERYDAY.map(row)}</View>
      <SectionHeader title={t('moneyHub.building')} />
      <View>{BUILDING.map(row)}</View>
    </Screen>
  );
}
