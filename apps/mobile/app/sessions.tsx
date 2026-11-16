import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, View } from 'react-native';
import { Button, Card, EmptyState, ErrorState, ErrorText, FadeIn, Header, Loading, Pill, Press, Screen, SectionHeader, Segmented, Text, success } from '../src/components/ui';
import { currentLocale } from '../src/i18n';
import { api } from '../src/lib/api';
import { errorMessage } from '../src/lib/errors';
import { LockAfter, useLock } from '../src/lib/lock';
import { useTheme } from '../src/theme/useTheme';

type Dev = { id: string; device_name: string; platform: string | null; last_active_at: string; current: boolean };

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  const f = new Intl.RelativeTimeFormat(currentLocale(), { numeric: 'auto' });
  if (mins < 60) return f.format(-Math.max(mins, 0), 'minute');
  if (mins < 1440) return f.format(-Math.round(mins / 60), 'hour');
  return f.format(-Math.round(mins / 1440), 'day');
}
const ICON = { ios: 'phone-portrait-outline', android: 'phone-portrait-outline', web: 'globe-outline' } as const;

export default function Sessions() {
  const { t } = useTranslation();
  const th = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { lockAfter, setLockAfter } = useLock();
  const q = useQuery({ queryKey: ['sessions'], queryFn: () => api<Dev[]>('/sessions') });
  const refresh = () => qc.invalidateQueries({ queryKey: ['sessions'] });
  const revoke = useMutation({ mutationFn: (id: string) => api(`/sessions/${id}`, { method: 'DELETE' }), onSuccess: () => { success(); void refresh(); } });
  const revokeOthers = useMutation({ mutationFn: () => api('/sessions/revoke-others', { method: 'POST' }), onSuccess: () => { success(); void refresh(); } });

  const confirm = (msg: string, go: () => void) => {
    if (Platform.OS === 'web') { if (window.confirm(msg)) go(); return; }
    Alert.alert(msg, undefined, [{ text: t('common.cancel'), style: 'cancel' }, { text: t('sessions.signOut'), style: 'destructive', onPress: go }]);
  };
  const others = (q.data ?? []).filter((d) => !d.current);

  return (
    <Screen bottomPad={40} onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Header title={t('sessions.title')} subtitle={t('sessions.subtitle')} back />
      {q.isLoading ? <Loading /> : q.error ? <ErrorState message={errorMessage(q.error, t)} onRetry={() => void q.refetch()} /> : (
        <>
          {(q.data ?? []).map((d, i) => (
            <FadeIn key={d.id} delay={i * 40}>
              <Card className="flex-row items-center gap-[12px]">
                <View className="h-11 w-11 items-center justify-center rounded-md bg-surface-alt">
                  <Ionicons name={ICON[(d.platform as keyof typeof ICON) ?? 'android'] ?? 'phone-portrait-outline'} size={22} color={th.primary} />
                </View>
                <View className="flex-1">
                  <Text weight="600">{d.device_name}</Text>
                  <Text size="sm" muted>{t('sessions.lastActive', { when: ago(d.last_active_at) })}</Text>
                </View>
                {d.current ? <Pill label={t('sessions.thisDevice')} tone="success" /> : (
                  <Press onPress={() => confirm(t('sessions.signOut') + ' ?', () => revoke.mutate(d.id))} label={t('sessions.signOut')}><Text size="sm" weight="600" color={th.error}>{t('sessions.signOut')}</Text></Press>
                )}
              </Card>
            </FadeIn>
          ))}
          {others.length === 0 ? <Text size="sm" muted>{t('sessions.empty')}</Text> : (
            <Button title={t('sessions.signOutOthers')} variant="danger" loading={revokeOthers.isPending} onPress={() => confirm(t('sessions.confirmOthers'), () => revokeOthers.mutate())} />
          )}
          <ErrorText message={revoke.error ? errorMessage(revoke.error, t) : revokeOthers.error ? errorMessage(revokeOthers.error, t) : null} />
        </>
      )}
      <SectionHeader title={t('sessions.lock')} />
      <Card className="gap-[12px]">
        <Text size="sm" muted>{t('sessions.lockAfter')}</Text>
        <Segmented<string> value={String(lockAfter)} onChange={(v) => setLockAfter(Number(v) as LockAfter)}
          options={[{ value: '0', label: t('sessions.lockNow') }, { value: '1', label: t('sessions.lock1') }, { value: '5', label: t('sessions.lock5') }]} />
      </Card>
      <Button title={t('sessions.changePin')} variant="ghost" icon="keypad-outline" onPress={() => router.push('/change-pin')} />
    </Screen>
  );
}
