import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button, FadeIn, Press, Screen, Text } from '../../src/components/ui';

const FEATURES = [
  { icon: 'compass-outline', k: 'f1' }, { icon: 'wallet-outline', k: 'f2' }, { icon: 'shield-checkmark-outline', k: 'f3' },
] as const;

export default function Welcome() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen>
      <View className="items-center gap-3 pt-8">
        <FadeIn>
          <LinearGradient colors={['#14213D', '#223E66']} style={{ borderRadius: 36 }} className="h-28 w-28 items-center justify-center">
            <Ionicons name="infinite" size={56} color="#E9D9A6" />
          </LinearGradient>
        </FadeIn>
        <Text size="xxl" serif weight="700" style={{ textAlign: 'center' }}>{t('common.appName')}</Text>
        <Text muted style={{ textAlign: 'center' }}>{t('auth.welcomeBody')}</Text>
      </View>
      <View className="mt-4 gap-3">
        {FEATURES.map((f, i) => (
          <FadeIn key={f.k} delay={150 + i * 90}>
            <View className="flex-row items-center gap-4 rounded-lg border border-line bg-surface p-4">
              <View className="h-11 w-11 items-center justify-center rounded-md bg-surface-alt"><Ionicons name={f.icon} size={22} color="#12A594" /></View>
              <View className="flex-1"><Text weight="600">{t(`auth.welcome.${f.k}Title`)}</Text><Text size="sm" muted>{t(`auth.welcome.${f.k}Body`)}</Text></View>
            </View>
          </FadeIn>
        ))}
      </View>
      <View className="mt-4 gap-3">
        <Button title={t('auth.createAccount')} onPress={() => router.push('/register')} />
        <Button title={t('auth.signIn')} variant="ghost" onPress={() => router.push('/login')} />
        <Press onPress={() => router.push('/language')} label={t('language.settingsTitle')} className="items-center py-2">
          <Text size="sm" muted>{t('language.settingsTitle')} · Français / English</Text>
        </Press>
      </View>
    </Screen>
  );
}
