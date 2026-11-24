import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button, Card, Check, EmptyState, ErrorState, ErrorText, Field, Header, Hero, Loading, Screen, Text } from '../src/components/ui';
import { formatNumber } from '../src/i18n';
import { api } from '../src/lib/api';
import { errorMessage } from '../src/lib/errors';

type Family = {id:string;name:string;balance:number};
export default function FamilySavings(){
  const {t}=useTranslation();const router=useRouter();const qc=useQueryClient();const params=useLocalSearchParams<{code?:string}>();
  const [mode,setMode]=useState<'create'|'join'|null>(params.code?'join':null);const [name,setName]=useState('');const [code,setCode]=useState(params.code??'');const [adult,setAdult]=useState(false);
  const q=useQuery({queryKey:['family-savings'],queryFn:()=>api<Family[]>('/family-savings')});
  const preview=useQuery({queryKey:['family-preview',code.trim().toUpperCase()],queryFn:()=>api<{name:string}>(`/family-savings/preview/${encodeURIComponent(code.trim().toUpperCase())}`),enabled:mode==='join'&&code.trim().length>=8,retry:false});
  const mutation=useMutation({mutationFn:()=>api<{id:string}>(mode==='create'?'/family-savings':'/family-savings/join',{method:'POST',body:mode==='create'?{name,adult_confirmed:adult}:{invite_code:code.trim().toUpperCase(),adult_confirmed:adult}}),onSuccess:(group)=>{void qc.invalidateQueries({queryKey:['family-savings']});router.replace(`/family-savings/${group.id}`);}});
  if(q.isLoading)return<Loading/>;if(q.error)return<Screen><ErrorState message={errorMessage(q.error,t)} onRetry={()=>void q.refetch()}/></Screen>;
  return<Screen bottomPad={50}><Header title={t('familySavings.title')} subtitle={t('familySavings.subtitle')} back/>
    <Hero><Text size="xl" serif color="#FFFFFF">{t('familySavings.pooled')}</Text><Text size="sm" color="#D9E5F0">{t('familySavings.pooledHint')}</Text></Hero>
    <View className="gap-2"><Button title={t('familySavings.create')} onPress={()=>{setMode('create');setAdult(false);}}/><Button title={t('familySavings.join')} variant="ghost" onPress={()=>{setMode('join');setAdult(false);}}/></View>
    {mode?<Card className="gap-3">{mode==='create'?<Field label={t('familySavings.name')} value={name} onChangeText={setName} placeholder={t('familySavings.namePlaceholder')}/>:<><Field label={t('familySavings.code')} value={code} onChangeText={setCode} autoCapitalize="characters"/>{preview.data?<Text>{t('familySavings.preview',{name:preview.data.name})}</Text>:null}{preview.error?<ErrorText message={errorMessage(preview.error,t)}/>:null}</>}
      <View className="flex-row items-start gap-3"><Check checked={adult} label={t('familySavings.adultConfirm')} onPress={()=>setAdult(!adult)}/><Text size="sm" style={{flex:1}}>{t('familySavings.adultConfirm')}</Text></View>
      <ErrorText message={mutation.error?errorMessage(mutation.error,t):null}/><Button title={t(mode==='create'?'familySavings.createAction':'familySavings.joinAction')} disabled={!adult||(mode==='join'&&!preview.data)} loading={mutation.isPending} onPress={()=>mutation.mutate()}/><Button title={t('common.cancel')} variant="ghost" onPress={()=>setMode(null)}/></Card>:null}
    {!q.data?.length?<EmptyState icon="people-outline" title={t('familySavings.empty')}/>:q.data.map(group=><Card key={group.id} onPress={()=>router.push(`/family-savings/${group.id}`)}><Text weight="600">{group.name}</Text><Text size="sm" muted>{formatNumber(group.balance)} FCFA</Text></Card>)}
  </Screen>;
}
