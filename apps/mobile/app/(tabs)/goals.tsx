import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { GoalRow } from '../../src/components/domain';
import { FirstVisitTip } from '../../src/components/Tutorial';
import { Chip, EmptyState, ErrorState, FadeIn, Header, Loading, Screen, SectionHeader } from '../../src/components/ui';
import { errorMessage } from '../../src/lib/errors';
import { useGoalsOverview } from '../../src/lib/hooks';

const ORDER = ['long_term', 'annual', 'quarterly', 'monthly', 'weekly', 'daily'];

export default function Goals() {
  const router = useRouter();
  const { t: tr } = useTranslation();
  const q = useGoalsOverview();
  const [filter, setFilter] = useState<string>('all');

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <Screen><ErrorState message={q.error ? errorMessage(q.error, tr) : tr('goals.loadError')} onRetry={() => void q.refetch()} /></Screen>;
  const goals = q.data.filter((g) => g.status !== 'abandoned');
  const shown = goals.filter((g) => filter === 'all' || g.goal_type === filter);
  const open = shown.filter((g) => g.status !== 'completed');
  const done = shown.filter((g) => g.status === 'completed');
  const types = ORDER.filter((t) => open.some((g) => g.goal_type === t));

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching} bottomPad={130}>
      <FirstVisitTip screen="goals" />
      <Header title={tr('goals.title')} subtitle={tr('goals.subtitle')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        <Chip label={tr('goals.all')} selected={filter === 'all'} onPress={() => setFilter('all')} />
        {ORDER.map((t) => <Chip key={t} label={tr(`domain.goalType.${t}`)} selected={filter === t} onPress={() => setFilter(t)} />)}
      </ScrollView>

      {goals.length === 0 ? (
        <EmptyState icon="flag-outline" title={tr('goals.emptyTitle')} body={tr('goals.emptyBody')} action={tr('goals.create')} onAction={() => router.push('/new-goal')} />
      ) : shown.length === 0 ? (
        <EmptyState icon="funnel-outline" title={tr('goals.filteredTitle')} body={tr('goals.filteredBody')} action={tr('goals.add')} onAction={() => router.push('/new-goal')} />
      ) : (
        <>
          {types.map((type, i) => (
            <FadeIn key={type} delay={i * 60}>
              <View className="gap-[12px]">
                <SectionHeader title={tr(`domain.goalType.${type}`)} />
                {open.filter((g) => g.goal_type === type).map((g) => <GoalRow key={g.id} goal={g} />)}
              </View>
            </FadeIn>
          ))}
          {done.length > 0 && (
            <View className="gap-[12px]">
              <SectionHeader title={tr('goals.completed')} />
              {done.map((g) => <GoalRow key={g.id} goal={g} />)}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
