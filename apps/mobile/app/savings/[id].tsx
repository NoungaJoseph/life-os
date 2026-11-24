import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MoneyField } from '../../src/components/MoneyField';
import { Button, Card, EmptyState, ErrorState, ErrorText, Header, Hero, Loading, ProgressBar, Screen, SectionHeader, Text } from '../../src/components/ui';
import { formatNumber } from '../../src/i18n';
import { api } from '../../src/lib/api';
import { errorMessage } from '../../src/lib/errors';
import { parseMoneyInput } from '../../src/lib/moneyInput';
import { moneyKey, SavingsOverview } from '../../src/lib/savings';

export default function SavingsGoalDetail(){
  const {id}=useLocalSearchParams<{id:string}>();const {t}=useTranslation();const qc=useQueryClient();const [amount,setAmount]=useState('');
  const q=useQuery({queryKey:['personal-savings'],queryFn:()=>api<SavingsOverview>('/savings')});
  const [action,setAction]=useState<'allocate'|'release'|null>(null);
  const move=useMutation({mutationFn:()=>{const n=parseMoneyInput(amount);if(!Number.isSafeInteger(n)||n<=0)throw new Error(t('savings.invalidAmount'));return api(`/savings/${action}`,{method:'POST',headers:{'Idempotency-Key':moneyKey()},body:{amount:n,goal_id:id}});},onSuccess:()=>{setAmount('');setAction(null);void qc.invalidateQueries({queryKey:['personal-savings']});}});
  if(q.isLoading)return<Loading/>;if(q.error)return<Screen><ErrorState message={errorMessage(q.error,t)} onRetry={()=>void q.refetch()}/></Screen>;
  const goal=q.data?.goals.find(g=>g.id===id);if(!goal)return<Screen><Header title={t('savings.goals')} back/><EmptyState title={t('savings.notFound')}/></Screen>;
  const locked=!!goal.locked_until&&goal.locked_until>new Date().toISOString().slice(0,10);
  return<Screen bottomPad={40} onRefresh={()=>void q.refetch()} refreshing={q.isRefetching}>
    <Header title={goal.name} subtitle={t('savings.goalDetail')} back/>
    <Hero><Text size="sm" color="#E9D9A6">{t('savings.saved')}</Text><Text size="xxl" serif color="#FFFFFF">{formatNumber(goal.balance)} FCFA</Text><Text size="sm" color="#FFFFFF">{t('savings.ofTarget',{amount:formatNumber(goal.target_amount)})}</Text></Hero>
    <ProgressBar value={goal.balance/goal.target_amount}/>
    <Card><Text>{t('savings.plan',{amount:formatNumber(goal.contribution_amount),frequency:t(`groups.${goal.frequency}`)})}</Text><Text size="sm" muted>{t('savings.projection',{date:goal.projected_completion,count:goal.installments_remaining})}</Text>{goal.target_date?<Text size="sm" muted>{t('savings.targetDate')}: {goal.target_date}</Text>:null}{goal.locked_until?<Text size="sm" muted>{t('savings.lockedUntil',{date:goal.locked_until})}</Text>:null}</Card>
    <SectionHeader title={t('savings.manage')} /><Text size="sm" muted>{t('savings.available')}: {formatNumber(q.data?.available_balance??0)} FCFA</Text>
    <Button title={t('savings.moveToGoal')} onPress={()=>setAction('allocate')}/>
    <Button title={t('savings.moveBack')} variant="ghost" disabled={locked||goal.balance<=0} onPress={()=>setAction('release')}/>
    {locked?<Text size="sm" muted>{t('savings.lockedUntil',{date:goal.locked_until})}</Text>:null}
    {action?<Card className="gap-3"><MoneyField label={t('savings.amount')} value={amount} onChangeText={setAmount}/><ErrorText message={move.error?errorMessage(move.error,t):null}/><Button title={t('common.save')} loading={move.isPending} onPress={()=>move.mutate()}/><Button title={t('common.cancel')} variant="ghost" onPress={()=>setAction(null)}/></Card>:null}
  </Screen>;
}
