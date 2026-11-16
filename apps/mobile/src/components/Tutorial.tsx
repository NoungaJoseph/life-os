import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSession } from '../lib/session';
import { finishTip, hasSeenTip, TipScreen } from '../lib/tutorial';
import { Profile } from '../lib/types';
import { useTheme } from '../theme/useTheme';
import { Button, Card, Text } from './ui';

export function FirstVisitTip({ screen }: { screen: TipScreen }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { session } = useSession();
  const qc = useQueryClient();
  const profile = qc.getQueryData<Profile>(['profile']);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let active = true;
    if (!session?.user.id) return;
    void hasSeenTip(session.user.id, profile, screen).then((seen) => { if (active) setVisible(!seen); });
    return () => { active = false; };
  }, [profile, screen, session?.user.id]);
  if (!visible || !session?.user.id || !profile) return null;
  const dismiss = async () => {
    setVisible(false);
    try { await finishTip(session.user.id, profile, screen, qc); } catch { setVisible(true); }
  };
  return (
    <Card className="gap-3" style={{ borderColor: theme.primary }}>
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-alt"><Ionicons name="bulb-outline" size={22} color={theme.primary} /></View>
        <View className="flex-1 gap-1"><Text weight="700">{t('tutorial.tipTitle')}</Text><Text size="sm" muted>{t(`tutorial.tips.${screen}`)}</Text></View>
      </View>
      <Button title={t('tutorial.dismiss')} variant="ghost" onPress={() => void dismiss()} />
    </Card>
  );
}
