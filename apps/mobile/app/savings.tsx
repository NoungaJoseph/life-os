import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { DateField } from '../src/components/DateField';
import { MoneyField } from '../src/components/MoneyField';
import { Button, Card, Chip, EmptyState, ErrorState, ErrorText, Field, Header, Hero, Loading, ProgressBar, Row, Screen, SectionHeader, Text } from '../src/components/ui';
import { formatNumber } from '../src/i18n';
import { api } from '../src/lib/api';
import { errorMessage } from '../src/lib/errors';
import { parseMoneyInput } from '../src/lib/moneyInput';
import { moneyKey, SavingsOverview } from '../src/lib/savings';

export default function Savings() {
  const { t }=useTranslation();const router=useRouter();const qc=useQueryClient();
  const q=useQuery({queryKey:['personal-savings'],queryFn:()=>api<SavingsOverview>('/savings')});
  const [amount,setAmount]=useState('');const [mode,setMode]=useState<'deposit'|'withdraw'|null>(null);
  const [creating,setCreating]=useState(false);
  const [name,setName]=useState('');const [target,setTarget]=useState('');const [contribution,setContribution]=useState('');
  const [frequency,setFrequency]=useState<'daily'|'weekly'|'monthly'>('weekly');const [targetDate,setTargetDate]=useState('');const [lockedUntil,setLockedUntil]=useState('');
  const refresh=()=>{void qc.invalidateQueries({queryKey:['personal-savings']});void qc.invalidateQueries({queryKey:['wallet']});};
  const move=useMutation({mutationFn:()=>{const n=parseMoneyInput(amount);if(!Number.isSafeInteger(n)||n<=0)throw new Error(t('savings.invalidAmount'));return api(`/savings/${mode}`,{method:'POST',headers:{'Idempotency-Key':moneyKey()},body:{amount:n}});},onSuccess:()=>{setAmount('');setMode(null);refresh();}});
  const create=useMutation({mutationFn:()=>{const targetAmount=parseMoneyInput(target), installment=parseMoneyInput(contribution);if(!name.trim()||!Number.isSafeInteger(targetAmount)||targetAmount<=0||!Number.isSafeInteger(installment)||installment<=0)throw new Error(t('savings.invalidGoal'));return api('/savings/goals',{method:'POST',body:{name:name.trim(),target_amount:targetAmount,contribution_amount:installment,frequency,...(targetDate?{target_date:targetDate}:{}),...(lockedUntil?{locked_until:lockedUntil}:{})}});},onSuccess:()=>{setCreating(false);setName('');setTarget('');setContribution('');setTargetDate('');setLockedUntil('');refresh();}});
  if(q.isLoading)return<Loading/>;if(q.error||!q.data)return<Screen><ErrorState message={errorMessage(q.error,t)} onRetry={()=>void q.refetch()}/></Screen>;
  const s=q.data;
  return <Screen bottomPad={50} onRefresh={()=>void q.refetch()} refreshing={q.isRefetching}>
    <Header title={t('savings.title')} subtitle={t('savings.subtitle')} back />
    <Hero colors={['#0F766E','#145E59']}><Text size="sm" color="#D9F7EF">{t('savings.total')}</Text><Text size="xxl" serif color="#FFFFFF">{formatNumber(s.total_balance)} FCFA</Text><Text size="sm" color="#D9F7EF">{t('savings.available')}: {formatNumber(s.available_balance)} FCFA</Text></Hero>
    <Text size="sm" muted>{t('savings.walletBalance',{amount:formatNumber(s.wallet_balance)})}</Text>
    <Row><View className="flex-1"><Button title={t('savings.addMoney')} icon="add" onPress={()=>setMode('deposit')}/></View><View className="flex-1"><Button title={t('savings.returnWallet')} variant="ghost" onPress={()=>setMode('withdraw')}/></View></Row>
    {mode&&<Card className="gap-3"><Text weight="600">{t(mode==='deposit'?'savings.addMoney':'savings.returnWallet')}</Text><MoneyField label={t('savings.amount')} value={amount} onChangeText={setAmount}/><ErrorText message={move.error?errorMessage(move.error,t):null}/><Button title={t('common.save')} loading={move.isPending} onPress={()=>move.mutate()}/><Button title={t('common.cancel')} variant="ghost" onPress={()=>setMode(null)}/></Card>}
    <Text size="xs" muted>{t('savings.topUpHint')}</Text><Button title={t('savings.openWallet')} variant="ghost" icon="wallet-outline" onPress={()=>router.push('/wallet')}/>
    <SectionHeader title={t('savings.goals')} action={t('savings.newGoal')} onAction={()=>setCreating(!creating)}/>
    {creating&&<Card className="gap-3"><Field label={t('savings.goalName')} value={name} onChangeText={setName}/><MoneyField label={t('savings.target')} value={target} onChangeText={setTarget}/><MoneyField label={t('savings.installment')} value={contribution} onChangeText={setContribution}/><Row>{(['daily','weekly','monthly'] as const).map(f=><Chip key={f} label={t(`groups.${f}`)} selected={frequency===f} onPress={()=>setFrequency(f)}/>)}</Row><DateField label={t('savings.targetDate')} value={targetDate} onChange={setTargetDate}/><DateField label={t('savings.lockUntil')} value={lockedUntil} onChange={setLockedUntil}/><Text size="xs" muted>{t('savings.lockNote')}</Text><ErrorText message={create.error?errorMessage(create.error,t):null}/><Button title={t('savings.createGoal')} loading={create.isPending} onPress={()=>create.mutate()}/></Card>}
    {!s.goals.length?<EmptyState icon="flag-outline" title={t('savings.empty')} action={t('savings.newGoal')} onAction={()=>setCreating(true)}/>:s.goals.map(g=><Card key={g.id} onPress={()=>router.push(`/savings/${g.id}`)}><View className="flex-row justify-between"><Text weight="600">{g.name}</Text><Text size="sm" muted>{Math.min(100,Math.round(g.balance/g.target_amount*100))}%</Text></View><ProgressBar value={g.balance/g.target_amount}/><Text size="sm" muted>{formatNumber(g.balance)} / {formatNumber(g.target_amount)} FCFA</Text><Text size="xs" muted>{t('savings.projection',{date:g.projected_completion,count:g.installments_remaining})}</Text></Card>)}
    <SectionHeader title={t('savings.groups')} /><Button title={t('savings.regularGroups')} variant="ghost" icon="people-outline" onPress={()=>router.push('/groups')}/><Button title={t('savings.familyGroups')} variant="ghost" icon="heart-outline" onPress={()=>router.push('/family-savings')}/>
  </Screen>;
}
