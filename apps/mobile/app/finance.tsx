import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Button, Card, Chip, EmptyState, ErrorState, ErrorText, FadeIn, Field, Header, Hero, Loading, Pill, ProgressBar, Row, Screen, SectionHeader, StatTile, Text, success } from '../src/components/ui';
import { currencyLabel, currentLocale, formatNumber } from '../src/i18n';
import { api } from '../src/lib/api';
import { categoryLabel } from '../src/lib/modules';
import { spacing } from '../src/theme/tokens';

type Summary = {
  month: string; currency: string; income: number; spent: number; net: number; savings_rate: number | null; skipped_other_currency: number; over_budget: string[];
  categories: { category: string; spent: number; budget: number | null; remaining: number | null; over: boolean }[];
  savings: { id: string; name: string; kind: string; target: number; balance: number; pct: number }[];
};
const fmt = formatNumber;

function SpendBars({ data }: { data: Summary['categories'] }) {
  const { t } = useTranslation();
  const rows = data.filter((c) => c.spent > 0).slice(0, 6);
  const max = Math.max(1, ...rows.map((r) => r.spent));
  if (!rows.length) return null;
  return (
    <View className="gap-[8px]">
      {rows.map((r) => (
        <View key={r.category} className="gap-[3px]">
          <View className="flex-row justify-between"><Text size="sm">{categoryLabel(t, r.category)}</Text><Text size="sm" muted>{fmt(r.spent)}</Text></View>
          <Svg width="100%" height={8}><Rect x="0" y="0" width="100%" height="8" rx="4" fill="#00000012" /><Rect x="0" y="0" width={`${(r.spent / max) * 100}%`} height="8" rx="4" fill={r.over ? '#C0392B' : '#C9A24B'} /></Svg>
        </View>
      ))}
    </View>
  );
}

export default function Finance() {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['finance'], queryFn: () => api<Summary>('/finance/summary') });
  const [goal, setGoal] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const deposit = useMutation({
    mutationFn: (sign: 1 | -1) => {
      const n = Number(amount.replace(/,/g, ''));
      if (!goal) throw new Error(t('finance.pickGoal'));
      if (!n || n <= 0) throw new Error(t('finance.amountAboveZero'));
      return api('/savings-transactions', { method: 'POST', body: { savings_goal_id: goal, amount: sign * n } });
    },
    onSuccess: () => { success(); setAmount(''); setErr(null); void qc.invalidateQueries({ queryKey: ['finance'] }); },
    onError: (e) => setErr((e as Error).message),
  });

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <Screen><ErrorState message={(q.error as Error)?.message ?? t('finance.loadError')} onRetry={() => void q.refetch()} /></Screen>;
  const s = q.data;
  const month = new Date(`${s.month}T00:00:00Z`).toLocaleDateString(currentLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const nothing = s.income === 0 && s.spent === 0 && s.savings.length === 0;

  return (
    <Screen bottomPad={40} onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Header title={t('finance.title')} subtitle={t('finance.subtitle', { month, currency: currencyLabel(s.currency) })} back />
      <Hero>
        <Text size="sm" color="#E9D9A6">{t('finance.leftThisMonth')}</Text>
        <Text size="xxl" serif weight="700" color="#FFFFFF">{s.net < 0 ? '-' : ''}{fmt(Math.abs(s.net))}</Text>
        <Text size="sm" color="#FFFFFFB3">{s.savings_rate === null ? t('finance.addIncomeToSee') : t('finance.kept', { pct: s.savings_rate })}</Text>
      </Hero>
      <Row gap={spacing.md}>
        <View className="flex-1"><StatTile label={t('finance.income')} value={fmt(s.income)} icon="trending-up-outline" tone="success" /></View>
        <View className="flex-1"><StatTile label={t('finance.spent')} value={fmt(s.spent)} icon="trending-down-outline" tone={s.over_budget.length ? 'error' : 'info'} /></View>
      </Row>
      {s.skipped_other_currency > 0 && <Text size="xs" muted>{t('finance.skipped', { count: s.skipped_other_currency })}</Text>}

      <Row>
        <Chip label={t('finance.addIncome')} selected={false} onPress={() => router.push('/module/income')} />
        <Chip label={t('finance.addExpense')} selected={false} onPress={() => router.push('/module/expenses')} />
        <Chip label={t('finance.budgets')} selected={false} onPress={() => router.push('/module/budgets')} />
        <Chip label={t('finance.savingsGoals')} selected={false} onPress={() => router.push('/module/savings-goals')} />
      </Row>

      {nothing ? <EmptyState icon="wallet-outline" title={t('finance.emptyTitle')} body={t('finance.emptyBody')} action={t('finance.emptyAction')} onAction={() => router.push('/module/expenses')} /> : (
        <>
          <SectionHeader title={t('finance.whereItWent')} />
          <Card className="gap-[16px]">
            <SpendBars data={s.categories} />
            {s.categories.filter((c) => c.budget !== null).map((c) => (
              <FadeIn key={c.category}>
                <View className="gap-[4px]">
                  <View className="flex-row justify-between items-center">
                    <Text size="sm" weight="600">{t('finance.categoryBudget', { category: categoryLabel(t, c.category) })}</Text>
                    <Pill label={c.over ? t('finance.overBy', { amount: fmt(-(c.remaining ?? 0)) }) : t('finance.left', { amount: fmt(c.remaining ?? 0) })} tone={c.over ? 'error' : 'success'} />
                  </View>
                  <ProgressBar value={c.budget ? Math.min(100, (c.spent / c.budget) * 100) : 0} tone={c.over ? 'error' : 'success'} />
                </View>
              </FadeIn>
            ))}
          </Card>
        </>
      )}

      <SectionHeader title={t('finance.savings')} />
      {s.savings.length === 0 ? <EmptyState icon="shield-checkmark-outline" title={t('finance.noGoals')} body={t('finance.noGoalsBody')} action={t('finance.createGoal')} onAction={() => router.push('/module/savings-goals')} /> : (
        <>
          {s.savings.map((g) => (
            <Card key={g.id} className="gap-[6px]">
              <View className="flex-row justify-between"><Text weight="600">{g.name}</Text><Text size="sm" muted>{g.pct}%</Text></View>
              <ProgressBar value={g.pct} tone="accent" />
              <Text size="sm" muted>{t('finance.ofTarget', { balance: fmt(g.balance), target: fmt(g.target), currency: currencyLabel(s.currency) })}</Text>
            </Card>
          ))}
          <Card className="gap-[16px]">
            <Text weight="600">{t('finance.addOrWithdraw')}</Text>
            <Row>{s.savings.map((g) => <Chip key={g.id} label={g.name} selected={goal === g.id} onPress={() => setGoal(g.id)} />)}</Row>
            <Field label={t('finance.amount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder={t('finance.amountPlaceholder')} />
            <ErrorText message={err} />
            <Row gap={spacing.md}>
              <View className="flex-1"><Button title={t('finance.deposit')} loading={deposit.isPending} onPress={() => deposit.mutate(1)} /></View>
              <View className="flex-1"><Button title={t('finance.withdraw')} variant="ghost" onPress={() => deposit.mutate(-1)} /></View>
            </Row>
          </Card>
        </>
      )}
      <Text size="xs" muted>{t('finance.footer')}</Text>
    </Screen>
  );
}
