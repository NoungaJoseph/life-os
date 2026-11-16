import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Share, Switch, View } from 'react-native';
import { Button, Card, ErrorText, Field, Header, Loading, Screen, SectionHeader, Text, success } from '../src/components/ui';
import { api } from '../src/lib/api';
import { errorMessage } from '../src/lib/errors';
import { enablePush } from '../src/lib/push';
import { signOutDevice } from '../src/lib/signOut';
import { spacing } from '../src/theme/tokens';
import { useTheme } from '../src/theme/useTheme';

type Prefs = { quiet_start: string; quiet_end: string; max_per_day: number; push_enabled: boolean };

export default function Settings() {
  const router = useRouter();
  const t = useTheme();
  const { t: tr } = useTranslation();
  const prefs = useQuery({ queryKey: ['prefs'], queryFn: () => api<Prefs>('/notification-preferences') });
  const [p, setP] = useState<{ quiet_start: string; quiet_end: string; max: string; push: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const push = useMutation({ mutationFn: enablePush, onSuccess: (r) => setPushMsg(r.ok ? tr('settingsPage.pushDone') : tr(`ui.push.${r.reason}`)), onError: (e) => setPushMsg(errorMessage(e, tr)) });
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

  return (
    <Screen bottomPad={40}>
      <Header title={tr('settingsPage.title')} subtitle={tr('settingsPage.subtitle')} back />
      <SectionHeader title={tr('settingsPage.notifications')} />
      {!p ? <Loading /> : (
        <Card className="gap-[16px]">
          <View className="flex-row items-center justify-between">
            <Text weight="600">{tr('settingsPage.allowReminders')}</Text>
            <Switch value={p.push} onValueChange={(v) => setP({ ...p, push: v })} trackColor={{ true: t.primary, false: t.border }} />
          </View>
          <Field label={tr('settingsPage.quietStart')} value={p.quiet_start} onChangeText={(v) => setP({ ...p, quiet_start: v })} />
          <Field label={tr('settingsPage.quietEnd')} value={p.quiet_end} onChangeText={(v) => setP({ ...p, quiet_end: v })} />
          <Field label={tr('settingsPage.maxPerDay')} value={p.max} onChangeText={(v) => setP({ ...p, max: v })} keyboardType="number-pad" />
          <Button title={tr('settingsPage.enablePush')} variant="ghost" loading={push.isPending} onPress={() => push.mutate()} />
          {pushMsg ? <Text size="sm" muted>{pushMsg}</Text> : <Text size="xs" muted>{tr('settingsPage.pushNeedsBuild')}</Text>}
          <Button title={tr('settingsPage.save')} loading={save.isPending} onPress={() => save.mutate()} />
        </Card>
      )}
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
