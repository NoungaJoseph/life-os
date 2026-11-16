import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
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

/** First screen on a fresh install. Also reused from Settings (opened with ?from=settings). */
export default function LanguageScreen() {
  const { t, i18n } = useTranslation();
  const th = useTheme();
  const router = useRouter();
  const [choice, setChoice] = useState<Lang>(i18n.language === 'fr' ? 'fr' : 'en');

  const pick = (c: Lang) => { tap(); setChoice(c); void i18n.changeLanguage(c); };   // preview the language live
  const confirm = async () => { await setLanguage(choice); if (router.canGoBack()) router.back(); else router.replace('/'); };

  return (
    <Screen>
      <View className="items-center gap-2 pt-10">
        <FadeIn>
          <LinearGradient colors={['#14213D', '#223E66']} className="h-24 w-24 items-center justify-center rounded-full" style={{ borderRadius: 48 }}>
            <Ionicons name="language" size={44} color="#E9D9A6" />
          </LinearGradient>
        </FadeIn>
        <Text size="xl" serif weight="700" style={{ textAlign: 'center' }}>{t('language.title')}</Text>
        <Text muted size="sm" style={{ textAlign: 'center' }}>{t('language.subtitle')}</Text>
      </View>
      <View className="mt-4 gap-3">
        {OPTIONS.map((o, i) => {
          const on = choice === o.code;
          return (
            <FadeIn key={o.code} delay={120 + i * 80}>
              <Press onPress={() => pick(o.code)} label={t(`language.${o.label}`)}
                className={`flex-row items-center gap-4 rounded-lg border-2 bg-surface p-5 ${on ? 'border-primary' : 'border-line'}`}>
                <View className="h-12 w-12 items-center justify-center rounded-full bg-surface-alt">
                  <Text weight="700" color={th.primary}>{o.code.toUpperCase()}</Text>
                </View>
                <View className="flex-1">
                  <Text size="lg" weight="600">{t(`language.${o.label}`)}</Text>
                  <Text size="sm" muted>{t(`language.${o.hint}`)}</Text>
                </View>
                <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={on ? th.primary : th.border} />
              </Press>
            </FadeIn>
          );
        })}
      </View>
      <View className="mt-4"><Button title={t('language.continue')} onPress={() => void confirm()} /></View>
    </Screen>
  );
}
