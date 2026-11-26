import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button, FadeIn, Press, Screen, Text, tap } from '../src/components/ui';
import { Lang, setLanguage } from '../src/i18n';
import { useTheme } from '../src/theme/useTheme';

const OPTIONS: { code: Lang; label: 'french' | 'english'; hint: 'frenchHint' | 'englishHint' }[] = [
  { code: 'fr', label: 'french', hint: 'frenchHint' },
  { code: 'en', label: 'english', hint: 'englishHint' },
];

/** First screen on a fresh install. Also reused from Settings (?from=settings) or Auth (?from=auth). */
export default function LanguageScreen() {
  const { t, i18n } = useTranslation();
  const th = useTheme();
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [choice, setChoice] = useState<Lang>(i18n.language === 'fr' ? 'fr' : 'en');

  const pick = (c: Lang) => { tap(); setChoice(c); void i18n.changeLanguage(c); };
  const confirm = async () => {
    await setLanguage(choice);
    router.replace(from === 'settings' ? '/settings' : from === 'auth' ? '/login' : '/tutorial');
  };

  return (
    <Screen bottomPad={30}>
      <FadeIn>
        <View className="items-center gap-3 border-b border-line pb-6 pt-8">
          <View className="h-16 w-16 items-center justify-center rounded-md border border-line bg-surface">
            <Ionicons name="language-outline" size={30} color={th.primary} />
          </View>
          <Text size="xs" weight="700" color={th.gold} style={{ letterSpacing: 1.8 }}>
            {t('common.appName')}
          </Text>
          <Text size="xl" serif weight="700" style={{ maxWidth: '100%', textAlign: 'center' }}>
            {t('language.title')}
          </Text>
          <Text muted size="sm" style={{ alignSelf: 'stretch', paddingHorizontal: 8, textAlign: 'center' }}>
            {t('language.subtitle')}
          </Text>
        </View>
      </FadeIn>

      <View className="gap-3 pt-2">
        {OPTIONS.map((o, i) => {
          const on = choice === o.code;
          return (
            <FadeIn key={o.code} delay={100 + i * 70}>
              <Press
                onPress={() => pick(o.code)}
                label={t(`language.${o.label}`)}
                className={`flex-row items-center gap-4 rounded-md border bg-surface p-5 ${on ? 'border-primary' : 'border-line'}`}
                style={on ? { borderWidth: 2 } : undefined}
              >
                <View className="h-11 w-11 items-center justify-center rounded-md border border-line bg-surface-alt">
                  <Text weight="700" color={on ? th.primary : th.textSecondary}>{o.code.toUpperCase()}</Text>
                </View>
                <View className="flex-1 gap-0.5">
                  <Text size="md" weight="700">{t(`language.${o.label}`)}</Text>
                  <Text size="xs" muted>{t(`language.${o.hint}`)}</Text>
                </View>
                <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? th.primary : th.border} />
              </Press>
            </FadeIn>
          );
        })}
      </View>

      <View className="mt-4">
        <Button title={t('language.continue')} icon="arrow-forward" onPress={() => void confirm()} />
      </View>
    </Screen>
  );
}
