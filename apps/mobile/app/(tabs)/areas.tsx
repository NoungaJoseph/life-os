import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Switch, View } from 'react-native';
import { BalanceBar } from '../../src/components/domain';
import { areaText, pillarName } from '../../src/i18n/helpers';
import { errorMessage } from '../../src/lib/errors';
import { GROUPS, MODULES } from '../../src/lib/modules';
import { Card, ErrorState, IconBadge, Press, FadeIn, Header, Loading, Pill, Screen, SectionHeader, Text } from '../../src/components/ui';
import { api } from '../../src/lib/api';
import { useInsights } from '../../src/lib/hooks';
import { LifeArea, UserLifeArea } from '../../src/lib/types';
import { spacing } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/useTheme';

type AreaRow = LifeArea & { life_area_pillars?: { pillar_id: string }[] };

export default function Areas() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const router = useRouter();
  const insights = useInsights();
  const areas = useQuery({ queryKey: ['areas'], queryFn: () => api<AreaRow[]>('/life-areas') });
  const mine = useQuery({ queryKey: ['userAreas'], queryFn: () => api<UserLifeArea[]>('/me/life-areas') });
  const toggle = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => api(`/me/life-areas/${id}`, { method: 'PUT', body: { is_active } }),
    onSettled: () => { void mine.refetch(); },
  });

  if (areas.isLoading || mine.isLoading || insights.isLoading) return <Loading />;
  const err = (areas.error ?? mine.error ?? insights.error) as Error | null;
  if (err || !areas.data || !mine.data) return <Screen><ErrorState message={err ? errorMessage(err, tr) : tr('areas.loadError')} onRetry={() => { void areas.refetch(); void mine.refetch(); void insights.refetch(); }} /></Screen>;

  const active = new Map(mine.data.map((m) => [m.life_area_id, m.is_active]));
  const pillars = insights.data?.balance.pillars ?? [];
  const pending = toggle.isPending ? toggle.variables : undefined;

  return (
    <Screen bottomPad={130} onRefresh={() => { void areas.refetch(); void mine.refetch(); void insights.refetch(); }} refreshing={insights.isRefetching}>
      <Header title={tr('areas.title')} subtitle={tr('areas.subtitle')} />

      <SectionHeader title={tr('areas.tools')} />
      <Card onPress={() => router.push('/finance')} className="flex-row items-center gap-[16px]">
        <IconBadge icon="stats-chart-outline" tone="accent" />
        <View className="flex-1"><Text weight="600">{tr('areas.financeTitle')}</Text><Text size="sm" muted>{tr('areas.financeBody')}</Text></View>
      </Card>
      <Card onPress={() => router.push('/debts')} className="flex-row items-center gap-[16px]">
        <IconBadge icon="card-outline" tone="warning" />
        <View className="flex-1"><Text weight="600">{tr('areas.debtsTitle')}</Text><Text size="sm" muted>{tr('areas.debtsBody')}</Text></View>
      </Card>
      <Card onPress={() => router.push('/review')} className="flex-row items-center gap-[16px]">
        <IconBadge icon="calendar-number-outline" tone="info" />
        <View className="flex-1"><Text weight="600">{tr('areas.reviewTitle')}</Text><Text size="sm" muted>{tr('areas.reviewBody')}</Text></View>
      </Card>
      {GROUPS.map((g) => (
        <View key={g} className="gap-[8px]">
          <Text size="sm" weight="600" muted>{tr(g)}</Text>
          {MODULES.filter((m) => m.group === g && m.key !== 'savings-goals').map((m) => (
            <Card key={m.key} onPress={() => router.push(`/module/${m.key}`)} className="flex-row items-center gap-[16px]">
              <IconBadge icon={m.icon} tone="neutral" size={36} />
              <View className="flex-1"><Text weight="600">{tr(m.title)}</Text><Text size="sm" muted>{tr(m.subtitle)}</Text></View>
            </Card>
          ))}
        </View>
      ))}

      <SectionHeader title={tr('areas.pillarBalance')} />
      <Card className="gap-[16px]">
        {pillars.length === 0 ? <Text size="sm" muted>{tr('areas.noPillars')}</Text> : pillars.map((p) => <BalanceBar key={p.pillar_id} pillar={p} />)}
        <Text size="xs" muted>{tr('areas.pillarNote')}</Text>
      </Card>

      <SectionHeader title={tr('areas.yourAreas')} />
      {areas.data.map((a, i) => {
        const on = pending?.id === a.id ? pending.is_active : active.get(a.id) ?? false;
        const txt = areaText(tr, a);
        const linked = pillars.filter((p) => a.life_area_pillars?.some((x) => x.pillar_id === p.pillar_id));
        return (
          <FadeIn key={a.id} delay={i * 30}>
            <Card className={on ? '' : 'opacity-70'}>
              <View className="flex-row items-center gap-[16px]">
                <View className="flex-1 gap-[2px]">
                  <Text weight="600">{txt.name}</Text>
                  {txt.description ? <Text size="sm" muted>{txt.description}</Text> : null}
                </View>
                <Switch accessibilityLabel={tr('areas.activeLabel', { name: txt.name })} value={on} trackColor={{ true: t.primary, false: t.border }}
                  onValueChange={(v) => toggle.mutate({ id: a.id, is_active: v })} />
              </View>
              {linked.length > 0 && <View className="flex-row flex-wrap gap-[6px]">{linked.map((p) => <Pill key={p.pillar_id} label={pillarName(tr, p.name)} tone="neutral" />)}</View>}
            </Card>
          </FadeIn>
        );
      })}
    </Screen>
  );
}
