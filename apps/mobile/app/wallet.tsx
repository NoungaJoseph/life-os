import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { FirstVisitTip } from '../src/components/Tutorial';
import { Button, Card, Chip, CountUp, EmptyState, ErrorText, Field, Header, Hero, Loading, Pill, Row, Screen, SectionHeader, Text } from '../src/components/ui';
import { currencyLabel, currentLocale, formatNumber } from '../src/i18n';
import { api } from '../src/lib/api';
import { errorMessage } from '../src/lib/errors';
import { useTheme } from '../src/theme/useTheme';

type Wallet = { id: string; balance: number; currency: string; daily_limit: number };
type Tx = { id: string; kind: string; status: string; amount: number; currency: string; created_at: string };
const HIDE_KEY='mylifeos:wallet:hide-balance';
const idempotencyKey=()=>`mobile-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
const suggest=(phone:string)=>{const n=phone.replace(/\D/g,'').replace(/^237/,'').replace(/^0/,'');if(/^(67\d|65[0-4]|68[0-3])/.test(n))return'mtn';if(/^(69\d|65[5-9]|640)/.test(n))return'orange';return null;};

export default function WalletScreen(){
  const {t}=useTranslation(); const th=useTheme(); const router=useRouter(); const qc=useQueryClient();
  const [hidden,setHidden]=useState(false); const [mode,setMode]=useState<'deposit'|'withdrawal'|null>(null); const [amount,setAmount]=useState(''); const [phone,setPhone]=useState(''); const [provider,setProvider]=useState<'sandbox'|'mtn'|'orange'>('sandbox'); const [filter,setFilter]=useState('all'); const [message,setMessage]=useState<string|null>(null);
  useEffect(()=>{void AsyncStorage.getItem(HIDE_KEY).then(v=>setHidden(v==='1'));},[]);
  const visual=process.env.EXPO_PUBLIC_VISUAL_TESTS==='1';
  const wallet=useQuery({queryKey:['wallet'],queryFn:()=>visual?Promise.resolve({id:'preview',balance:125000,currency:'XAF',daily_limit:500000}):api<Wallet>('/wallet')});
  const tx=useQuery({queryKey:['wallet','transactions',filter],queryFn:()=>visual?Promise.resolve([{id:'preview-1',kind:'deposit',status:'succeeded',amount:150000,currency:'XAF',created_at:new Date().toISOString()},{id:'preview-2',kind:'vault_transfer',status:'succeeded',amount:25000,currency:'XAF',created_at:new Date(Date.now()-86400000).toISOString()}].filter(row=>filter==='all'||row.status===filter)):api<Tx[]>(`/wallet/transactions${filter==='all'?'':`?status=${filter}`}`)});
  const action=useMutation({mutationFn:async()=>{const n=Number(amount);if(!Number.isSafeInteger(n)||n<=0)throw new Error(t('wallet.invalidAmount'));return api(`/wallet/${mode==='deposit'?'deposits':'withdrawals'}`,{method:'POST',headers:{'Idempotency-Key':idempotencyKey()},body:{amount:n,phone,provider}});},onSuccess:()=>{setMessage(t('wallet.success'));setAmount('');setMode(null);void qc.invalidateQueries({queryKey:['wallet']});},onError:e=>setMessage(errorMessage(e,t))});
  const toggleHidden=()=>{const next=!hidden;setHidden(next);void AsyncStorage.setItem(HIDE_KEY,next?'1':'0');}; const detected=suggest(phone);
  if(wallet.isLoading)return <Loading/>; if(wallet.error||!wallet.data)return <Screen><EmptyState icon="cloud-offline-outline" title={t('ui.errorTitle')} body={errorMessage(wallet.error,t)}/></Screen>;
  return <Screen bottomPad={40} onRefresh={()=>Promise.all([wallet.refetch(),tx.refetch()]).then(()=>undefined)} refreshing={wallet.isRefetching||tx.isRefetching}>
    <FirstVisitTip screen="wallet"/><Header title={t('wallet.title')} subtitle={t('wallet.subtitle')} back/>
    <Hero colors={['#0F766E','#14B8A6']}><View className="gap-4"><View className="flex-row items-center justify-between"><Text size="sm" color="#E6FFFB">{t('wallet.balance')}</Text><Ionicons name={hidden?'eye-off-outline':'eye-outline'} size={22} color="#FFFFFF" onPress={toggleHidden} accessibilityLabel={t(hidden?'wallet.showBalance':'wallet.hideBalance')}/></View><Text size="xxl" serif color="#FFFFFF">{hidden?'••••••':<CountUp value={wallet.data.balance} format={(n)=>`${formatNumber(n)} ${currencyLabel(wallet.data.currency)}`}/>}</Text><View className="flex-row gap-3"><View className="flex-1"><Button title={t('wallet.add')} variant="dark" icon="add" onPress={()=>setMode('deposit')}/></View><View className="flex-1"><Button title={t('wallet.withdraw')} variant="ghost" icon="remove" onPress={()=>setMode('withdrawal')}/></View></View></View></Hero>
    <Row><View className="flex-1"><Button title={t('wallet.vault')} variant="ghost" icon="lock-closed-outline" onPress={()=>router.push('/vault')}/></View><View className="flex-1"><Button title={t('wallet.groups')} variant="ghost" icon="people-outline" onPress={()=>router.push('/groups')}/></View></Row>
    {mode&&<Card className="gap-3"><Field label={t('wallet.amount')} value={amount} onChangeText={setAmount} keyboardType="number-pad"/><Field label={t('wallet.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad"/><Text size="sm" weight="600">{t('wallet.provider')}</Text><Row>{(['sandbox','mtn','orange'] as const).map(p=><Chip key={p} label={t(`wallet.${p}`)} selected={provider===p} onPress={()=>setProvider(p)}/>)}</Row>{detected&&<Text size="xs" muted>{t('wallet.suggested',{provider:t(`wallet.${detected}`)})}</Text>}<Button title={t(mode==='deposit'?'wallet.submitDeposit':'wallet.submitWithdrawal')} loading={action.isPending} onPress={()=>action.mutate()}/><Button title={t('common.cancel')} variant="ghost" onPress={()=>setMode(null)}/></Card>}
    <ErrorText message={message}/><SectionHeader title={t('wallet.recent')}/><Row>{['all','pending','succeeded','failed'].map(s=><Chip key={s} label={t(s==='all'?'wallet.all':`wallet.status.${s}`)} selected={filter===s} onPress={()=>setFilter(s)}/>)}</Row>
    {!tx.data?.length?<Card><EmptyState icon="receipt-outline" title={t('wallet.empty')}/></Card>:tx.data.map(item=><Card key={item.id}><View className="flex-row items-center justify-between"><View><Text weight="600">{t(`wallet.kind.${item.kind}`)}</Text><Text size="xs" muted>{new Intl.DateTimeFormat(currentLocale(),{dateStyle:'medium'}).format(new Date(item.created_at))}</Text></View><View className="items-end gap-1"><Text weight="700" color={item.kind==='deposit'?th.success:th.text}>{item.kind==='deposit'?'+':'−'}{formatNumber(item.amount)} {currencyLabel(item.currency)}</Text><Pill label={t(`wallet.status.${item.status}`)} tone={item.status==='succeeded'?'success':item.status==='failed'?'error':'warning'}/></View></View></Card>)}
  </Screen>;
}
