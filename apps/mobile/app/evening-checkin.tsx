import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { MoneyField } from '../src/components/MoneyField';
import {
  Button, Card, Check, Chip, EmptyState, ErrorState, ErrorText, Field, Header, Hero, Loading, Pill, ProgressBar, Row, Screen, SectionHeader, Text, success,
} from '../src/components/ui';
import { currencyLabel, formatNumber } from '../src/i18n';
import { api } from '../src/lib/api';
import { addDays, prettyDate } from '../src/lib/dates';
import { errorMessage } from '../src/lib/errors';
import { markEveningCheckinDone } from '../src/lib/eveningCheckin';
import { localDateKey } from '../src/lib/eveningCheckinLogic';
import { useDashboard, useGoalsOverview, useRefreshAll, useToggleHabit, useToggleTask } from '../src/lib/hooks';
import { categoryLabel } from '../src/lib/modules';
import { parseMoneyInput } from '../src/lib/moneyInput';
import { GoalView, Task } from '../src/lib/types';
import { useTheme } from '../src/theme/useTheme';

type ExpenseRow = { id: string; amount: number; category: string; description: string | null; currency?: string; spent_on: string };
type IncomeRow = { id: string; amount: number; source: string | null; category: string | null; currency?: string; received_on: string };
type DailyReviewRow = { id: string; review_date: string; wins: string | null; lessons: string | null; tomorrow_priorities: string | null; rating: number | null };
type FoodLogRow = { id: string; meal_type: string; description: string };
type CalendarEventRow = { id: string; title: string; starts_at: string; location?: string | null };
type MealPlanRow = { id: string; meal_type: string; custom_name: string | null };

const EXPENSE_CATS = ['food', 'transport', 'housing', 'bills', 'health', 'education', 'business', 'leisure', 'other'] as const;
const GOAL_ORDER = ['daily', 'weekly', 'monthly', 'quarterly', 'annual', 'long_term'];
const STEP_KEYS = ['habits', 'goals', 'expenses', 'income', 'reflect'] as const;

export default function EveningCheckin() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const refreshAll = useRefreshAll();
  const dash = useDashboard();
  const goalsQ = useGoalsOverview();
  const toggleHabit = useToggleHabit();
  const toggleTask = useToggleTask();

  const today = dash.data?.date ?? localDateKey();
  const tomorrowDate = addDays(today, 1);
  const expensesQ = useQuery({ queryKey: ['evening-expenses', today], queryFn: () => api<ExpenseRow[]>(`/expenses?from=${today}&to=${today}&pageSize=100`) });
  const incomeQ = useQuery({ queryKey: ['evening-income', today], queryFn: () => api<IncomeRow[]>(`/income?from=${today}&to=${today}&pageSize=100`) });
  const reviewQ = useQuery({ queryKey: ['evening-review', today], queryFn: () => api<DailyReviewRow[]>(`/daily-reviews?from=${today}&to=${today}&pageSize=10`) });
  const foodLogsQ = useQuery({ queryKey: ['food-logs', today], queryFn: () => api<FoodLogRow[]>(`/food-logs?from=${today}&to=${today}&pageSize=50`) });
  const tomorrowTasksQ = useQuery({ queryKey: ['tasks', tomorrowDate], queryFn: () => api<Task[]>(`/tasks?from=${tomorrowDate}&to=${tomorrowDate}&pageSize=50`) });
  const tomorrowEventsQ = useQuery({ queryKey: ['calendar-events', tomorrowDate], queryFn: () => api<CalendarEventRow[]>(`/calendar-events?from=${tomorrowDate}&to=${tomorrowDate}&pageSize=50`) });
  const tomorrowMealsQ = useQuery({ queryKey: ['meal-plans', tomorrowDate], queryFn: () => api<MealPlanRow[]>(`/meal-plans?from=${tomorrowDate}&to=${tomorrowDate}&pageSize=20`) });
  const [tomorrowBreakfast, setTomorrowBreakfast] = useState('');

  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Step 1: inline goal values
  const [goalInputs, setGoalInputs] = useState<Record<string, string>>({});
  const [savedGoal, setSavedGoal] = useState<Record<string, boolean>>({});

  // Step 2: expense form
  const [expAmount, setExpAmount] = useState('');
  const [expCat, setExpCat] = useState<string>('food');
  const [expDesc, setExpDesc] = useState('');

  // Step 3: income form
  const [incAmount, setIncAmount] = useState('');
  const [incSource, setIncSource] = useState('');
  const [incCat, setIncCat] = useState('');

  // Step 4: reflection
  const [rating, setRating] = useState<number | null | undefined>(undefined);
  const [wins, setWins] = useState<string | undefined>(undefined);
  const [lessons, setLessons] = useState<string | undefined>(undefined);
  const [tomorrow, setTomorrow] = useState<string | undefined>(undefined);

  const existingReview = reviewQ.data?.[0];
  const currentRating = rating === undefined ? (existingReview?.rating ?? null) : rating;
  const currentWins = wins ?? existingReview?.wins ?? '';
  const currentLessons = lessons ?? existingReview?.lessons ?? '';
  const currentTomorrow = tomorrow ?? existingReview?.tomorrow_priorities ?? '';

  const updateGoal = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api(`/goals/${id}`, { method: 'PATCH', body }),
    onSuccess: (_data, vars) => {
      success();
      setSavedGoal((s) => ({ ...s, [vars.id]: true }));
      setErr(null);
      void refreshAll();
    },
    onError: (e) => setErr(errorMessage(e, t)),
  });

  const addExpense = useMutation({
    mutationFn: () => {
      const n = parseMoneyInput(expAmount);
      if (!n || n <= 0) throw new Error(t('eveningCheckin.invalidAmount'));
      return api('/expenses', {
        method: 'POST',
        body: { amount: n, category: expCat, ...(expDesc.trim() ? { description: expDesc.trim() } : {}), spent_on: today },
      });
    },
    onSuccess: () => {
      success();
      setExpAmount('');
      setExpDesc('');
      setErr(null);
      void qc.invalidateQueries({ queryKey: ['evening-expenses', today] });
      void qc.invalidateQueries({ queryKey: ['finance'] });
    },
    onError: (e) => setErr(errorMessage(e, t)),
  });

  const addIncome = useMutation({
    mutationFn: () => {
      const n = parseMoneyInput(incAmount);
      if (!n || n <= 0) throw new Error(t('eveningCheckin.invalidAmount'));
      return api('/income', {
        method: 'POST',
        body: {
          amount: n,
          ...(incSource.trim() ? { source: incSource.trim() } : {}),
          ...(incCat.trim() ? { category: incCat.trim() } : {}),
          received_on: today,
        },
      });
    },
    onSuccess: () => {
      success();
      setIncAmount('');
      setIncSource('');
      setIncCat('');
      setErr(null);
      void qc.invalidateQueries({ queryKey: ['evening-income', today] });
      void qc.invalidateQueries({ queryKey: ['finance'] });
    },
    onError: (e) => setErr(errorMessage(e, t)),
  });

  const planTomorrowBreakfast = useMutation({
    mutationFn: () => api('/meal-plans', {
      method: 'POST',
      body: { plan_date: tomorrowDate, meal_type: 'breakfast', custom_name: tomorrowBreakfast.trim() },
    }),
    onSuccess: () => {
      success();
      setTomorrowBreakfast('');
      void qc.invalidateQueries({ queryKey: ['meal-plans', tomorrowDate] });
    },
    onError: (e) => setErr(errorMessage(e, t)),
  });

  const finishRundown = useMutation({
    mutationFn: async () => {
      const review = await api('/daily-reviews', {
        method: 'POST',
        body: {
          review_date: today,
          ...(currentRating ? { rating: currentRating } : {}),
          ...(currentWins.trim() ? { wins: currentWins.trim() } : {}),
          ...(currentLessons.trim() ? { lessons: currentLessons.trim() } : {}),
          ...(currentTomorrow.trim() ? { tomorrow_priorities: currentTomorrow.trim() } : {}),
        },
      });
      if (currentTomorrow.trim()) {
        await api('/daily-schedules', {
          method: 'POST',
          body: { schedule_date: tomorrowDate, main_priority: currentTomorrow.trim().slice(0, 200) },
        }).catch(() => undefined);
      }
      return review;
    },
    onSuccess: async () => {
      await markEveningCheckinDone(today);
      success();
      setErr(null);
      setCompleted(true);
      void qc.invalidateQueries({ queryKey: ['evening-review', today] });
      void refreshAll();
    },
    onError: (e) => setErr(errorMessage(e, t)),
  });

  if (dash.isLoading || goalsQ.isLoading) return <Loading />;
  if (dash.error || !dash.data) {
    return (
      <Screen>
        <Header title={t('eveningCheckin.title')} back />
        <ErrorState message={dash.error ? errorMessage(dash.error, t) : t('home.loadError')} onRetry={() => void dash.refetch()} />
      </Screen>
    );
  }

  const d = dash.data;
  const habitsDone = d.habits.filter((h) => h.stats.completed_today).length;
  const activeGoals = [...(goalsQ.data ?? [])]
    .filter((g) => g.status === 'active')
    .sort((a, b) => GOAL_ORDER.indexOf(a.goal_type) - GOAL_ORDER.indexOf(b.goal_type));
  const totalSpent = (expensesQ.data ?? []).reduce((acc, row) => acc + Number(row.amount || 0), 0);
  const totalIncome = (incomeQ.data ?? []).reduce((acc, row) => acc + Number(row.amount || 0), 0);
  const moods = t('journal.moods', { returnObjects: true }) as string[];

  if (completed) {
    return (
      <Screen bottomPad={40}>
        <Header title={t('eveningCheckin.title')} subtitle={prettyDate(today)} back />
        <Hero>
          <View className="items-center gap-3 py-2">
            <Ionicons name="checkmark-circle" size={48} color="#2DD4BF" />
            <Text size="xl" serif color="#FFFFFF" style={{ textAlign: 'center' }}>{t('eveningCheckin.completedTitle')}</Text>
            <Text size="sm" color="#E6FFFB" style={{ textAlign: 'center' }}>{t('eveningCheckin.completedBody')}</Text>
          </View>
        </Hero>
        <Card className="gap-2">
          <View className="flex-row justify-between"><Text muted>{t('eveningCheckin.steps.habits')}</Text><Text weight="700">{habitsDone}/{d.habits.length}</Text></View>
          <View className="flex-row justify-between"><Text muted>{t('eveningCheckin.mealsToday')}</Text><Text weight="700">{(foodLogsQ.data ?? []).length}</Text></View>
          <View className="flex-row justify-between"><Text muted>{t('eveningCheckin.spentToday')}</Text><Text weight="700">{formatNumber(totalSpent)} {currencyLabel('XAF')}</Text></View>
          <View className="flex-row justify-between"><Text muted>{t('eveningCheckin.incomeToday')}</Text><Text weight="700">{formatNumber(totalIncome)} {currencyLabel('XAF')}</Text></View>
        </Card>
        <Button title={t('eveningCheckin.viewHistory')} variant="ghost" icon="time-outline" onPress={() => router.replace({ pathname: '/review', params: { tab: 'daily' } })} />
        <Button title={t('eveningCheckin.backHome')} onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const renderGoalCard = (g: GoalView) => {
    const val = goalInputs[g.id] ?? '';
    const canValue = g.measurement_type !== 'milestones' && g.child_count === 0;
    const parsedVal = parseMoneyInput(val);
    return (
      <Card key={g.id} className="gap-3">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 gap-1">
            <Text weight="700">{g.title}</Text>
            <Text size="xs" muted>{t(`domain.goalType.${g.goal_type}`, { defaultValue: g.goal_type })} · {t('domain.complete', { pct: Math.round(g.progress * 100) })}</Text>
          </View>
          {savedGoal[g.id] ? <Pill label={t('eveningCheckin.goalSaved')} tone="success" /> : null}
        </View>
        <ProgressBar value={g.progress} />
        {canValue && (
          <View className="gap-2">
            {g.measurement_type === 'currency' ? (
              <MoneyField allowDecimal label={t('eveningCheckin.updateValue')} value={val} onChangeText={(v) => setGoalInputs((m) => ({ ...m, [g.id]: v }))} />
            ) : (
              <Field label={t('eveningCheckin.updateValue')} keyboardType="numeric" value={val} onChangeText={(v) => setGoalInputs((m) => ({ ...m, [g.id]: v }))} />
            )}
            <Row>
              <View className="flex-1">
                <Button
                  title={t('eveningCheckin.saveGoal')}
                  variant="ghost"
                  disabled={!val.trim() || Number.isNaN(parsedVal)}
                  loading={updateGoal.isPending && updateGoal.variables?.id === g.id && updateGoal.variables.body.status !== 'completed'}
                  onPress={() => updateGoal.mutate({ id: g.id, body: { current_value: parsedVal } })}
                />
              </View>
              <View className="flex-1">
                <Button
                  title={t('eveningCheckin.markGoalDone')}
                  variant="dark"
                  loading={updateGoal.isPending && updateGoal.variables?.id === g.id && updateGoal.variables.body.status === 'completed'}
                  onPress={() => updateGoal.mutate({ id: g.id, body: { status: 'completed' } })}
                />
              </View>
            </Row>
          </View>
        )}
        {!canValue && (
          <Button
            title={t('eveningCheckin.markGoalDone')}
            variant="ghost"
            loading={updateGoal.isPending && updateGoal.variables?.id === g.id}
            onPress={() => updateGoal.mutate({ id: g.id, body: { status: 'completed' } })}
          />
        )}
      </Card>
    );
  };

  return (
    <Screen bottomPad={40}>
      <Header
        eyebrow={t('eveningCheckin.eyebrow')}
        title={t('eveningCheckin.title')}
        subtitle={t('eveningCheckin.subtitle', { date: prettyDate(today) })}
        back
      />

      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text size="xs" weight="600" color={theme.gold}>{t('eveningCheckin.step', { current: step + 1, total: STEP_KEYS.length })}</Text>
          <Text size="xs" muted>{t(`eveningCheckin.steps.${STEP_KEYS[step]}`)}</Text>
        </View>
        <ProgressBar value={(step + 1) / STEP_KEYS.length} tone="accent" height={6} />
      </View>

      {step === 0 && (
        <View className="gap-3">
          <Text size="lg" serif>{t('eveningCheckin.qHabits')}</Text>
          <Pill label={t('eveningCheckin.habitsCount', { done: habitsDone, total: d.habits.length })} tone={habitsDone === d.habits.length && d.habits.length > 0 ? 'success' : 'info'} />
          {d.habits.length === 0 ? (
            <Card><EmptyState icon="repeat" title={t('eveningCheckin.noHabits')} /></Card>
          ) : (
            <Card>
              {d.habits.map((h) => (
                <View key={h.id} className="flex-row items-center gap-4 py-1.5">
                  <Check
                    checked={h.stats.completed_today}
                    label={t('home.habitLabel', { name: h.name })}
                    onPress={() => toggleHabit.mutate({ id: h.id, date: today, done: !h.stats.completed_today })}
                  />
                  <View className="flex-1">
                    <Text weight="600">{h.name}</Text>
                    {h.stats.streak > 0 ? <Text size="xs" muted>{t(`domain.streak_${h.stats.streak_unit}`, { count: h.stats.streak })}</Text> : null}
                  </View>
                  <Pill label={t(h.stats.completed_today ? 'eveningCheckin.habitDone' : 'eveningCheckin.habitPending')} tone={h.stats.completed_today ? 'success' : 'neutral'} />
                </View>
              ))}
            </Card>
          )}
        </View>
      )}

      {step === 1 && (
        <View className="gap-3">
          <Text size="lg" serif>{t('eveningCheckin.qGoals')}</Text>
          <SectionHeader title={t('eveningCheckin.openTasks')} />
          <Card>
            {d.priorities.length === 0 ? (
              <Text size="sm" muted>{t('eveningCheckin.noOpenTasks')}</Text>
            ) : (
              d.priorities.map((task) => (
                <View key={task.id} className="flex-row items-center gap-4 py-1.5">
                  <Check checked={false} label={t('home.complete', { title: task.title })} onPress={() => toggleTask.mutate({ id: task.id, completed: true })} />
                  <View className="flex-1">
                    <Text>{task.title}</Text>
                    {task.overdue ? <Text size="xs" color={theme.error}>{t('home.overdue', { date: task.due_date })}</Text> : null}
                  </View>
                </View>
              ))
            )}
          </Card>
          <SectionHeader title={t('eveningCheckin.activeGoals')} />
          {activeGoals.length === 0 ? (
            <Card><EmptyState icon="flag-outline" title={t('eveningCheckin.noActiveGoals')} /></Card>
          ) : (
            activeGoals.map(renderGoalCard)
          )}
        </View>
      )}

      {step === 2 && (
        <View className="gap-3">
          <Text size="lg" serif>{t('eveningCheckin.qExpenses')}</Text>
          <Hero colors={['#14213D', '#223E66']}>
            <Text size="xs" color="#C9D6E3">{t('eveningCheckin.spentToday')}</Text>
            <Text size="xxl" serif color="#FFFFFF">{formatNumber(totalSpent)} {currencyLabel('XAF')}</Text>
          </Hero>
          <Card className="gap-3">
            <MoneyField allowDecimal label={t('eveningCheckin.expenseAmount')} value={expAmount} onChangeText={setExpAmount} />
            <Text size="sm" weight="600">{t('eveningCheckin.expenseCategory')}</Text>
            <Row>{EXPENSE_CATS.map((c) => <Chip key={c} label={categoryLabel(t, c)} selected={expCat === c} onPress={() => setExpCat(c)} />)}</Row>
            <Field label={t('eveningCheckin.expenseDesc')} value={expDesc} onChangeText={setExpDesc} placeholder={t('eveningCheckin.expenseDescPlaceholder')} />
            <Button title={t('eveningCheckin.addExpense')} icon="add" loading={addExpense.isPending} onPress={() => addExpense.mutate()} />
          </Card>
          {(expensesQ.data ?? []).length === 0 ? (
            <Text size="sm" muted>{t('eveningCheckin.noExpensesToday')}</Text>
          ) : (
            (expensesQ.data ?? []).map((item) => (
              <Card key={item.id}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text weight="600">{item.description || categoryLabel(t, item.category)}</Text>
                    <Text size="xs" muted>{categoryLabel(t, item.category)}</Text>
                  </View>
                  <Text weight="700">{formatNumber(item.amount)} {currencyLabel(item.currency ?? 'XAF')}</Text>
                </View>
              </Card>
            ))
          )}
        </View>
      )}

      {step === 3 && (
        <View className="gap-3">
          <Text size="lg" serif>{t('eveningCheckin.qIncome')}</Text>
          <Hero colors={['#0F766E', '#14B8A6']}>
            <Text size="xs" color="#E6FFFB">{t('eveningCheckin.incomeToday')}</Text>
            <Text size="xxl" serif color="#FFFFFF">{formatNumber(totalIncome)} {currencyLabel('XAF')}</Text>
          </Hero>
          <Card className="gap-3">
            <MoneyField allowDecimal label={t('eveningCheckin.incomeAmount')} value={incAmount} onChangeText={setIncAmount} />
            <Field label={t('eveningCheckin.incomeSource')} value={incSource} onChangeText={setIncSource} placeholder={t('eveningCheckin.incomeSourcePlaceholder')} />
            <Field label={t('eveningCheckin.incomeCategory')} value={incCat} onChangeText={setIncCat} placeholder={t('modules.ph.categoryIncome')} />
            <Button title={t('eveningCheckin.addIncome')} icon="add" loading={addIncome.isPending} onPress={() => addIncome.mutate()} />
          </Card>
          {(incomeQ.data ?? []).length === 0 ? (
            <Text size="sm" muted>{t('eveningCheckin.noIncomeToday')}</Text>
          ) : (
            (incomeQ.data ?? []).map((item) => (
              <Card key={item.id}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text weight="600">{item.source || t('finance.income')}</Text>
                    {item.category ? <Text size="xs" muted>{item.category}</Text> : null}
                  </View>
                  <Text weight="700" color={theme.success}>+{formatNumber(item.amount)} {currencyLabel(item.currency ?? 'XAF')}</Text>
                </View>
              </Card>
            ))
          )}
        </View>
      )}

      {step === 4 && (
        <View className="gap-3">
          <Text size="lg" serif>{t('eveningCheckin.qReflect')}</Text>
          <Text size="sm" weight="600">{t('eveningCheckin.dayRating')}</Text>
          <Row>{moods.map((label, i) => <Chip key={label} label={label} selected={currentRating === i + 1} onPress={() => setRating(currentRating === i + 1 ? null : i + 1)} />)}</Row>
          <Field label={t('eveningCheckin.winsLabel')} multiline value={currentWins} onChangeText={setWins} />
          <Field label={t('eveningCheckin.lessonsLabel')} multiline value={currentLessons} onChangeText={setLessons} />
          <Field label={t('eveningCheckin.tomorrowLabel')} multiline value={currentTomorrow} onChangeText={setTomorrow} />

          <SectionHeader title={t('eveningCheckin.tomorrowPreviewTitle')} />
          <Card className="gap-3">
            <Text size="xs" muted>{prettyDate(tomorrowDate)}</Text>
            {(tomorrowEventsQ.data ?? []).length === 0 && (tomorrowTasksQ.data ?? []).length === 0 ? (
              <Text size="sm" muted>{t('eveningCheckin.tomorrowEmpty')}</Text>
            ) : (
              <>
                {(tomorrowEventsQ.data ?? []).map((ev) => (
                  <View key={ev.id} className="flex-row items-center justify-between">
                    <Text size="sm" style={{ flex: 1 }}>{ev.title}</Text>
                    <Text size="xs" muted>{ev.starts_at.slice(11, 16)}</Text>
                  </View>
                ))}
                {(tomorrowTasksQ.data ?? []).map((task) => (
                  <View key={task.id} className="flex-row items-center justify-between">
                    <Text size="sm" style={{ flex: 1 }}>{task.title}</Text>
                    <Pill label={t(`newTask.priorities.${task.priority}`)} tone={task.priority === 'high' ? 'error' : 'neutral'} />
                  </View>
                ))}
              </>
            )}
            {(tomorrowMealsQ.data ?? []).length > 0 && (
              <View className="gap-1">
                <Text size="xs" weight="600" muted>{t('eveningCheckin.tomorrowMealsPlanned')}</Text>
                {(tomorrowMealsQ.data ?? []).map((m) => (
                  <Text key={m.id} size="sm">{t(`modules.opt.${m.meal_type}`)}: {m.custom_name || '—'}</Text>
                ))}
              </View>
            )}
            <Field
              label={t('eveningCheckin.planTomorrowBreakfast')}
              value={tomorrowBreakfast}
              onChangeText={setTomorrowBreakfast}
              placeholder={t('morningPlan.mealInputPlaceholder')}
            />
            <Button
              title={t('morningPlan.setPlanBtn')}
              variant="ghost"
              disabled={!tomorrowBreakfast.trim()}
              loading={planTomorrowBreakfast.isPending}
              onPress={() => planTomorrowBreakfast.mutate()}
            />
          </Card>
        </View>
      )}

      <ErrorText message={err} />

      <View className="mt-2 flex-row gap-3">
        {step > 0 && (
          <View className="flex-1">
            <Button title={t('common.back')} variant="ghost" onPress={() => { setErr(null); setStep((s) => Math.max(0, s - 1)); }} />
          </View>
        )}
        <View className="flex-1">
          {step < STEP_KEYS.length - 1 ? (
            <Button
              title={(step === 2 && (expensesQ.data ?? []).length === 0) || (step === 3 && (incomeQ.data ?? []).length === 0) ? t('eveningCheckin.skipStep') : t('eveningCheckin.next')}
              onPress={() => { setErr(null); setStep((s) => Math.min(STEP_KEYS.length - 1, s + 1)); }}
            />
          ) : (
            <Button title={t('eveningCheckin.complete')} icon="checkmark-circle-outline" loading={finishRundown.isPending} onPress={() => finishRundown.mutate()} />
          )}
        </View>
      </View>
    </Screen>
  );
}
