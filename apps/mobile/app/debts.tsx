import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorState, ErrorText, Field, Header, Hero, Loading, Pill, ProgressBar, Row, Screen, SectionHeader, Segmented, StatTile, Text, success } from '../src/components/ui';
import { currencyLabel, formatNumber } from '../src/i18n';
import { api } from '../src/lib/api';
import { spacing } from '../src/theme/tokens';

type Item = { id: string; name: string; creditor: string | null; direction: string; currency: string; status: string; principal: number; paid: number; remaining: number; pct: number; due_date: string | null; overdue: boolean; payments_left: number | null };
type Overview = { items: Item[]; i_owe: number; owed_to_me: number; overdue: string[] };
const fmt = formatNumber;

export default function Debts() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['debts'], queryFn: () => api<Overview>('/debts/overview') });
  const [f, setF] = useState({ name: '', creditor: '', principal: '', min_payment: '', due_date: '' });
  const [dir, setDir] = useState<'owed_by_me' | 'owed_to_me'>('owed_by_me');
  const [pay, setPay] = useState<{ id: string; amount: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const done = () => { success(); setErr(null); void qc.invalidateQueries({ queryKey: ['debts'] }); };

  const add = useMutation({
    mutationFn: () => {
      const principal = Number(f.principal.replace(/,/g, ''));
      if (!f.name.trim()) throw new Error(t('debts.nameIt'));
      if (!(principal > 0)) throw new Error(t('debts.amountAboveZero'));
      return api('/debts', { method: 'POST', body: { name: f.name.trim(), direction: dir, principal,
        ...(f.creditor.trim() ? { creditor: f.creditor.trim() } : {}), ...(f.min_payment ? { min_payment: Number(f.min_payment) } : {}), ...(f.due_date ? { due_date: f.due_date } : {}) } });
    },
    onSuccess: () => { setF({ name: '', creditor: '', principal: '', min_payment: '', due_date: '' }); done(); }, onError: (e) => setErr((e as Error).message),
  });
  const payM = useMutation({
    mutationFn: () => { const n = Number(pay!.amount.replace(/,/g, '')); if (!(n > 0)) throw new Error(t('debts.paymentAboveZero')); return api('/debt-payments', { method: 'POST', body: { debt_id: pay!.id, amount: n } }); },
    onSuccess: () => { setPay(null); done(); }, onError: (e) => setErr((e as Error).message),
  });
  const close = useMutation({ mutationFn: (id: string) => api(`/debts/${id}`, { method: 'PATCH', body: { status: 'paid' } }), onSuccess: done });

  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <Screen><ErrorState message={(q.error as Error)?.message ?? t('debts.loadError')} onRetry={() => void q.refetch()} /></Screen>;
  const d = q.data;
  return (
    <Screen bottomPad={40} onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Header title={t('debts.title')} subtitle={t('debts.subtitle')} back />
      <Hero>
        <Text size="sm" color="#E9D9A6">{t('debts.youOwe')}</Text>
        <Text size="xxl" serif weight="700" color="#FFFFFF">{fmt(d.i_owe)}</Text>
        <Text size="sm" color="#FFFFFFB3">{d.overdue.length ? t('debts.overdueList', { list: d.overdue.join(', ') }) : t('debts.nothingOverdue')}</Text>
      </Hero>
      <StatTile label={t('debts.owedToYou')} value={fmt(d.owed_to_me)} icon="people-outline" tone="success" />
      <SectionHeader title={t('debts.yourDebts')} />
      {d.items.length === 0 ? <EmptyState icon="card-outline" title={t('debts.emptyTitle')} body={t('debts.emptyBody')} /> :
        d.items.map((i) => (
          <Card key={i.id} style={{ gap: 6, opacity: i.status === 'active' ? 1 : 0.6 }}>
            <View className="flex-row justify-between items-center">
              <Text weight="600">{i.name}</Text>
              {i.overdue ? <Pill label={t('debts.overdue')} tone="error" /> : i.status !== 'active' ? <Pill label={t(`modules.opt.${i.status}`, { defaultValue: i.status.replace('_', ' ') })} tone="success" /> : <Pill label={i.direction === 'owed_by_me' ? t('debts.youOwe') : t('debts.owedToYou')} tone="neutral" />}
            </View>
            <ProgressBar value={i.pct} tone="success" />
            <Text size="sm" muted>{t('debts.leftOf', { remaining: fmt(i.remaining), principal: fmt(i.principal), currency: currencyLabel(i.currency) })}{i.creditor ? ` · ${i.creditor}` : ''}{i.due_date ? ` · ${t('debts.due', { date: i.due_date })}` : ''}{i.payments_left ? ` · ${t('debts.paymentsLeft', { count: i.payments_left })}` : ''}</Text>
            {i.status === 'active' && (pay?.id === i.id ? (
              <View className="gap-[8px]">
                <Field label={t('debts.paymentAmount')} value={pay.amount} onChangeText={(v) => setPay({ id: i.id, amount: v })} keyboardType="decimal-pad" autoFocus />
                <Row><View className="flex-1"><Button title={t('debts.record')} loading={payM.isPending} onPress={() => payM.mutate()} /></View><View style={{ flex: 1 }}><Button title={t('common.cancel')} variant="ghost" onPress={() => setPay(null)} /></View></Row>
              </View>
            ) : (
              <Row><Chip label={t('debts.recordPayment')} selected={false} onPress={() => { setPay({ id: i.id, amount: '' }); setErr(null); }} />{i.remaining === 0 && <Chip label={t('debts.markPaid')} selected={false} onPress={() => close.mutate(i.id)} />}</Row>
            ))}
          </Card>
        ))}
      <SectionHeader title={t('debts.addTitle')} />
      <Card className="gap-[16px]">
        <Segmented value={dir} onChange={setDir} options={[{ value: 'owed_by_me', label: t('debts.iOwe') }, { value: 'owed_to_me', label: t('debts.owedToMe') }]} />
        <Field label={t('debts.name')} value={f.name} onChangeText={(v) => setF({ ...f, name: v })} placeholder={t('debts.namePlaceholder')} />
        <Field label={t('debts.who')} value={f.creditor} onChangeText={(v) => setF({ ...f, creditor: v })} />
        <Field label={t('debts.amount')} value={f.principal} onChangeText={(v) => setF({ ...f, principal: v })} keyboardType="decimal-pad" />
        <Field label={t('debts.usualPayment')} value={f.min_payment} onChangeText={(v) => setF({ ...f, min_payment: v })} keyboardType="decimal-pad" />
        <Field label={t('debts.dueDate')} value={f.due_date} onChangeText={(v) => setF({ ...f, due_date: v })} autoCapitalize="none" />
        <ErrorText message={err} />
        <Button title={t('debts.addDebt')} loading={add.isPending} onPress={() => add.mutate()} />
      </Card>
    </Screen>
  );
}
