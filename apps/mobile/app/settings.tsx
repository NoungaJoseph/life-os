import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Share, Switch, View } from 'react-native';
import { TimeField } from '../src/components/TimeField';
import { Button, Card, ErrorText, Field, Header, Loading, Screen, SectionHeader, Text, success } from '../src/components/ui';
import { FirstVisitTip } from '../src/components/Tutorial';
import { api } from '../src/lib/api';
import { errorMessage } from '../src/lib/errors';
import { setEveningCheckinPrefs, syncEveningCheckinNotification, useEveningCheckinState } from '../src/lib/eveningCheckin';
import { enablePush } from '../src/lib/push';
import {
  requestLocalNotificationPermission,
  setRoutinePrefs,
  syncRoutineNotifications,
  useRoutineState,
} from '../src/lib/routineNotifications';
import { signOutDevice } from '../src/lib/signOut';
import { useSession } from '../src/lib/session';
import { resetTutorial } from '../src/lib/tutorial';
import { Profile } from '../src/lib/types';
import { spacing } from '../src/theme/tokens';
import { useTheme } from '../src/theme/useTheme';

type Prefs = { quiet_start: string; quiet_end: string; max_per_day: number; push_enabled: boolean };

export default function Settings() {
  const router = useRouter();
  const t = useTheme();
  const { t: tr } = useTranslation();
  const qc = useQueryClient();
  const { session } = useSession();
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/profile') });
  const prefs = useQuery({ queryKey: ['prefs'], queryFn: () => api<Prefs>('/notification-preferences') });
  const [p, setP] = useState<{ quiet_start: string; quiet_end: string; max: string; push: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [localMsg, setLocalMsg] = useState<string | null>(null);
  const evening = useEveningCheckinState();
  const routine = useRoutineState();
  const routineCopy = () => ({
    channelName: tr('ui.push.channel'),
    morningTitle: tr('routine.notif.morningTitle'),
    morningBody: tr('routine.notif.morningBody'),
    breakfastTitle: tr('routine.notif.breakfastTitle'),
    breakfastBody: tr('routine.notif.breakfastBody'),
    lunchTitle: tr('routine.notif.lunchTitle'),
    lunchBody: tr('routine.notif.lunchBody'),
    dinnerTitle: tr('routine.notif.dinnerTitle'),
    dinnerBody: tr('routine.notif.dinnerBody'),
    monthlyTitle: tr('routine.notif.monthlyTitle'),
    monthlyBody: tr('routine.notif.monthlyBody'),
  });
  const enableLocal = useMutation({
    mutationFn: async () => {
      const perm = await requestLocalNotificationPermission();
      if (perm === 'web') return 'web';
      if (perm !== 'granted') return 'blocked';
      await Promise.all([
        syncEveningCheckinNotification(tr('eveningCheckin.notifTitle'), tr('eveningCheckin.notifBody'), true),
        syncRoutineNotifications(routineCopy(), true),
      ]);
      return 'done';
    },
    onSuccess: (status) => {
      if (status === 'done') {
        success();
        setLocalMsg(tr('settingsPage.localNotifDone'));
      } else if (status === 'web') {
        setLocalMsg(tr('ui.push.web'));
      } else {
        setLocalMsg(tr('ui.push.blocked'));
      }
    },
    onError: (e) => setLocalMsg(errorMessage(e, tr)),
  });
  const push = useMutation({
    mutationFn: enablePush,
    onSuccess: (r) => {
      setPushMsg(r.ok ? tr('settingsPage.pushDone') : tr(`ui.push.${r.reason}`));
      if (r.ok) void syncEveningCheckinNotification(tr('eveningCheckin.notifTitle'), tr('eveningCheckin.notifBody'));
    },
    onError: (e) => setPushMsg(errorMessage(e, tr)),
  });
  useEffect(() => { if (prefs.data) setP({ quiet_start: prefs.data.quiet_start.slice(0, 5), quiet_end: prefs.data.quiet_end.slice(0, 5), max: String(prefs.data.max_per_day), push: prefs.data.push_enabled }); }, [prefs.data]);

  const save = useMutation({
    mutationFn: () => api('/notification-preferences', { method: 'PUT', body: { quiet_start: p!.quiet_start, quiet_end: p!.quiet_end, max_per_day: Number(p!.max), push_enabled: p!.push } }),
    onSuccess: () => { success(); setErr(null); }, onError: (e) => setErr(errorMessage(e, tr)),
  });
  const exportData = useMutation({
    mutationFn: async () => {
      const data = await api('/me/export');
      const text = JSON.stringify(data, null, 2);
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = 'my-life-os-export.json'; a.click(); URL.revokeObjectURL(url);
      } else await Share.share({ message: text, title: tr('settingsPage.exportTitle') });
    },
    onError: (e) => setErr(errorMessage(e, tr)),
  });
  const del = useMutation({
    mutationFn: () => api('/me', { method: 'DELETE', body: { confirm: 'DELETE' } }),
    onSuccess: async () => { await signOutDevice(); router.replace('/login'); },
    onError: (e) => setErr(errorMessage(e, tr)),
  });
  const askDelete = () => {
    const go = () => del.mutate();
    if (Platform.OS === 'web') { if (window.confirm(tr('settingsPage.confirmWeb'))) go(); return; }
    Alert.alert(tr('settingsPage.deleteTitle'), tr('settingsPage.confirmBody'), [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('settingsPage.deleteForever'), style: 'destructive', onPress: go }]);
  };
  const replay = async () => {
    if (!session?.user.id || !profile.data) return;
    try { await resetTutorial(session.user.id, profile.data, qc); router.replace('/tutorial'); } catch (e) { setErr(errorMessage(e, tr)); }
  };

  return (
    <Screen bottomPad={40}>
      <FirstVisitTip screen="settings" />
      <Header title={tr('settingsPage.title')} subtitle={tr('settingsPage.subtitle')} back />
      <Button title={tr('guide.title')} variant="ghost" icon="help-circle-outline" onPress={() => router.push('/guide')} />
      <SectionHeader title={tr('tutorial.replay')} />
      <Card className="gap-3"><Text size="sm" muted>{tr('tutorial.replayHint')}</Text><Button title={tr('tutorial.replay')} variant="ghost" icon="refresh-outline" onPress={() => void replay()} /></Card>
      <SectionHeader title={tr('settingsPage.notifications')} />
      {!p ? <Loading /> : (
        <Card className="gap-[16px]">
          <View className="flex-row items-center justify-between">
            <Text weight="600">{tr('settingsPage.allowReminders')}</Text>
            <Switch value={p.push} onValueChange={(v) => setP({ ...p, push: v })} trackColor={{ true: t.primary, false: t.border }} />
          </View>
          <TimeField label={tr('settingsPage.quietStart')} value={p.quiet_start} onChange={(v) => setP({ ...p, quiet_start: v })} required />
          <TimeField label={tr('settingsPage.quietEnd')} value={p.quiet_end} onChange={(v) => setP({ ...p, quiet_end: v })} required />
          <Field label={tr('settingsPage.maxPerDay')} value={p.max} onChangeText={(v) => setP({ ...p, max: v })} keyboardType="number-pad" />
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text weight="600">{tr('settingsPage.eveningCheckin')}</Text>
              <Text size="xs" muted>{tr('settingsPage.eveningCheckinHint')}</Text>
            </View>
            <Switch
              value={evening.enabled}
              onValueChange={(v) => {
                void setEveningCheckinPrefs({ enabled: v }).then(() =>
                  syncEveningCheckinNotification(tr('eveningCheckin.notifTitle'), tr('eveningCheckin.notifBody')),
                );
              }}
              trackColor={{ true: t.primary, false: t.border }}
            />
          </View>
          {evening.enabled && (
            <TimeField
              label={tr('settingsPage.eveningCheckinTime')}
              value={evening.time}
              onChange={(v) => {
                void setEveningCheckinPrefs({ time: v }).then(() =>
                  syncEveningCheckinNotification(tr('eveningCheckin.notifTitle'), tr('eveningCheckin.notifBody')),
                );
              }}
              required
            />
          )}
          <Button title={tr('settingsPage.enableLocalNotif')} variant="ghost" icon="notifications-outline" loading={enableLocal.isPending} onPress={() => enableLocal.mutate()} />
          {localMsg ? <Text size="sm" muted>{localMsg}</Text> : null}
          <Button title={tr('settingsPage.enablePush')} variant="ghost" loading={push.isPending} onPress={() => push.mutate()} />
          {pushMsg ? <Text size="sm" muted>{pushMsg}</Text> : <Text size="xs" muted>{tr('settingsPage.pushNeedsBuild')}</Text>}
          <Button title={tr('settingsPage.save')} loading={save.isPending} onPress={() => save.mutate()} />
        </Card>
      )}
      <SectionHeader title={tr('settingsPage.routineSection')} />
      <Card className="gap-[16px]">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text weight="600">{tr('settingsPage.morningPlan')}</Text>
            <Text size="xs" muted>{tr('settingsPage.morningPlanHint')}</Text>
          </View>
          <Switch
            value={routine.morningEnabled}
            onValueChange={(v) => {
              void setRoutinePrefs({ morningEnabled: v }).then(() => syncRoutineNotifications(routineCopy()));
            }}
            trackColor={{ true: t.primary, false: t.border }}
          />
        </View>
        {routine.morningEnabled && (
          <TimeField
            label={tr('settingsPage.morningTime')}
            value={routine.morningTime}
            onChange={(v) => {
              void setRoutinePrefs({ morningTime: v }).then(() => syncRoutineNotifications(routineCopy()));
            }}
            required
          />
        )}
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text weight="600">{tr('settingsPage.mealFollowups')}</Text>
            <Text size="xs" muted>{tr('settingsPage.mealFollowupsHint')}</Text>
          </View>
          <Switch
            value={routine.mealsEnabled}
            onValueChange={(v) => {
              void setRoutinePrefs({ mealsEnabled: v }).then(() => syncRoutineNotifications(routineCopy()));
            }}
            trackColor={{ true: t.primary, false: t.border }}
          />
        </View>
        {routine.mealsEnabled && (
          <>
            <TimeField
              label={tr('settingsPage.breakfastTime')}
              value={routine.breakfastTime}
              onChange={(v) => {
                void setRoutinePrefs({ breakfastTime: v }).then(() => syncRoutineNotifications(routineCopy()));
              }}
              required
            />
            <TimeField
              label={tr('settingsPage.lunchTime')}
              value={routine.lunchTime}
              onChange={(v) => {
                void setRoutinePrefs({ lunchTime: v }).then(() => syncRoutineNotifications(routineCopy()));
              }}
              required
            />
            <TimeField
              label={tr('settingsPage.dinnerTime')}
              value={routine.dinnerTime}
              onChange={(v) => {
                void setRoutinePrefs({ dinnerTime: v }).then(() => syncRoutineNotifications(routineCopy()));
              }}
              required
            />
          </>
        )}
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text weight="600">{tr('settingsPage.monthlyReportAlert')}</Text>
            <Text size="xs" muted>{tr('settingsPage.monthlyReportAlertHint')}</Text>
          </View>
          <Switch
            value={routine.monthlyReportEnabled}
            onValueChange={(v) => {
              void setRoutinePrefs({ monthlyReportEnabled: v }).then(() => syncRoutineNotifications(routineCopy()));
            }}
            trackColor={{ true: t.primary, false: t.border }}
          />
        </View>
      </Card>
      <SectionHeader title={tr('settingsPage.yourData')} />
      <Card className="gap-[16px]">
        <Text size="sm" muted>{tr('settingsPage.exportBody')}</Text>
        <Button title={tr('settingsPage.exportBtn')} variant="ghost" loading={exportData.isPending} onPress={() => exportData.mutate()} />
      </Card>
      <Card className="gap-[16px]">
        <Text weight="600" color={t.error}>{tr('settingsPage.deleteTitle')}</Text>
        <Text size="sm" muted>{tr('settingsPage.deleteBody')}</Text>
        <Field label={tr('settingsPage.typeDelete')} value={confirm} onChangeText={setConfirm} autoCapitalize="characters" />
        <Button title={tr('settingsPage.deleteBtn')} variant="danger" disabled={confirm !== 'DELETE'} loading={del.isPending} onPress={askDelete} />
      </Card>
      <ErrorText message={err} />
    </Screen>
  );
}
