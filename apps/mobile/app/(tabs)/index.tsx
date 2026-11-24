import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { BalanceBar, GoalRow, InsightCard } from '../../src/components/domain';
import { FirstVisitTip } from '../../src/components/Tutorial';
import {
  Card, Check, EmptyState, ErrorState, FadeIn, Hero, IconBadge, Loading, Pill, Press, ProgressBar, ProgressRing, Screen, SectionHeader, Text,
} from '../../src/components/ui';
import { prettyDate } from '../../src/lib/dates';
import { errorMessage } from '../../src/lib/errors';
import { useEveningCheckinState } from '../../src/lib/eveningCheckin';
import { isInEveningWindow, localDateKey } from '../../src/lib/eveningCheckinLogic';
import { useDashboard, useToggleHabit, useToggleTask } from '../../src/lib/hooks';
import { spacing } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/useTheme';

export default function Home() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const q = useDashboard();
  const toggleTask = useToggleTask();
  const toggleHabit = useToggleHabit();
  const evening = useEveningCheckinState();

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <Screen><ErrorState message={q.error ? errorMessage(q.error, tr) : tr('home.loadError')} onRetry={() => void q.refetch()} /></Screen>;
  const d = q.data;
  const now = new Date();
  const hour = now.getHours();
  const eveningDone = evening.doneDate === localDateKey(now);
  const eveningOpen = isInEveningWindow(now, evening.time);
  const hello = tr(hour < 12 ? 'home.morning' : hour < 18 ? 'home.afternoon' : 'home.evening');
  const intentions = tr('home.intentions', { returnObjects: true }) as unknown as string[];
  const intention = intentions[Math.floor(Date.now() / 86_400_000) % intentions.length];
  const hasData = d.priorities.length + d.habits.length + d.goals.length > 0;
  const setup = [
    { key: 'profile', done: true }, { key: 'goal', done: d.goals.length > 0 }, { key: 'habit', done: d.habits.length > 0 },
    { key: 'money', done: false }, { key: 'pin', done: true },
  ] as const;
  const setupDone = setup.filter((item) => item.done).length;

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching} bottomPad={130}>
      <FirstVisitTip screen="home" />
      <FadeIn>
        <Hero>
          <View className="flex-row items-center gap-[16px]">
            <View className="flex-1 gap-[4px]">
              <Text size="xs" color="#C9A24B" weight="600" style={{ letterSpacing: 1.6 }}>{prettyDate(d.date).toUpperCase()}</Text>
              <Text size="xl" serif color="#FFFFFF">{tr('home.greeting', { greeting: hello, name: d.display_name ?? tr('home.there') })}</Text>
              <Text size="sm" color="#C9D6E3">
                {d.summary.tasks_open > 0 ? tr('home.toDo', { count: d.summary.tasks_open }) : tr('home.nothingPending')} · {tr('home.habitsProgress', { done: d.summary.habits_done, due: d.summary.habits_due })}
              </Text>
            </View>
            <ProgressRing value={(d.momentum ?? 0) / 100} size={104} count={d.momentum} label="–" sublabel={tr('home.momentum')}
              trackColor="rgba(255,255,255,0.16)" color="#2DD4BF" textColor="#FFFFFF" />
          </View>
          <View className="mt-4 border-t border-white/10 pt-4">
            <Text size="sm" color="#E9D9A6" style={{ fontStyle: 'italic', fontFamily: 'PlayfairDisplay_600SemiBold' }}>“{intention}”</Text>
          </View>
        </Hero>
      </FadeIn>
      {d.momentum === null && <Text size="xs" muted>{tr('home.momentumHint')}</Text>}

      {setupDone < setup.length && <Card className="gap-3">
        <View className="flex-row items-center justify-between"><Text weight="700">{tr('tutorial.checklist.title')}</Text><Pill label={tr('tutorial.checklist.body', { done: setupDone, total: setup.length })} tone="accent" /></View>
        <ProgressBar value={setupDone / setup.length} tone="accent" />
        {setup.map((item) => <View key={item.key} className="flex-row items-center gap-3"><Ionicons name={item.done ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={item.done ? t.success : t.border} /><Text size="sm" muted={!item.done}>{tr(`tutorial.checklist.${item.key}`)}</Text></View>)}
      </Card>}

      {!hasData && (
        <Card><EmptyState icon="rocket-outline" title={tr('home.emptyTitle')} body={tr('home.emptyBody')} /></Card>
      )}

      {d.insights.length > 0 && (
        <FadeIn delay={80}>
          <SectionHeader title={tr('home.insights')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} snapToInterval={Math.min(300, width - 56) + 12} decelerationRate="fast"
            contentContainerStyle={{ gap: 12, paddingVertical: 4, paddingRight: 8 }}>
            {d.insights.map((i) => <InsightCard key={i.id} insight={i} width={Math.min(300, width - 56)} />)}
          </ScrollView>
        </FadeIn>
      )}

      <FadeIn delay={100}>
        <Card onPress={() => router.push('/evening-checkin')} className="flex-row items-center gap-3">
          <IconBadge icon={eveningDone ? 'checkmark-circle' : 'moon'} tone={eveningDone ? 'success' : eveningOpen ? 'accent' : 'info'} size={40} />
          <View className="flex-1">
            <Text weight="600">{tr('home.rundownTitle')}</Text>
            <Text size="xs" muted>
              {eveningDone
                ? tr('home.rundownDone')
                : eveningOpen
                  ? tr('home.rundownOpen')
                  : tr('home.rundownSoon', { time: evening.time })}
            </Text>
          </View>
          {eveningDone ? (
            <Pill label={tr('home.rundownDonePill')} tone="success" />
          ) : eveningOpen ? (
            <Pill label={tr('home.rundownNowPill')} tone="accent" />
          ) : (
            <Ionicons name="chevron-forward" size={18} color={t.textSecondary} />
          )}
        </Card>
      </FadeIn>

      <FadeIn delay={120}>
        <Press onPress={() => router.push('/coach')}>
          <LinearGradient colors={['#0F766E', '#14B8A6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ borderRadius: 20, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Ionicons name="sparkles" size={26} color="#FFFFFF" />
            <View className="flex-1">
              <Text weight="600" color="#FFFFFF">{tr('home.coachTitle')}</Text>
              <Text size="xs" color="#E6FFFB">{d.ai_enabled ? tr('home.coachOn') : tr('home.coachOff')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </LinearGradient>
        </Press>
      </FadeIn>

      <SectionHeader title={tr('home.priorities')} action={tr('home.planner')} onAction={() => router.push('/planner')} />
      <Card>
        {d.priorities.length === 0 ? (
          <EmptyState icon="checkmark-done-outline" title={tr('home.allClearTitle')} body={tr('home.allClearBody')} />
        ) : d.priorities.map((task) => (
          <View key={task.id} className="flex-row items-center gap-[16px] py-[4px]">
            <Check checked={false} label={tr('home.complete', { title: task.title })} onPress={() => toggleTask.mutate({ id: task.id, completed: true })} />
            <View className="flex-1">
              <Text numberOfLines={2}>{task.title}</Text>
              {task.overdue ? <Text size="xs" color={t.error}>{tr('home.overdue', { date: task.due_date })}</Text> : null}
            </View>
            {task.priority === 'high' ? <Pill label={tr('domain.priority.high')} tone="error" /> : null}
          </View>
        ))}
      </Card>

      <SectionHeader title={tr('home.habits')} />
      <Card>
        {d.habits.length === 0 ? (
          <EmptyState icon="repeat" title={tr('home.noHabitsTitle')} body={tr('home.noHabitsBody')} />
        ) : d.habits.map((h) => {
          const risky = h.stats.lapse_risk !== null && h.stats.lapse_risk >= 0.5 && !h.stats.completed_today;
          return (
            <View key={h.id} className="flex-row items-center gap-[16px] py-[4px]">
              <Check checked={h.stats.completed_today} label={tr('home.habitLabel', { name: h.name })}
                onPress={() => toggleHabit.mutate({ id: h.id, date: d.date, done: !h.stats.completed_today })} />
              <View className="flex-1">
                <Text weight="500">{h.name}</Text>
                <Text size="xs" muted>
                  {h.stats.streak > 0 ? `${tr(`domain.streak_${h.stats.streak_unit}`, { count: h.stats.streak })} · ` : ''}{tr('home.overDays', { pct: Math.round(h.stats.rate30 * 100) })}
                </Text>
              </View>
              {risky ? <Pill label={tr('home.atRisk')} tone="warning" /> : h.stats.streak >= 3 ? <Ionicons name="flame" size={20} color={t.accent} /> : null}
            </View>
          );
        })}
      </Card>

      {d.goals.length > 0 && (
        <>
          <SectionHeader title={tr('home.goalProgress')} action={tr('home.allGoals')} onAction={() => router.push('/goals')} />
          {d.goals.slice(0, 4).map((g) => <GoalRow key={g.id} goal={g} />)}
        </>
      )}

      {d.balance.total_events > 0 && (
        <>
          <SectionHeader title={tr('home.balance')} />
          <Card className="gap-[16px]">
            {d.balance.pillars.map((p) => <BalanceBar key={p.pillar_id} pillar={p} />)}
            <Text size="xs" muted>{tr('home.balanceNote')}</Text>
          </Card>
        </>
      )}
    </Screen>
  );
}
