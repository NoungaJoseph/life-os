import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Switch, View } from 'react-native';
import { FirstVisitTip } from '../src/components/Tutorial';
import { Button, Card, Chip, EmptyState, ErrorText, Field, Header, Row, Screen, SectionHeader, Text } from '../src/components/ui';
import { api } from '../src/lib/api';
import { errorMessage } from '../src/lib/errors';
import { DailyUsage, InstalledApp, screenTimeCapability, screenTimeNative } from '../src/lib/screenTime';
import { useTheme } from '../src/theme/useTheme';

type Rule = { id: string; app_identifier: string; app_name: string; daily_limit_minutes: number; block_minutes: 60 | 120; commitment_mode: boolean; enabled: boolean; blocked_until: string | null };
export default function ScreenTime() {
  const { t } = useTranslation(); const theme = useTheme(); const qc = useQueryClient();
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const [name, setName] = useState(''); const [identifier, setIdentifier] = useState('');
  const [limit, setLimit] = useState(30); const [duration, setDuration] = useState<60 | 120>(60);
  const [commitment, setCommitment] = useState(false); const [adding, setAdding] = useState(process.env.EXPO_PUBLIC_VISUAL_TESTS === '1' && preview === 'form');
  const visual = process.env.EXPO_PUBLIC_VISUAL_TESTS === '1';
  const available = screenTimeCapability() || (visual && preview === 'form');
  const rules = useQuery({ queryKey: ['screen-time-rules'], queryFn: () => visual ? Promise.resolve([{ id: 'preview', app_identifier: 'com.example.focus', app_name: 'Focus', daily_limit_minutes: 30, block_minutes: 60, commitment_mode: true, enabled: true, blocked_until: null }] as Rule[]) : api<Rule[]>('/screen-time/rules') });
  const usage = useQuery({ queryKey: ['screen-time-usage'], queryFn: () => visual ? Promise.resolve([{ app_identifier: 'com.example.focus', used_on: new Date().toISOString().slice(0, 10), minutes: 24 }] as DailyUsage[]) : api<DailyUsage[]>('/screen-time/usage') });
  const apps = useQuery({ queryKey: ['installed-apps'], queryFn: () => visual ? Promise.resolve([{ identifier: 'com.example.focus', name: 'Focus' }] as InstalledApp[]) : screenTimeNative!.installedApps(), enabled: available && adding });
  const usagePermission = available && !!screenTimeNative?.hasUsagePermission();
  const accessibilityPermission = available && !!screenTimeNative?.hasAccessibilityPermission();
  const refreshUsage = async () => {
    if (!available || !usagePermission) return;
    const rows = await screenTimeNative!.dailyUsage();
    for (const row of rows.filter((r) => rules.data?.some((rule) => rule.app_identifier === r.app_identifier))) {
      await api('/screen-time/usage', { method: 'PUT', body: row });
    }
    await qc.invalidateQueries({ queryKey: ['screen-time-usage'] });
  };
  useEffect(() => {
    if (!available || !rules.data) return;
    screenTimeNative?.applyRules(rules.data.map((r) => ({ app_identifier: r.app_identifier, daily_limit_minutes: r.daily_limit_minutes, block_minutes: r.block_minutes, enabled: r.enabled, blocked_until: r.blocked_until })));
  }, [available, rules.data]);
  const create = useMutation({ mutationFn: () => api('/screen-time/rules', { method: 'POST', body: { app_identifier: identifier, app_name: name, daily_limit_minutes: limit, block_minutes: duration, commitment_mode: commitment } }), onSuccess: () => { setAdding(false); setName(''); setIdentifier(''); void qc.invalidateQueries({ queryKey: ['screen-time-rules'] }); } });
  const toggle = useMutation({ mutationFn: (r: Rule) => api(`/screen-time/rules/${r.id}`, { method: 'PATCH', body: { enabled: !r.enabled } }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['screen-time-rules'] }) });
  const block = useMutation({ mutationFn: (r: Rule) => api(`/screen-time/rules/${r.id}/block`, { method: 'POST' }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['screen-time-rules'] }) });
  const remove = useMutation({ mutationFn: (r: Rule) => api(`/screen-time/rules/${r.id}`, { method: 'DELETE' }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['screen-time-rules'] }) });
  const aggregated = (rule: Rule, days: number) => (usage.data ?? []).filter((u) => u.app_identifier === rule.app_identifier && u.used_on >= new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10)).reduce((n, u) => n + u.minutes, 0);
  return <Screen onRefresh={() => Promise.all([rules.refetch(), usage.refetch()]).then(() => undefined)} refreshing={rules.isRefetching || usage.isRefetching}>
    <FirstVisitTip screen="screenTime" />
    <Header title={t('screenTime.title')} subtitle={t('screenTime.subtitle')} back />
    {!available && <Card><EmptyState icon="phone-portrait-outline" title={Platform.OS === 'ios' ? t('screenTime.ios') : t('screenTime.unavailable')} /></Card>}
    <Card className="gap-3"><Text size="sm" muted>{t('screenTime.permission')}</Text>
      {available && !usagePermission && <Button title={t('screenTime.usageAccess')} variant="ghost" onPress={() => screenTimeNative?.openUsageSettings()} />}
      {available && !accessibilityPermission && <Button title={t('screenTime.accessibility')} variant="ghost" onPress={() => screenTimeNative?.openAccessibilitySettings()} />}
    </Card>
    {available && <Button title={t('screenTime.add')} icon="add" onPress={() => setAdding((x) => !x)} />}
    {adding && <Card className="gap-3">
      <Text weight="700">{t('screenTime.select')}</Text>
      <Row>{apps.data?.slice(0, 30).map((app: InstalledApp) => <Chip key={app.identifier} label={app.name} selected={identifier === app.identifier} onPress={() => { setName(app.name); setIdentifier(app.identifier); }} />)}</Row>
      <Field label={t('screenTime.name')} value={name} onChangeText={setName} />
      <Field label={t('screenTime.identifier')} value={identifier} onChangeText={setIdentifier} autoCapitalize="none" />
      <Text weight="700">{t('screenTime.limit')}</Text><Row>{[30, 60, 120].map((n) => <Chip key={n} label={t('screenTime.minutes', { count: n })} selected={limit === n} onPress={() => setLimit(n)} />)}</Row>
      <Text weight="700">{t('screenTime.duration')}</Text><Row><Chip label={t('screenTime.hour')} selected={duration === 60} onPress={() => setDuration(60)} /><Chip label={t('screenTime.twoHours')} selected={duration === 120} onPress={() => setDuration(120)} /></Row>
      <View className="flex-row items-center justify-between"><Text>{t('screenTime.commitment')}</Text><Switch value={commitment} onValueChange={setCommitment} trackColor={{ true: theme.primary }} /></View>
      <Text size="xs" muted>{t('screenTime.commitmentHint')}</Text>
      <Button title={t('screenTime.save')} disabled={!name.trim() || identifier.length < 3} loading={create.isPending} onPress={() => create.mutate()} />
    </Card>}
    <ErrorText message={create.error ? errorMessage(create.error, t) : toggle.error ? errorMessage(toggle.error, t) : block.error ? errorMessage(block.error, t) : remove.error ? errorMessage(remove.error, t) : null} />
    {!rules.data?.length && <Card><EmptyState icon="hourglass-outline" title={t('screenTime.empty')} /></Card>}
    {rules.data?.map((r) => <Card key={r.id} className="gap-3"><View className="flex-row justify-between"><Text weight="700">{r.app_name}</Text><Text size="sm" muted>{r.enabled ? t('screenTime.enabled') : t('screenTime.disabled')}</Text></View>
      <Text size="sm" muted>{t('screenTime.minutes', { count: r.daily_limit_minutes })} · {r.block_minutes === 60 ? t('screenTime.hour') : t('screenTime.twoHours')}</Text>
      {r.blocked_until && r.blocked_until > new Date().toISOString() && <Text size="sm" color={theme.primary}>{t('screenTime.activeUntil', { time: new Date(r.blocked_until).toLocaleTimeString() })}</Text>}
      <Row><Chip label={`${t('screenTime.today')}: ${t('screenTime.minutes', { count: aggregated(r, 1) })}`} selected onPress={() => {}} /><Chip label={`${t('screenTime.week')}: ${t('screenTime.minutes', { count: aggregated(r, 7) })}`} selected={false} onPress={() => {}} /></Row>
      {available && <Button title={t('screenTime.startBlock')} variant="ghost" onPress={() => block.mutate(r)} />}
      <Row><Chip label={r.enabled ? t('screenTime.pause') : t('screenTime.resume')} selected={false} onPress={() => toggle.mutate(r)} /><Chip label={t('screenTime.remove')} selected={false} onPress={() => remove.mutate(r)} /></Row>
    </Card>)}
    <SectionHeader title={t('screenTime.stats')} />
    {available && <Button title={t('screenTime.sync')} variant="ghost" onPress={() => void refreshUsage()} />}
    {!usage.data?.length && <Text size="sm" muted>{t('screenTime.unsupported')}</Text>}
    {usage.data?.slice(0, 14).map((row) => <Card key={`${row.app_identifier}-${row.used_on}`}><Text weight="600">{rules.data?.find((r) => r.app_identifier === row.app_identifier)?.app_name ?? row.app_identifier}</Text><Text size="sm" muted>{row.used_on} · {t('screenTime.minutes', { count: row.minutes })}</Text></Card>)}
  </Screen>;
}
