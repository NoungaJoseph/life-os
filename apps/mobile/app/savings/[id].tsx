import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { MoneyField } from '../../src/components/MoneyField';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  ErrorText,
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
} from '../../src/components/ui';
import { formatNumber } from '../../src/i18n';
import { api } from '../../src/lib/api';
import { shortDate } from '../../src/lib/dates';
import { errorMessage } from '../../src/lib/errors';
import { formatMoneyInput, parseMoneyInput } from '../../src/lib/moneyInput';
import { moneyKey, SavingsOverview } from '../../src/lib/savings';
import { useTheme } from '../../src/theme/useTheme';

const QUICK_AMOUNTS = [1000, 5000, 10000] as const;

export default function SavingsGoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const th = useTheme();
  const router = useRouter();
  const qc = useQueryClient();

  const [addAmount, setAddAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [addErr, setAddErr] = useState<string | null>(null);
  const [withdrawErr, setWithdrawErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const q = useQuery({ queryKey: ['personal-savings'], queryFn: () => api<SavingsOverview>('/savings') });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['personal-savings'] });
    void qc.invalidateQueries({ queryKey: ['wallet'] });
  };

  const contribute = useMutation({
    mutationFn: (n: number) =>
      api('/savings/contribute', {
        method: 'POST',
        headers: { 'Idempotency-Key': moneyKey() },
        body: { amount: n, goal_id: id },
      }),
    onSuccess: () => {
      success();
      setAddAmount('');
      setAddErr(null);
      setNotice(t('savings.addedSuccess'));
      refresh();
    },
  });

  const withdraw = useMutation({
    mutationFn: (n: number) =>
      api('/savings/withdraw-goal', {
        method: 'POST',
        headers: { 'Idempotency-Key': moneyKey() },
        body: { amount: n, goal_id: id },
      }),
    onSuccess: () => {
      success();
      setWithdrawAmount('');
      setWithdrawErr(null);
      setNotice(t('savings.withdrawnSuccess'));
      refresh();
    },
  });

  const submitAdd = () => {
    const n = parseMoneyInput(addAmount);
    if (!Number.isSafeInteger(n) || n <= 0) {
      setAddErr(t('savings.invalidAmount'));
      return;
    }
    setAddErr(null);
    contribute.mutate(n);
  };

  const submitWithdraw = () => {
    const n = parseMoneyInput(withdrawAmount);
    if (!Number.isSafeInteger(n) || n <= 0) {
      setWithdrawErr(t('savings.invalidAmount'));
      return;
    }
    setWithdrawErr(null);
    withdraw.mutate(n);
  };

  if (q.isLoading) return <Loading />;
  if (q.error) {
    return (
      <Screen>
        <Header title={t('savings.goalDetail')} back />
        <ErrorState message={errorMessage(q.error, t)} onRetry={() => void q.refetch()} />
      </Screen>
    );
  }

  const goal = q.data?.goals.find((g) => g.id === id);
  if (!goal) {
    return (
      <Screen>
        <Header title={t('savings.goals')} back />
        <EmptyState title={t('savings.notFound')} />
      </Screen>
    );
  }

  const walletBalance = q.data?.wallet_balance ?? 0;
  const remaining = goal.remaining ?? Math.max(0, goal.target_amount - goal.balance);
  const pct = goal.progress_pct ?? Math.min(100, Math.round((goal.balance / goal.target_amount) * 100));
  const unlocked = goal.is_unlocked ?? goal.balance >= goal.target_amount;
  const parsedAdd = parseMoneyInput(addAmount);
  const overWallet = Number.isSafeInteger(parsedAdd) && parsedAdd > walletBalance;

  return (
    <Screen bottomPad={50} onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Header title={goal.name} subtitle={t('savings.goalDetail')} back />

      <Hero colors={unlocked ? ['#166534', '#14532D'] : ['#14213D', '#0F172A']}>
        <View className="flex-row items-center justify-between">
          <Text size="sm" color="#E9D9A6">{t('savings.saved')}</Text>
          <Pill label={t(unlocked ? 'savings.unlockedBadge' : 'savings.lockedBadge')} tone={unlocked ? 'success' : 'accent'} />
        </View>
        <Text size="xxl" serif color="#FFFFFF">{`${formatNumber(goal.balance)} FCFA`}</Text>
        <Text size="sm" color="#E2E8F0">{`${t('savings.ofTarget', { amount: formatNumber(goal.target_amount) })} · ${pct}%`}</Text>
        <ProgressBar value={goal.balance / goal.target_amount} tone={unlocked ? 'success' : 'accent'} />
        <Text size="xs" color="#E9D9A6">
          {unlocked
            ? t('savings.readyToWithdraw')
            : t('savings.leftToUnlock', { amount: formatNumber(remaining) })}
        </Text>
        {goal.target_date ? (
          <Text size="xs" color="#CBD5E1">{t('savings.targetDateLabel', { date: shortDate(goal.target_date) })}</Text>
        ) : null}
      </Hero>

      <Card className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text size="sm" weight="600">{t('savings.walletBalance', { amount: formatNumber(walletBalance) })}</Text>
        </View>
        <Pressable onPress={() => router.push('/wallet')} className="py-1">
          <Text size="sm" weight="600" color={th.primary}>{t('savings.topUpWallet')}</Text>
        </Pressable>
      </Card>

      {notice ? (
        <Card className="flex-row items-center gap-2">
          <Ionicons name="checkmark-circle" size={18} color={th.success} />
          <Text size="sm" weight="600" color={th.success}>{notice}</Text>
        </Card>
      ) : null}

      <SectionHeader title={t('savings.addToGoalTitle')} />
      <Card className="gap-3">
        <MoneyField
          label={t('savings.amount')}
          value={addAmount}
          onChangeText={(v) => { setNotice(null); setAddAmount(v); }}
        />
        <Row>
          {QUICK_AMOUNTS.map((amt) => (
            <Chip
              key={amt}
              label={`+${formatNumber(amt)}`}
              selected={parsedAdd === amt}
              onPress={() => { setNotice(null); setAddAmount(formatMoneyInput(String(amt))); }}
            />
          ))}
          {remaining > 0 ? (
            <Chip
              label={t('savings.completeGoalChip', { amount: formatNumber(remaining) })}
              selected={parsedAdd === remaining}
              onPress={() => { setNotice(null); setAddAmount(formatMoneyInput(String(remaining))); }}
            />
          ) : null}
        </Row>
        {overWallet ? <Text size="xs" color={th.error}>{t('savings.notEnoughWallet')}</Text> : null}
        <ErrorText message={addErr ?? (contribute.error ? errorMessage(contribute.error, t) : null)} />
        <Button
          title={t('savings.addToGoalBtn')}
          icon="arrow-down-circle-outline"
          loading={contribute.isPending}
          disabled={overWallet}
          onPress={submitAdd}
        />
      </Card>

      <SectionHeader title={t('savings.withdrawTitle')} />
      {!unlocked ? (
        <Card className="gap-3">
          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-md border border-line bg-surface-alt">
              <Ionicons name="lock-closed" size={20} color={th.gold} />
            </View>
            <View className="flex-1 gap-1">
              <Text weight="700">{t('savings.lockRuleTitle')}</Text>
              <Text size="sm" muted>
                {t('savings.withdrawLockedBody', {
                  target: formatNumber(goal.target_amount),
                  remaining: formatNumber(remaining),
                })}
              </Text>
            </View>
          </View>
          <Button
            title={t('savings.withdrawLockedBtn', { target: formatNumber(goal.target_amount) })}
            icon="lock-closed-outline"
            variant="ghost"
            disabled
            onPress={() => undefined}
          />
        </Card>
      ) : (
        <Card className="gap-3">
          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-md border border-line bg-surface-alt">
              <Ionicons name="lock-open" size={20} color={th.success} />
            </View>
            <View className="flex-1 gap-1">
              <Text weight="700">{t('savings.unlockedBadge')}</Text>
              <Text size="sm" muted>{t('savings.withdrawUnlockedBody')}</Text>
            </View>
          </View>
          {goal.balance > 0 ? (
            <>
              <MoneyField
                label={t('savings.amount')}
                value={withdrawAmount}
                onChangeText={(v) => { setNotice(null); setWithdrawErr(null); setWithdrawAmount(v); }}
              />
              <Row>
                <Chip
                  label={t('savings.withdrawAllChip', { amount: formatNumber(goal.balance) })}
                  selected={parseMoneyInput(withdrawAmount) === goal.balance}
                  onPress={() => { setNotice(null); setWithdrawErr(null); setWithdrawAmount(formatMoneyInput(String(goal.balance))); }}
                />
              </Row>
              <ErrorText message={withdrawErr ?? (withdraw.error ? errorMessage(withdraw.error, t) : null)} />
              <Button
                title={t('savings.withdrawBtn')}
                icon="wallet-outline"
                loading={withdraw.isPending}
                onPress={submitWithdraw}
              />
            </>
          ) : null}
        </Card>
      )}
    </Screen>
  );
}
