import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Rect } from 'react-native-svg';
import {
  Button, Card, EmptyState, ErrorState, ErrorText, FadeIn, Field, Header, Loading,
  Pill, ProgressBar, Row, Screen, SectionHeader, Segmented, StatTile, Text, success,
} from '../src/components/ui';
import { currentLocale, formatCurrency, formatNumber } from '../src/i18n';
import { pillarName } from '../src/i18n/helpers';
import { api } from '../src/lib/api';
import { prettyDate } from '../src/lib/dates';
import { errorMessage } from '../src/lib/errors';
import { currentMonthKey, shiftMonth } from '../src/lib/routineLogic';
import { useTheme } from '../src/theme/useTheme';

type TabKind = 'daily' | 'weekly' | 'monthly' | 'report';
type ReflectKind = 'weekly' | 'monthly';

type CurrentReview = {
  period_start: string;
  period_end: string;
  stats: Record<string, number>;
  review: { answers: Record<string, string>; next_priorities: string[] } | null;
};

type DailyReviewRow = {
  id: string;
  review_date: string;
  rating: number | null;
  wins?: string | null;
  lessons?: string | null;
  tomorrow_priorities?: string | null;
};
type DailyScheduleRow = { id: string; schedule_date: string; main_priority?: string | null };
type FoodLogRow = { id: string; logged_on: string; meal_type: string; description: string };
type ExpenseRow = { id: string; spent_on: string; amount: number; currency?: string };
type IncomeRow = { id: string; received_on: string; amount: number; currency?: string };

type MonthlyReportData = {
  month: string;
  month_start: string;
  month_end: string;
  days_in_month: number;
  display_name: string | null;
  currency: string;
  scorecard: {
    tasks_completed: number;
    prev_tasks_completed: number;
    tasks_delta: number;
    habit_rate_pct: number;
    prev_habit_rate_pct: number;
    habit_rate_delta: number;
    checkin_days: number;
    avg_rating: number | null;
    income: number;
    spent: number;
    net: number;
    savings_rate_pct: number | null;
    meals_logged: number;
    workouts: number;
    reading_minutes: number;
  };
  pillars: { id: string; name: string; score: number; events: number; neglected: boolean }[];
  areas: {
    worked_on: { id: string; name: string; events: number }[];
    needs_work: { id: string; name: string; events: number }[];
  };
  daily_heatmap: { date: string; day: number; activity_count: number; meals_count: number; rating: number | null }[];
  habits: { id: string; name: string; completed: number; due: number; rate_pct: number; best_streak: number }[];
  goals: { id: string; title: string; goal_type: string; status: string; progress_pct: number }[];
  finance: {
    income: number;
    spent: number;
    net: number;
    prev_income: number;
    prev_spent: number;
    prev_net: number;
    savings_rate_pct: number | null;
    categories: { category: string; spent: number; budget: number | null; over: boolean }[];
  };
  body_mind: {
    breakfast_days: number;
    lunch_days: number;
    dinner_days: number;
    total_meals: number;
    avg_water_ml: number;
    workouts: number;
    reading_minutes: number;
    screen_time_minutes: number;
  };
  transformation: { area_count: number; scores: { week_start: string; avg_score: number }[] };
  reflections: { wins: string[]; lessons: string[]; next_month_focus: string[] };
};

const QUESTION_KEYS: Record<ReflectKind, string[]> = {
  weekly: ['wins', 'challenges', 'lessons', 'adjust'],
  monthly: ['wins', 'missed', 'lessons', 'adjust'],
};

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(currentLocale(), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function PillarRadarChart({ pillars }: { pillars: MonthlyReportData['pillars'] }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const size = 210;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 76;
  const n = Math.max(pillars.length, 3);

  const pt = (idx: number, ratio: number) => {
    const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / n;
    return [cx + maxR * ratio * Math.cos(angle), cy + maxR * ratio * Math.sin(angle)] as const;
  };

  const ringPoints = (ratio: number) =>
    Array.from({ length: n }, (_, i) => pt(i, ratio).map((v) => v.toFixed(1)).join(',')).join(' ');

  const dataPoints = pillars
    .map((p, i) => pt(i, Math.max(0.1, Math.min(1, p.score / 100))).map((v) => v.toFixed(1)).join(','))
    .join(' ');

  return (
    <Card className="gap-3">
      <Text weight="600">{t('review.reportTab.radar')}</Text>
      {pillars.length > 0 ? (
        <View className="items-center">
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {[0.33, 0.66, 1].map((r) => (
              <Polygon key={r} points={ringPoints(r)} fill="none" stroke={theme.border} strokeWidth={1} />
            ))}
            {pillars.map((_, i) => {
              const [x2, y2] = pt(i, 1);
              return <Line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke={theme.border} strokeWidth={1} />;
            })}
            <Polygon
              points={dataPoints}
              fill={theme.primary}
              fillOpacity={0.22}
              stroke={theme.primary}
              strokeWidth={2}
            />
            {pillars.map((p, i) => {
              const [vx, vy] = pt(i, Math.max(0.1, Math.min(1, p.score / 100)));
              return <Circle key={p.id} cx={vx} cy={vy} r={4} fill={p.neglected ? theme.warning : theme.primary} />;
            })}
          </Svg>
        </View>
      ) : null}
      <View className="gap-2.5">
        {pillars.map((p) => (
          <View key={p.id} className="gap-1">
            <View className="flex-row items-center justify-between">
              <Text size="sm" weight="600">{pillarName(t, p.name)}</Text>
              <Text size="xs" muted>{p.score}%</Text>
            </View>
            <ProgressBar value={p.score / 100} tone={p.neglected ? 'warning' : 'success'} height={6} />
          </View>
        ))}
      </View>
    </Card>
  );
}

function MonthlyHeatmap({ days, totalDays }: { days: MonthlyReportData['daily_heatmap']; totalDays: number }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const cols = 7;
  const rows = Math.ceil(Math.max(days.length, 1) / cols);
  const cell = 28;
  const gap = 6;
  const width = cols * cell + (cols - 1) * gap;
  const height = rows * cell + (rows - 1) * gap;

  return (
    <Card className="gap-3">
      <Text weight="600">{t('review.reportTab.heatmap', { days: totalDays })}</Text>
      <View className="items-center">
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {days.map((d, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const x = col * (cell + gap);
            const y = row * (cell + gap);
            const score = d.activity_count + d.meals_count + (d.rating ? 1 : 0);
            const opacity = score === 0 ? 0.16 : score <= 2 ? 0.4 : score <= 5 ? 0.72 : 1;
            const fill = score === 0 ? theme.border : theme.primary;
            return <Rect key={d.date} x={x} y={y} width={cell} height={cell} rx={6} fill={fill} fillOpacity={opacity} />;
          })}
        </Svg>
      </View>
    </Card>
  );
}

function DailyHistoryTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const reviewsQ = useQuery({
    queryKey: ['daily-history', 'reviews'],
    queryFn: () => api<DailyReviewRow[]>('/daily-reviews?pageSize=60'),
  });
  const schedulesQ = useQuery({
    queryKey: ['daily-history', 'schedules'],
    queryFn: () => api<DailyScheduleRow[]>('/daily-schedules?pageSize=60'),
  });
  const foodQ = useQuery({
    queryKey: ['daily-history', 'food'],
    queryFn: () => api<FoodLogRow[]>('/food-logs?pageSize=120'),
  });
  const expensesQ = useQuery({
    queryKey: ['daily-history', 'expenses'],
    queryFn: () => api<ExpenseRow[]>('/expenses?pageSize=120'),
  });
  const incomeQ = useQuery({
    queryKey: ['daily-history', 'income'],
    queryFn: () => api<IncomeRow[]>('/income?pageSize=120'),
  });

  const timeline = useMemo(() => {
    const map = new Map<string, {
      date: string;
      rating: number | null;
      priority: string | null;
      wins: string | null;
      lessons: string | null;
      tomorrow: string | null;
      meals: number;
      spent: number;
      income: number;
      currency: string;
    }>();
    const ensure = (date: string) => {
      let item = map.get(date);
      if (!item) {
        item = {
          date, rating: null, priority: null, wins: null, lessons: null, tomorrow: null,
          meals: 0, spent: 0, income: 0, currency: 'XAF',
        };
        map.set(date, item);
      }
      return item;
    };
    for (const r of reviewsQ.data ?? []) {
      const e = ensure(String(r.review_date).slice(0, 10));
      e.rating = r.rating;
      e.wins = r.wins?.trim() || e.wins;
      e.lessons = r.lessons?.trim() || e.lessons;
      e.tomorrow = r.tomorrow_priorities?.trim() || e.tomorrow;
    }
    for (const s of schedulesQ.data ?? []) {
      const e = ensure(String(s.schedule_date).slice(0, 10));
      if (s.main_priority?.trim()) e.priority = s.main_priority.trim();
    }
    for (const f of foodQ.data ?? []) {
      ensure(String(f.logged_on).slice(0, 10)).meals += 1;
    }
    for (const ex of expensesQ.data ?? []) {
      const e = ensure(String(ex.spent_on).slice(0, 10));
      e.spent += Number(ex.amount || 0);
      if (ex.currency) e.currency = ex.currency;
    }
    for (const inc of incomeQ.data ?? []) {
      const e = ensure(String(inc.received_on).slice(0, 10));
      e.income += Number(inc.amount || 0);
      if (inc.currency) e.currency = inc.currency;
    }
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 45);
  }, [reviewsQ.data, schedulesQ.data, foodQ.data, expensesQ.data, incomeQ.data]);

  const loading = reviewsQ.isLoading || schedulesQ.isLoading;
  if (loading) return <Loading />;

  return (
    <View className="gap-3">
      <SectionHeader title={t('review.dailyHistory.title')} />
      <Text size="sm" muted>{t('review.dailyHistory.subtitle')}</Text>
      <Row gap={8}>
        <View className="flex-1">
          <Button title={t('review.dailyHistory.openMorning')} variant="ghost" onPress={() => router.push('/morning-plan')} />
        </View>
        <View className="flex-1">
          <Button title={t('review.dailyHistory.openCheckin')} variant="ghost" onPress={() => router.push('/evening-checkin')} />
        </View>
      </Row>
      {timeline.length === 0 ? (
        <EmptyState
          icon="leaf-outline"
          title={t('review.dailyHistory.emptyTitle')}
          body={t('review.dailyHistory.emptyBody')}
          action={t('review.dailyHistory.openCheckin')}
          onAction={() => router.push('/evening-checkin')}
        />
      ) : (
        timeline.map((day) => (
          <Card key={day.date} className="gap-2">
            <View className="flex-row items-center justify-between gap-2">
              <Text weight="600">{prettyDate(day.date)}</Text>
              {day.rating != null ? <Pill label={t('review.dailyHistory.rating', { n: day.rating })} tone="success" /> : null}
            </View>
            <Row gap={6}>
              {day.meals > 0 ? <Pill label={t('review.dailyHistory.meals', { n: day.meals })} tone="info" /> : null}
              {day.spent > 0 ? <Pill label={t('review.dailyHistory.spent', { amount: formatCurrency(day.spent, day.currency) })} tone="warning" /> : null}
              {day.income > 0 ? <Pill label={t('review.dailyHistory.income', { amount: formatCurrency(day.income, day.currency) })} tone="success" /> : null}
            </Row>
            {day.priority ? <Text size="sm" weight="600">{t('review.dailyHistory.priority', { text: day.priority })}</Text> : null}
            {day.wins ? <Text size="sm">{t('review.dailyHistory.wins', { text: day.wins })}</Text> : null}
            {day.lessons ? <Text size="sm" muted>{t('review.dailyHistory.lessons', { text: day.lessons })}</Text> : null}
            {day.tomorrow ? <Text size="sm" muted>{t('review.dailyHistory.tomorrow', { text: day.tomorrow })}</Text> : null}
          </Card>
        ))
      )}
    </View>
  );
}

function MonthlyReportTab() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [month, setMonth] = useState(() => currentMonthKey());
  const [pdfErr, setPdfErr] = useState<string | null>(null);

  const reportQ = useQuery({
    queryKey: ['monthly-report', month],
    queryFn: () => api<MonthlyReportData>(`/reports/monthly/${month}`),
  });

  const downloadPdf = useMutation({
    mutationFn: async () => {
      const lang = i18n.language === 'fr' ? 'fr' : 'en';
      const res = await api<{ url: string }>(`/reports/monthly/${month}/download-link?lang=${lang}`, { method: 'POST' });
      await Linking.openURL(res.url);
    },
    onMutate: () => setPdfErr(null),
    onSuccess: () => success(),
    onError: (e) => setPdfErr(errorMessage(e, t) || t('review.reportTab.pdfError')),
  });

  const renderFocusItem = (code: string): string => {
    if (code.startsWith('pillar:')) return t('review.reportTab.focusPillar', { v: pillarName(t, code.slice(7)) });
    if (code.startsWith('habit:')) {
      const rest = code.slice(6);
      const lastColon = rest.lastIndexOf(':');
      const name = lastColon > 0 ? rest.slice(0, lastColon) : rest;
      const pct = lastColon > 0 ? rest.slice(lastColon + 1) : '0';
      return t('review.reportTab.focusHabit', { v: name, pct });
    }
    if (code.startsWith('budget:')) {
      const cat = code.slice(7).toLowerCase();
      return t('review.reportTab.focusBudget', { v: t(`modules.opt.${cat}`, { defaultValue: cat }) });
    }
    if (code === 'meals:breakfast') return t('review.reportTab.focusMeals');
    return t('review.reportTab.focusCheckin');
  };

  const d = reportQ.data;
  const maxMonth = currentMonthKey();

  return (
    <View className="gap-4">
      <Card className="flex-row items-center justify-between gap-2">
        <Pressable
          accessibilityLabel={t('review.reportTab.prevMonth')}
          onPress={() => setMonth((m) => shiftMonth(m, -1))}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface-alt"
        >
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </Pressable>
        <View className="flex-1 items-center">
          <Text weight="700" size="md">{formatMonthLabel(month)}</Text>
          <Text size="xs" muted>{t('review.reportTab.subtitle')}</Text>
        </View>
        <Pressable
          accessibilityLabel={t('review.reportTab.nextMonth')}
          disabled={month >= maxMonth}
          onPress={() => setMonth((m) => (m >= maxMonth ? m : shiftMonth(m, 1)))}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface-alt"
          style={{ opacity: month >= maxMonth ? 0.4 : 1 }}
        >
          <Ionicons name="chevron-forward" size={20} color={theme.text} />
        </Pressable>
      </Card>

      <Button
        title={downloadPdf.isPending ? t('review.reportTab.downloading') : t('review.reportTab.downloadPdf')}
        loading={downloadPdf.isPending}
        onPress={() => downloadPdf.mutate()}
      />
      <ErrorText message={pdfErr} />

      {reportQ.isLoading ? <Loading /> : reportQ.error || !d ? (
        <ErrorState message={(reportQ.error as Error)?.message ?? t('review.loadError')} onRetry={() => void reportQ.refetch()} />
      ) : (
        <>
          <View className="flex-row flex-wrap gap-[14px]">
            <View className="w-[47%]">
              <StatTile
                label={t('review.tasksDone')}
                value={String(d.scorecard.tasks_completed)}
                icon="checkmark-done-outline"
              />
            </View>
            <View className="w-[47%]">
              <StatTile
                label={t('review.habitCheckins')}
                value={`${d.scorecard.habit_rate_pct}%`}
                icon="repeat-outline"
              />
            </View>
            <View className="w-[47%]">
              <StatTile
                label={t('review.reportTab.net')}
                value={formatCurrency(d.finance.net, d.currency)}
                icon="wallet-outline"
              />
            </View>
            <View className="w-[47%]">
              <StatTile
                label={t('review.workouts')}
                value={String(d.scorecard.workouts)}
                icon="fitness-outline"
              />
            </View>
          </View>

          <Row gap={8}>
            <Pill
              label={t('review.reportTab.tasksDelta', { n: `${d.scorecard.tasks_delta >= 0 ? '+' : ''}${d.scorecard.tasks_delta}` })}
              tone={d.scorecard.tasks_delta >= 0 ? 'success' : 'warning'}
            />
            <Pill label={t('review.reportTab.checkinDays', { n: d.scorecard.checkin_days })} tone="info" />
          </Row>

          <PillarRadarChart pillars={d.pillars} />

          <Card className="gap-3">
            <Text weight="600">{t('review.reportTab.workedOn')}</Text>
            {d.areas.worked_on.length === 0 ? (
              <Text size="sm" muted>{t('review.reportTab.noActivity')}</Text>
            ) : (
              <Row gap={6}>
                {d.areas.worked_on.map((a) => (
                  <Pill key={a.id} label={`${a.name} (${a.events})`} tone="success" />
                ))}
              </Row>
            )}
            <Text weight="600" style={{ marginTop: 6 }}>{t('review.reportTab.needsFocus')}</Text>
            {d.areas.needs_work.length === 0 ? (
              <Text size="sm" muted>{t('review.reportTab.allBalanced')}</Text>
            ) : (
              <Row gap={6}>
                {d.areas.needs_work.map((a) => (
                  <Pill key={a.id} label={`${a.name} (${a.events})`} tone="warning" />
                ))}
              </Row>
            )}
          </Card>

          <MonthlyHeatmap days={d.daily_heatmap} totalDays={d.days_in_month} />

          {d.habits.length > 0 ? (
            <Card className="gap-2.5">
              <Text weight="600">{t('review.reportTab.habits')}</Text>
              {d.habits.slice(0, 6).map((h) => (
                <View key={h.id} className="gap-1">
                  <View className="flex-row justify-between">
                    <Text size="sm">{h.name}</Text>
                    <Text size="xs" muted>{h.completed}/{h.due} ({h.rate_pct}%)</Text>
                  </View>
                  <ProgressBar value={h.rate_pct / 100} tone={h.rate_pct >= 70 ? 'success' : 'warning'} height={6} />
                </View>
              ))}
            </Card>
          ) : null}

          {d.goals.length > 0 ? (
            <Card className="gap-2.5">
              <Text weight="600">{t('review.reportTab.goals')}</Text>
              {d.goals.slice(0, 6).map((g) => (
                <View key={g.id} className="gap-1">
                  <View className="flex-row justify-between">
                    <Text size="sm">{g.title}</Text>
                    <Text size="xs" muted>{Math.round(g.progress_pct)}%</Text>
                  </View>
                  <ProgressBar value={g.progress_pct / 100} tone="info" height={6} />
                </View>
              ))}
            </Card>
          ) : null}

          <Card className="gap-2.5">
            <Text weight="600">{t('review.reportTab.finance')}</Text>
            <Row gap={8}>
              <Pill label={`${t('review.reportTab.income')}: ${formatCurrency(d.finance.income, d.currency)}`} tone="success" />
              <Pill label={`${t('review.reportTab.spent')}: ${formatCurrency(d.finance.spent, d.currency)}`} tone="warning" />
            </Row>
            {d.finance.categories.slice(0, 5).map((c) => {
              const ratio = c.budget && c.budget > 0 ? c.spent / c.budget : 1;
              return (
                <View key={c.category} className="gap-1">
                  <View className="flex-row justify-between">
                    <Text size="sm">{t(`modules.opt.${c.category.toLowerCase()}`, { defaultValue: c.category })}</Text>
                    <Text size="xs" muted>{formatCurrency(c.spent, d.currency)}</Text>
                  </View>
                  <ProgressBar value={Math.min(1, ratio)} tone={c.over ? 'error' : 'info'} height={6} />
                </View>
              );
            })}
          </Card>

          <Card className="gap-2">
            <Text weight="600">{t('review.reportTab.bodyMind')}</Text>
            <Row gap={8}>
              <Pill label={`${t('review.reportTab.breakfastDays')}: ${d.body_mind.breakfast_days}`} tone="info" />
              <Pill label={`${t('review.reportTab.lunchDays')}: ${d.body_mind.lunch_days}`} tone="info" />
              <Pill label={`${t('review.reportTab.dinnerDays')}: ${d.body_mind.dinner_days}`} tone="info" />
              <Pill label={`${t('review.reportTab.readingMin')}: ${formatNumber(d.body_mind.reading_minutes)}`} tone="success" />
              <Pill label={`${t('review.reportTab.waterAvg')}: ${formatNumber(d.body_mind.avg_water_ml)}`} tone="info" />
            </Row>
          </Card>

          {d.reflections.next_month_focus.length > 0 ? (
            <Card className="gap-2">
              <Text weight="600">{t('review.reportTab.nextFocus')}</Text>
              {d.reflections.next_month_focus.map((code) => (
                <View key={code} className="flex-row items-start gap-2">
                  <Ionicons name="compass-outline" size={16} color={theme.primary} style={{ marginTop: 2 }} />
                  <Text size="sm" style={{ flex: 1 }}>{renderFocusItem(code)}</Text>
                </View>
              ))}
            </Card>
          ) : null}

          <Button
            title={downloadPdf.isPending ? t('review.reportTab.downloading') : t('review.reportTab.downloadPdf')}
            loading={downloadPdf.isPending}
            onPress={() => downloadPdf.mutate()}
          />
        </>
      )}
    </View>
  );
}

export default function Review() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab: TabKind =
    params.tab === 'report' || params.tab === 'daily' || params.tab === 'monthly' || params.tab === 'weekly'
      ? params.tab
      : 'weekly';

  const [tab, setTab] = useState<TabKind>(initialTab);
  const reflectKind: ReflectKind = tab === 'monthly' ? 'monthly' : 'weekly';

  const q = useQuery({
    queryKey: ['review', reflectKind],
    queryFn: () => api<CurrentReview>(`/reviews/${reflectKind}/current`),
    enabled: tab === 'weekly' || tab === 'monthly',
  });

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [prios, setPrios] = useState(['', '', '']);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setAnswers(q.data?.review?.answers ?? {});
    const p = q.data?.review?.next_priorities ?? [];
    setPrios([p[0] ?? '', p[1] ?? '', p[2] ?? '']);
    setSaved(false);
    setErr(null);
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      api(`/reviews/${reflectKind}/${q.data!.period_start}`, {
        method: 'PUT',
        body: { answers, next_priorities: prios.map((p) => p.trim()).filter(Boolean) },
      }),
    onSuccess: () => {
      success();
      setSaved(true);
      void qc.invalidateQueries({ queryKey: ['review', reflectKind] });
    },
    onError: (e) => setErr((e as Error).message),
  });

  const s = q.data?.stats;

  const handleRefresh = () => {
    if (tab === 'daily') void qc.invalidateQueries({ queryKey: ['daily-history'] });
    else if (tab === 'report') void qc.invalidateQueries({ queryKey: ['monthly-report'] });
    else void q.refetch();
  };

  return (
    <Screen bottomPad={40} onRefresh={handleRefresh} refreshing={q.isRefetching}>
      <Header title={t('review.title')} subtitle={t('review.subtitle')} back />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'daily', label: t('review.tabs.daily') },
          { value: 'weekly', label: t('review.tabs.week') },
          { value: 'monthly', label: t('review.tabs.month') },
          { value: 'report', label: t('review.tabs.report') },
        ]}
      />
      {tab === 'daily' ? (
        <DailyHistoryTab />
      ) : tab === 'report' ? (
        <MonthlyReportTab />
      ) : q.isLoading ? (
        <Loading />
      ) : q.error || !q.data ? (
        <ErrorState message={(q.error as Error)?.message ?? t('review.loadError')} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <Text size="sm" muted>{t('review.period', { start: q.data.period_start, end: q.data.period_end })}</Text>
          <SectionHeader title={t('review.numbers')} />
          <View className="flex-row flex-wrap gap-[16px]">
            {[
              [t('review.tasksDone'), s!.tasks_completed, 'checkmark-done-outline'],
              [t('review.habitCheckins'), s!.habit_checkins, 'repeat-outline'],
              [t('review.workouts'), s!.workouts, 'fitness-outline'],
              [t('review.readingMin'), s!.reading_minutes, 'book-outline'],
            ].map(([l, v, i]) => (
              <View key={String(l)} className="w-[47%]">
                <StatTile label={String(l)} value={String(v)} icon={i as keyof typeof Ionicons.glyphMap} />
              </View>
            ))}
          </View>
          <SectionHeader title={t('review.reflect')} />
          {q.data.review && <Pill label={t('review.savedNote')} tone="success" />}
          {QUESTION_KEYS[reflectKind].map((key, i) => (
            <FadeIn key={key} delay={i * 40}>
              <Field
                label={t(`review.${reflectKind === 'weekly' ? 'weeklyQ' : 'monthlyQ'}.${key}`)}
                multiline
                value={answers[key] ?? ''}
                onChangeText={(v) => {
                  setAnswers((a) => ({ ...a, [key]: v }));
                  setSaved(false);
                }}
              />
            </FadeIn>
          ))}
          <SectionHeader title={t('review.next')} />
          <Card className="gap-[16px]">
            {prios.map((p, i) => (
              <Field
                key={i}
                label={t('review.priorityN', { n: i + 1 })}
                value={p}
                onChangeText={(v) => setPrios((x) => x.map((y, j) => (j === i ? v : y)))}
              />
            ))}
          </Card>
          <ErrorText message={err} />
          <Button title={saved ? t('review.saved') : t('review.save')} loading={save.isPending} onPress={() => save.mutate()} />
        </>
      )}
    </Screen>
  );
}
