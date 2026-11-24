import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Modal, Platform, Pressable, View } from 'react-native';
import {
  dismissEveningCheckinTonight,
  isEveningPromptDue,
  loadEveningCheckinState,
  snoozeEveningCheckin,
  syncEveningCheckinNotification,
  useEveningCheckinState,
} from '../lib/eveningCheckin';
import { minutesUntilBedtime } from '../lib/eveningCheckinLogic';
import { useTheme } from '../theme/useTheme';
import { Button, IconBadge, Text } from './ui';

export function EveningCheckinPrompt({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const checkinState = useEveningCheckinState();
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    void loadEveningCheckinState();
  }, []);

  useEffect(() => {
    if (!active || !checkinState.loaded) return;
    void syncEveningCheckinNotification(t('eveningCheckin.notifTitle'), t('eveningCheckin.notifBody'));
  }, [active, checkinState.loaded, checkinState.enabled, checkinState.time, t]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick(Date.now()), 60_000);
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') setTick(Date.now());
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [active]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    // The response listener only covers taps after JavaScript is running. Read
    // the last response as well so a notification that cold-started the app
    // still opens the check-in screen.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      const route = response?.notification.request.content.data?.route;
      if (route === '/evening-checkin') {
        void Notifications.clearLastNotificationResponseAsync();
        router.push('/evening-checkin');
      }
    });
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = response.notification.request.content.data?.route;
      if (route === '/evening-checkin') {
        void Notifications.clearLastNotificationResponseAsync();
        router.push('/evening-checkin');
      }
    });
    return () => sub.remove();
  }, [router]);

  const now = new Date(tick);
  const visible = active && isEveningPromptDue(checkinState, now);
  if (!visible) return null;

  const minsLeft = minutesUntilBedtime(now);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => void snoozeEveningCheckin(15)}>
      <View className="flex-1 justify-end bg-black/60 p-4 sm:justify-center">
        <View
          className="gap-4 rounded-2xl border border-line bg-bg p-6"
          style={{ maxWidth: 460, width: '100%', alignSelf: 'center' }}
        >
          <View className="flex-row items-center gap-3">
            <IconBadge icon="moon" tone="accent" size={44} />
            <View className="flex-1">
              <Text size="xs" weight="700" color={theme.gold} style={{ letterSpacing: 1.5 }}>
                {t('eveningCheckin.popupEyebrow')}
              </Text>
              <Text size="lg" serif>{t('eveningCheckin.popupTitle')}</Text>
            </View>
          </View>

          <Text size="sm" muted>
            {minsLeft > 0
              ? t('eveningCheckin.popupCountdown', { minutes: minsLeft })
              : t('eveningCheckin.popupPastBedtime')}
          </Text>

          <View className="gap-2">
            <Button
              title={t('eveningCheckin.startNow')}
              icon="moon-outline"
              onPress={() => {
                router.push('/evening-checkin');
              }}
            />
            <Button
              title={t('eveningCheckin.snooze15')}
              variant="ghost"
              onPress={() => {
                void snoozeEveningCheckin(15);
              }}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void dismissEveningCheckinTonight();
            }}
            className="items-center py-2"
          >
            <Text size="xs" muted>{t('eveningCheckin.dismissTonight')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
