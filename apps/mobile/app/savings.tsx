import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { DateField } from '../src/components/DateField';
import { MoneyField } from '../src/components/MoneyField';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  ErrorText,
  Field,
  Header,
  Hero,
  Loading,
  Pill,
  ProgressBar,
  Row,
  Screen,
  SectionHeader,
  Text,
  success,
} from '../src/components/ui';
import { formatNumber } from '../src/i18n';
import { api } from '../src/lib/api';
import { addDays, shortDate } from '../src/lib/dates';
import { errorMessage } from '../src/lib/errors';
import { parseMoneyInput } from '../src/lib/moneyInput';
import { moneyKey, SavingsOverview } from '../src/lib/savings';
import { useTheme } from '../src/theme/useTheme';

export default function Savings() {
  const { t } = useTranslation();
  const th = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['personal-savings'], queryFn: () => api<SavingsOverview>('/savings') });
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['personal-savings'] });
    void qc.invalidateQueries({ queryKey: ['wallet'] });
  };

  const returnLegacy = useMutation({
    mutationFn: (amount: number) =>
      api('/savings/withdraw', {
        method: 'POST',
        headers: { 'Idempotency-Key': moneyKey() },
        body: { amount },
      }),
    onSuccess: () => {
      success();
      refresh();
    },
  });

  const create = useMutation({
    mutationFn: ({ goalName, targetAmount }: { goalName: string; targetAmount: number }) =>
      api('/savings/goals', {
        method: 'POST',
        body: {
          name: goalName,
          target_amount: targetAmount,
          ...(targetDate ? { target_date: targetDate } : {}),
        },
      }),
    onSuccess: () => {
      success();
      setCreating(false);
      setName('');
      setTarget('');
      setTargetDate('');
      setFormErr(null);
      refresh();
    },
  });

  const submitCreate = () => {
    const goalName = name.trim();
    const targetAmount = parseMoneyInput(target);
    if (goalName.length < 2 || !Number.isSafeInteger(targetAmount) || targetAmount <= 0) {
      setFormErr(t('savings.invalidGoal'));
      return;
    }
    setFormErr(null);
    create.mutate({ goalName, targetAmount });
  };

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) {
    return (
      <Screen>
        <Header title={t('savings.title')} subtitle={t('savings.subtitle')} back />
        <ErrorState message={errorMessage(q.error, t)} onRetry={() => void q.refetch()} />
      </Screen>
    );
  }

  const s = q.data;
  const quickDates = [
    { key: 'quick1m', date: addDays(today, 30) },
    { key: 'quick2m', date: addDays(today, 60) },
    { key: 'quick3m', date: addDays(today, 90) },
    { key: 'quick6m', date: addDays(today, 180) },
  ] as const;

  return (
    <Screen bottomPad={50} onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Header title={t('savings.title')} subtitle={t('savings.subtitle')} back />

      <Hero colors={['#0F766E', '#145E59']}>
        <Text size="sm" color="#D9F7EF">{t('savings.total')}</Text>
        <Text size="xxl" serif color="#FFFFFF">{`${formatNumber(s.total_balance)} FCFA`}</Text>
        <Text size="sm" color="#D9F7EF">{t('savings.walletBalance', { amount: formatNumber(s.wallet_balance) })}</Text>
      </Hero>

      <Card className="gap-3">
        <Text size="sm" muted>{t('savings.walletHint')}</Text>
        <Button title={t('savings.topUpWallet')} icon="wallet-outline" onPress={() => router.push('/wallet')} />
        {s.available_balance > 0 ? (
          <Button
            title={t('savings.returnUnassigned', { amount: formatNumber(s.available_balance) })}
            variant="ghost"
            loading={returnLegacy.isPending}
            onPress={() => returnLegacy.mutate(s.available_balance)}
          />
        ) : null}
        <ErrorText message={returnLegacy.error ? errorMessage(returnLegacy.error, t) : null} />
      </Card>

      <SectionHeader title={t('savings.goals')} action={t('savings.newGoal')} onAction={() => setCreating(!creating)} />

      {creating ? (
        <Card className="gap-3">
          <Field
            label={t('savings.goalName')}
            placeholder={t('savings.goalNamePlaceholder')}
            value={name}
            onChangeText={setName}
            autoFocus
          />
          <MoneyField label={t('savings.target')} value={target} onChangeText={setTarget} />
          <Row>
            {quickDates.map((d) => (
              <Chip
                key={d.key}
                label={t(`savings.${d.key}`)}
                selected={targetDate === d.date}
                onPress={() => setTargetDate(targetDate === d.date ? '' : d.date)}
              />
            ))}
          </Row>
          <DateField label={t('savings.targetDate')} value={targetDate} onChange={setTargetDate} />
          <View className="flex-row items-start gap-2.5 rounded-md border border-line bg-surface-alt p-3">
            <Ionicons name="lock-closed-outline" size={18} color={th.gold} style={{ marginTop: 2 }} />
            <View className="flex-1 gap-0.5">
              <Text size="xs" weight="700">{t('savings.lockRuleTitle')}</Text>
              <Text size="xs" muted>{t('savings.lockRuleBody')}</Text>
            </View>
          </View>
          <ErrorText message={formErr ?? (create.error ? errorMessage(create.error, t) : null)} />
          <Button title={t('savings.createGoal')} loading={create.isPending} onPress={submitCreate} />
          <Button title={t('common.cancel')} variant="ghost" onPress={() => { setFormErr(null); setCreating(false); }} />
        </Card>
      ) : null}

      {!s.goals.length ? (
        <EmptyState
          icon="flag-outline"
          title={t('savings.empty')}
          body={t('savings.emptyBody')}
          action={t('savings.newGoal')}
          onAction={() => setCreating(true)}
        />
      ) : (
        s.goals.map((g) => {
          const remaining = g.remaining ?? Math.max(0, g.target_amount - g.balance);
          const pct = g.progress_pct ?? Math.min(100, Math.round((g.balance / g.target_amount) * 100));
          const unlocked = g.is_unlocked ?? g.balance >= g.target_amount;
          return (
            <Card key={g.id} className="gap-2.5" onPress={() => router.push(`/savings/${g.id}`)}>
              <View className="flex-row items-center justify-between gap-2">
                <View className="flex-1 flex-row items-center gap-2">
                  <Ionicons
                    name={unlocked ? 'lock-open-outline' : 'lock-closed-outline'}
                    size={18}
                    color={unlocked ? th.success : th.gold}
                  />
                  <Text weight="700" numberOfLines={1} style={{ flex: 1 }}>{g.name}</Text>
                </View>
                <Pill label={t(unlocked ? 'savings.unlockedBadge' : 'savings.lockedBadge')} tone={unlocked ? 'success' : 'accent'} />
              </View>
              <ProgressBar value={g.balance / g.target_amount} tone={unlocked ? 'success' : 'info'} />
              <View className="flex-row items-center justify-between">
                <Text size="sm" weight="600">{`${formatNumber(g.balance)} / ${formatNumber(g.target_amount)} FCFA`}</Text>
                <Text size="xs" muted>{`${pct}%`}</Text>
              </View>
              <Text size="xs" muted>
                {unlocked
                  ? t('savings.readyToWithdraw')
                  : t('savings.leftToUnlock', { amount: formatNumber(remaining) })}
              </Text>
              {g.target_date ? (
                <Text size="xs" muted>{t('savings.targetDateLabel', { date: shortDate(g.target_date) })}</Text>
              ) : null}
            </Card>
          );
        })
      )}

      <SectionHeader title={t('savings.groups')} />
      <Button title={t('savings.regularGroups')} variant="ghost" icon="people-outline" onPress={() => router.push('/groups')} />
      <Button title={t('savings.familyGroups')} variant="ghost" icon="heart-outline" onPress={() => router.push('/family-savings')} />
    </Screen>
  );
}
