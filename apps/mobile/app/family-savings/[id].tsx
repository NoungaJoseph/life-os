import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, View } from 'react-native';
import { MoneyField } from '../../src/components/MoneyField';
import { Button, Card, EmptyState, ErrorState, ErrorText, Field, Header, Hero, Loading, Screen, SectionHeader, Text } from '../../src/components/ui';
import { formatNumber } from '../../src/i18n';
import { api } from '../../src/lib/api';
import { errorMessage } from '../../src/lib/errors';
import { parseMoneyInput } from '../../src/lib/moneyInput';
import { moneyKey } from '../../src/lib/savings';
import { useSession } from '../../src/lib/session';

type Request={id:string;requester_id:string;approver_id:string|null;amount:number;reason:string;status:'pending'|'approved'|'rejected';created_at:string};
type Family={id:string;name:string;invite_code:string;balance:number;members:{user_id:string}[];contributions:{user_id:string;amount:number;created_at:string}[];requests:Request[]};
export default function FamilySavingsDetail(){
  const {id}=useLocalSearchParams<{id:string}>();const {t}=useTranslation();const {session}=useSession();const qc=useQueryClient();
  const [mode,setMode]=useState<'contribute'|'request'|null>(null);const [amount,setAmount]=useState('');const [reason,setReason]=useState('');
  const q=useQuery({queryKey:['family-savings',id],queryFn:()=>api<Family>(`/family-savings/${id}`)});
  const refresh=()=>{void qc.invalidateQueries({queryKey:['family-savings']});void qc.invalidateQueries({queryKey:['wallet']});};
  const submit=useMutation({mutationFn:()=>{const n=parseMoneyInput(amount);if(!Number.isSafeInteger(n)||n<=0||mode==='request'&&reason.trim().length<8)throw new Error(t('familySavings.invalid'));return api(`/family-savings/${id}/${mode==='contribute'?'contributions':'requests'}`,{method:'POST',...(mode==='contribute'?{headers:{'Idempotency-Key':moneyKey()}}:{}),body:mode==='contribute'?{amount:n}:{amount:n,reason:reason.trim()}});},onSuccess:()=>{setMode(null);setAmount('');setReason('');refresh();}});
  const approve=useMutation({mutationFn:(requestId:string)=>api(`/family-savings/${id}/requests/${requestId}/approve`,{method:'POST'}),onSuccess:refresh});
  if(q.isLoading)return<Loading/>;if(q.error||!q.data)return<Screen><ErrorState message={errorMessage(q.error,t)} onRetry={()=>void q.refetch()}/></Screen>;
  const family=q.data;const link=`mylifeos:///family-savings?code=${encodeURIComponent(family.invite_code)}`;
  return<Screen bottomPad={50} onRefresh={()=>void q.refetch()} refreshing={q.isRefetching}>
    <Header title={family.name} subtitle={t('familySavings.subtitle')} back/>
    <Hero colors={['#0F766E','#145E59']}><Text size="sm" color="#D9F7EF">{t('familySavings.balance')}</Text><Text size="xxl" serif color="#FFFFFF">{formatNumber(family.balance)} FCFA</Text></Hero>
    <Text size="sm" muted>{t('familySavings.pooledHint')}</Text>
    <View className="gap-2"><Button title={t('familySavings.contribute')} onPress={()=>setMode('contribute')}/><Button title={t('familySavings.request')} variant="ghost" onPress={()=>setMode('request')}/></View>
    {mode?<Card className="gap-3"><MoneyField label={t('familySavings.amount')} value={amount} onChangeText={setAmount}/>{mode==='request'?<Field label={t('familySavings.reason')} value={reason} onChangeText={setReason} multiline/>:null}<ErrorText message={submit.error?errorMessage(submit.error,t):null}/><Button title={t(mode==='request'?'familySavings.submitRequest':'familySavings.contribute')} loading={submit.isPending} onPress={()=>submit.mutate()}/><Button title={t('common.cancel')} variant="ghost" onPress={()=>setMode(null)}/></Card>:null}
    <SectionHeader title={t('familySavings.invite')}/><Text size="lg" weight="700" style={{letterSpacing:2}}>{family.invite_code}</Text><Button title={t('familySavings.share')} variant="ghost" icon="share-outline" onPress={()=>void Share.share({message:t('familySavings.inviteMessage',{link})})}/>
    <SectionHeader title={t('familySavings.members')}/><Text size="sm" muted>{family.members.length}</Text>
    <SectionHeader title={t('familySavings.requests')}/>
    {!family.requests.length?<EmptyState title={t('familySavings.noRequests')}/>:family.requests.map(item=><Card key={item.id} className="gap-2"><Text weight="600">{formatNumber(item.amount)} FCFA</Text><Text size="sm">{item.reason}</Text><Text size="xs" muted>{t(`familySavings.${item.status}`)}</Text>{item.status==='pending'&&item.requester_id!==session?.user.id?<Button title={t('familySavings.approve')} loading={approve.isPending&&approve.variables===item.id} disabled={approve.isPending&&approve.variables!==item.id} onPress={()=>approve.mutate(item.id)}/>:null}{item.status==='pending'&&item.requester_id===session?.user.id?<Text size="xs" muted>{t('familySavings.yourRequest')}</Text>:null}</Card>)}
    <ErrorText message={approve.error?errorMessage(approve.error,t):null}/>
    <SectionHeader title={t('familySavings.contributed')}/>{family.contributions.map((item,index)=><Card key={index}><Text size="sm">{t('familySavings.contributedBy',{amount:formatNumber(item.amount)})}</Text><Text size="xs" muted>{item.created_at.slice(0,10)}</Text></Card>)}
  </Screen>;
}
