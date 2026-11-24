import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Share, View } from 'react-native';
import { FirstVisitTip } from '../src/components/Tutorial';
import { MoneyField } from '../src/components/MoneyField';
import { Button, Card, Chip, CountUp, EmptyState, ErrorText, Field, Header, Hero, Loading, Pill, Row, Screen, SectionHeader, Text, success } from '../src/components/ui';
import { currencyLabel, currentLocale, formatNumber } from '../src/i18n';
import { api } from '../src/lib/api';
import { errorMessage } from '../src/lib/errors';
import { parseMoneyInput } from '../src/lib/moneyInput';
import {
  CAMEROON_LOCAL_LENGTH,
  CAMEROON_PREFIX,
  detectCameroonProvider,
  isValidCameroonLocal,
  sanitizeCameroonLocal,
  toCameroonPhone,
} from '../src/lib/phoneInput';
import { useTheme } from '../src/theme/useTheme';

type Wallet = { id: string; balance: number; currency: string; daily_limit: number };
type Tx = { id: string; kind: string; status: string; amount: number; currency: string; created_at: string };
type PaylinkConfig = {
  nkwa_api_enabled: boolean;
  deposit_paylink_configured: boolean;
  withdrawal_paylink_configured: boolean;
  mode: 'sandbox' | 'live';
};
type PaymentReq = {
  id: string;
  direction: 'deposit' | 'withdrawal';
  provider: 'sandbox' | 'mtn' | 'orange';
  amount: number;
  currency: string;
  phone: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  provider_reference?: string | null;
  paylink_url?: string;
  created_at: string;
};

const HIDE_KEY = 'mylifeos:wallet:hide-balance';
const idempotencyKey = () => `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export default function WalletScreen() {
  const { t } = useTranslation();
  const th = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const [hidden, setHidden] = useState(false);
  const [mode, setMode] = useState<'deposit' | 'withdrawal' | null>(null);
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [provider, setProvider] = useState<'sandbox' | 'mtn' | 'orange'>('sandbox');
  const [filter, setFilter] = useState('all');
  const [message, setMessage] = useState<string | null>(null);
  const [activePaylink, setActivePaylink] = useState<PaymentReq | null>(null);

  useEffect(() => { void AsyncStorage.getItem(HIDE_KEY).then((v) => setHidden(v === '1')); }, []);
  const visual = process.env.EXPO_PUBLIC_VISUAL_TESTS === '1';

  const wallet = useQuery({
    queryKey: ['wallet'],
    queryFn: () => visual ? Promise.resolve({ id: 'preview', balance: 125000, currency: 'XAF', daily_limit: 500000 }) : api<Wallet>('/wallet'),
  });
  const paylinkConfig = useQuery({
    queryKey: ['wallet', 'paylink-config'],
    queryFn: () => visual
      ? Promise.resolve({ nkwa_api_enabled: true, deposit_paylink_configured: true, withdrawal_paylink_configured: true, mode: 'sandbox' } as PaylinkConfig)
      : api<PaylinkConfig>('/wallet/paylink-config'),
  });
  const payments = useQuery({
    queryKey: ['wallet', 'payments'],
    queryFn: () => visual ? Promise.resolve([] as PaymentReq[]) : api<PaymentReq[]>('/wallet/payments'),
  });
  const tx = useQuery({
    queryKey: ['wallet', 'transactions', filter],
    queryFn: () => visual
      ? Promise.resolve([
          { id: 'preview-1', kind: 'deposit', status: 'succeeded', amount: 150000, currency: 'XAF', created_at: new Date().toISOString() },
          { id: 'preview-2', kind: 'vault_transfer', status: 'succeeded', amount: 25000, currency: 'XAF', created_at: new Date(Date.now() - 86400000).toISOString() },
        ].filter((row) => filter === 'all' || row.status === filter))
      : api<Tx[]>(`/wallet/transactions${filter === 'all' ? '' : `?status=${filter}`}`),
  });

  const refreshWallet = () => Promise.all([
    qc.invalidateQueries({ queryKey: ['wallet'] }),
    qc.invalidateQueries({ queryKey: ['wallet', 'payments'] }),
  ]);

  const openUrl = (url?: string) => {
    if (!url) return;
    void Linking.openURL(url).catch((e) => setMessage(errorMessage(e, t)));
  };

  const action = useMutation({
    mutationFn: async () => {
      const n = parseMoneyInput(amount);
      if (!Number.isSafeInteger(n) || n <= 0) throw new Error(t('wallet.invalidAmount'));
      if (!isValidCameroonLocal(phone)) throw new Error(t('wallet.invalidPhone'));
      return api<PaymentReq>(`/wallet/${mode === 'deposit' ? 'deposits' : 'withdrawals'}`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey() },
        body: { amount: n, phone: toCameroonPhone(phone), provider },
      });
    },
    onSuccess: (res) => {
      setAmount('');
      setMode(null);
      if (res.paylink_url && res.status !== 'succeeded') {
        setActivePaylink(res);
        setMessage(null);
        openUrl(res.paylink_url);
      } else {
        setActivePaylink(null);
        setMessage(t('wallet.success'));
        if (res.status === 'succeeded') success();
      }
      void refreshWallet();
    },
    onError: (e) => setMessage(errorMessage(e, t)),
  });

  const syncPayment = useMutation({
    mutationFn: (id: string) => api<PaymentReq>(`/wallet/payments/${id}/sync`, { method: 'POST' }),
    onSuccess: (res) => {
      if (activePaylink?.id === res.id) {
        setActivePaylink(res.status === 'succeeded' || res.status === 'failed' ? null : res);
      }
      if (res.status === 'succeeded' || res.status === 'failed') {
        if (res.status === 'succeeded') success();
        setMessage(t('wallet.statusUpdated', { status: t(`wallet.status.${res.status}`) }));
      } else {
        setMessage(t('wallet.stillPending'));
      }
      void refreshWallet();
    },
    onError: (e) => setMessage(errorMessage(e, t)),
  });

  const toggleHidden = () => {
    const next = !hidden;
    setHidden(next);
    void AsyncStorage.setItem(HIDE_KEY, next ? '1' : '0');
  };

  const nkwaReady = Boolean(
    paylinkConfig.data?.nkwa_api_enabled ||
    paylinkConfig.data?.deposit_paylink_configured ||
    paylinkConfig.data?.withdrawal_paylink_configured,
  );

  const openMode = (nextMode: 'deposit' | 'withdrawal') => {
    setMode(nextMode);
    setMessage(null);
    if (nkwaReady && provider === 'sandbox') {
      setProvider(detectCameroonProvider(phone) ?? 'mtn');
    }
  };

  const detected = detectCameroonProvider(phone);
  const pendingPaylinks = (payments.data ?? []).filter(
    (p) => (p.status === 'pending' || p.status === 'processing') && Boolean(p.paylink_url) && p.id !== activePaylink?.id,
  );

  if (wallet.isLoading) return <Loading />;
  if (wallet.error || !wallet.data) {
    return <Screen><EmptyState icon="cloud-offline-outline" title={t('ui.errorTitle')} body={errorMessage(wallet.error, t)} /></Screen>;
  }

  return (
    <Screen bottomPad={40} onRefresh={() => Promise.all([wallet.refetch(), tx.refetch(), payments.refetch()]).then(() => undefined)} refreshing={wallet.isRefetching || tx.isRefetching}>
      <FirstVisitTip screen="wallet" />
      <Header title={t('wallet.title')} subtitle={t('wallet.subtitle')} back />

      <Hero colors={['#0F766E', '#14B8A6']}>
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text size="sm" color="#E6FFFB">{t('wallet.balance')}</Text>
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={22} color="#FFFFFF" onPress={toggleHidden} accessibilityLabel={t(hidden ? 'wallet.showBalance' : 'wallet.hideBalance')} />
          </View>
          <Text size="xxl" serif color="#FFFFFF">
            {hidden ? '••••••' : <CountUp value={wallet.data.balance} format={(n) => `${formatNumber(n)} ${currencyLabel(wallet.data.currency)}`} />}
          </Text>
          <View className="flex-row gap-3">
            <View className="flex-1"><Button title={t('wallet.add')} variant="dark" icon="add" onPress={() => openMode('deposit')} /></View>
            <View className="flex-1"><Button title={t('wallet.withdraw')} variant="ghost" icon="remove" onPress={() => openMode('withdrawal')} /></View>
          </View>
        </View>
      </Hero>

      <Button title={t('savings.title')} variant="ghost" icon="wallet-outline" onPress={() => router.push('/savings')} />
      <Row>
        <View className="flex-1"><Button title={t('wallet.vault')} variant="ghost" icon="lock-closed-outline" onPress={() => router.push('/vault')} /></View>
        <View className="flex-1"><Button title={t('wallet.groups')} variant="ghost" icon="people-outline" onPress={() => router.push('/groups')} /></View>
      </Row>

      {mode && (
        <Card className="gap-3">
          <MoneyField label={t('wallet.amount')} value={amount} onChangeText={setAmount} />
          <Field
            label={t('wallet.phone')}
            left={<Text weight="700" color={th.primary}>{CAMEROON_PREFIX}</Text>}
            value={phone}
            onChangeText={(v) => {
              const clean = sanitizeCameroonLocal(v);
              setPhone(clean);
              const d = detectCameroonProvider(clean);
              if (d && provider !== 'sandbox') setProvider(d);
            }}
            maxLength={CAMEROON_LOCAL_LENGTH}
            keyboardType="number-pad"
            placeholder="671234567"
            hint={t('wallet.phoneHint', { count: phone.length, max: CAMEROON_LOCAL_LENGTH })}
          />
          <Text size="sm" weight="600">{t('wallet.provider')}</Text>
          <Row>
            {(['mtn', 'orange', 'sandbox'] as const).map((p) => (
              <Chip key={p} label={t(`wallet.${p}`)} selected={provider === p} onPress={() => setProvider(p)} />
            ))}
          </Row>
          {detected && <Text size="xs" muted>{t('wallet.suggested', { provider: t(`wallet.${detected}`) })}</Text>}
          {provider !== 'sandbox' && <Text size="xs" muted>{t('wallet.paylinkNote')}</Text>}
          <Button
            title={t(
              provider !== 'sandbox'
                ? (mode === 'deposit' ? 'wallet.submitDepositPaylink' : 'wallet.submitWithdrawalPaylink')
                : (mode === 'deposit' ? 'wallet.submitDeposit' : 'wallet.submitWithdrawal'),
            )}
            icon={provider !== 'sandbox' ? 'open-outline' : undefined}
            loading={action.isPending}
            onPress={() => action.mutate()}
          />
          <Button title={t('common.cancel')} variant="ghost" onPress={() => setMode(null)} />
        </Card>
      )}

      {activePaylink && activePaylink.paylink_url && (
        <Card className="gap-3">
          <View className="flex-row items-center justify-between gap-2">
            <Text weight="700">{t('wallet.paylinkReady')}</Text>
            <Pill
              label={t(`wallet.status.${activePaylink.status}`)}
              tone={activePaylink.status === 'succeeded' ? 'success' : activePaylink.status === 'failed' ? 'error' : 'warning'}
            />
          </View>
          <Text size="sm" muted>
            {t('wallet.paylinkBody', { amount: formatNumber(activePaylink.amount), currency: currencyLabel(activePaylink.currency) })}
          </Text>
          <Button title={t('wallet.openPaylink')} icon="open-outline" onPress={() => openUrl(activePaylink.paylink_url)} />
          <Row>
            <View className="flex-1">
              <Button
                title={t('wallet.sharePaylink')}
                variant="ghost"
                icon="share-outline"
                onPress={() => void Share.share({
                  message: t('wallet.sharePaylinkMessage', {
                    amount: formatNumber(activePaylink.amount),
                    currency: currencyLabel(activePaylink.currency),
                    url: activePaylink.paylink_url,
                  }),
                })}
              />
            </View>
            <View className="flex-1">
              <Button
                title={t('wallet.checkStatus')}
                variant="dark"
                loading={syncPayment.isPending && syncPayment.variables === activePaylink.id}
                onPress={() => syncPayment.mutate(activePaylink.id)}
              />
            </View>
          </Row>
        </Card>
      )}

      <ErrorText message={message} />

      {pendingPaylinks.length > 0 && (
        <>
          <SectionHeader title={t('wallet.pendingPaylinks')} />
          {pendingPaylinks.map((item) => (
            <Card key={item.id} className="gap-3">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text weight="600">{t(`wallet.kind.${item.direction}`)}</Text>
                  <Text size="xs" muted>{formatNumber(item.amount)} {currencyLabel(item.currency)}</Text>
                </View>
                <Pill label={t(`wallet.status.${item.status}`)} tone="warning" />
              </View>
              <Row>
                <View className="flex-1">
                  <Button title={t('wallet.openPaylink')} variant="ghost" icon="open-outline" onPress={() => openUrl(item.paylink_url)} />
                </View>
                <View className="flex-1">
                  <Button
                    title={t('wallet.checkStatus')}
                    loading={syncPayment.isPending && syncPayment.variables === item.id}
                    disabled={syncPayment.isPending && syncPayment.variables !== item.id}
                    onPress={() => syncPayment.mutate(item.id)}
                  />
                </View>
              </Row>
            </Card>
          ))}
        </>
      )}

      <SectionHeader title={t('wallet.recent')} />
      <Row>
        {['all', 'pending', 'succeeded', 'failed'].map((s) => (
          <Chip key={s} label={t(s === 'all' ? 'wallet.all' : `wallet.status.${s}`)} selected={filter === s} onPress={() => setFilter(s)} />
        ))}
      </Row>
      {!tx.data?.length ? (
        <Card><EmptyState icon="receipt-outline" title={t('wallet.empty')} /></Card>
      ) : tx.data.map((item) => (
        <Card key={item.id}>
          <View className="flex-row items-center justify-between">
            <View>
              <Text weight="600">{t(`wallet.kind.${item.kind}`)}</Text>
              <Text size="xs" muted>{new Intl.DateTimeFormat(currentLocale(), { dateStyle: 'medium' }).format(new Date(item.created_at))}</Text>
            </View>
            <View className="items-end gap-1">
              <Text weight="700" color={item.kind === 'deposit' ? th.success : th.text}>
                {item.kind === 'deposit' ? '+' : '−'}{formatNumber(item.amount)} {currencyLabel(item.currency)}
              </Text>
              <Pill label={t(`wallet.status.${item.status}`)} tone={item.status === 'succeeded' ? 'success' : item.status === 'failed' ? 'error' : 'warning'} />
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
