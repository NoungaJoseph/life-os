import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Switch, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MoneyField } from '../src/components/MoneyField';
import { FirstVisitTip } from '../src/components/Tutorial';
import { Button, Card, EmptyState, ErrorText, Field, Header, Hero, Loading, ProgressBar, ProgressRing, Screen, SectionHeader, Text } from '../src/components/ui';
import { formatNumber } from '../src/i18n';
import { api } from '../src/lib/api';
import { errorMessage } from '../src/lib/errors';
import { parseMoneyInput } from '../src/lib/moneyInput';
import { useTheme } from '../src/theme/useTheme';

type Goal={id:string;title:string;vault_enabled:boolean;vault_emergency:boolean;vault_priority:number;vault_target:number|null;balance:number};
type Vault={accepted:boolean;emergency_share:number;total_locked:number;goals:Goal[];available_goals:Goal[]};
type Preview={amount:number;parts:{goalId:string;title:string;amount:number}[]};
const key=()=>`vault-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
export default function VaultScreen(){
  const {t}=useTranslation();const th=useTheme();const router=useRouter();const qc=useQueryClient();const [accepted,setAccepted]=useState(false);const [amount,setAmount]=useState('');const [editing,setEditing]=useState<string|null>(null);const [target,setTarget]=useState('');const [priority,setPriority]=useState('3');const [emergency,setEmergency]=useState(false);const [preview,setPreview]=useState<Preview|null>(null);const [err,setErr]=useState<string|null>(null);
  const params=useLocalSearchParams<{consent?:string}>();const visual=process.env.EXPO_PUBLIC_VISUAL_TESTS==='1';const visualVault:Vault={accepted:params.consent!=='1',emergency_share:20,total_locked:65000,goals:[{id:'emergency',title:t('vault.emergency'),vault_enabled:true,vault_emergency:true,vault_priority:5,vault_target:200000,balance:50000},{id:'rent',title:t('vault.sampleRent'),vault_enabled:true,vault_emergency:false,vault_priority:4,vault_target:75000,balance:15000}],available_goals:[]};
  const q=useQuery({queryKey:['vault'],queryFn:()=>visual?Promise.resolve(visualVault):api<Vault>('/vault')});const refresh=()=>qc.invalidateQueries({queryKey:['vault']});
  const consent=useMutation({mutationFn:()=>api('/vault/consent',{method:'PUT'}),onSuccess:()=>void refresh(),onError:e=>setErr(errorMessage(e,t))});
  const enable=useMutation({mutationFn:(id:string)=>api(`/vault/goals/${id}`,{method:'PUT',body:{enabled:true,emergency,priority:Number(priority),target:parseMoneyInput(target)}}),onSuccess:()=>{setEditing(null);void refresh();},onError:e=>setErr(errorMessage(e,t))});
  const previewM=useMutation({mutationFn:()=>api<Preview>('/vault/preview',{method:'POST',body:{amount:parseMoneyInput(amount)}}),onSuccess:setPreview,onError:e=>setErr(errorMessage(e,t))});
  const deposit=useMutation({mutationFn:()=>api('/vault/deposits',{method:'POST',headers:{'Idempotency-Key':key()},body:{amount:parseMoneyInput(amount)}}),onSuccess:()=>{setPreview(null);setAmount('');void Promise.all([refresh(),qc.invalidateQueries({queryKey:['wallet']})]);},onError:e=>setErr(errorMessage(e,t))});
  if(q.isLoading)return <Loading/>;if(q.error||!q.data)return <Screen><EmptyState icon="cloud-offline-outline" title={t('ui.errorTitle')} body={q.error?errorMessage(q.error,t):t('vault.loadError')}/></Screen>;const data=q.data;
  if(!data.accepted)return <Screen><Header title={t('vault.howTitle')} back/><FirstVisitTip screen="vault"/><View className="items-center py-6"><View className="h-28 w-28 items-center justify-center rounded-full bg-surface-alt"><Ionicons name="lock-closed" size={54} color={th.primary}/></View></View><Text size="xl" serif style={{textAlign:'center'}}>{t('vault.howTitle')}</Text><Text muted style={{textAlign:'center'}}>{t('vault.howBody')}</Text><Pressable className="flex-row items-start gap-3 rounded-lg border border-line bg-surface p-4" onPress={()=>setAccepted(!accepted)} accessibilityRole="checkbox" accessibilityState={{checked:accepted}}><Ionicons name={accepted?'checkbox':'square-outline'} size={24} color={th.primary}/><Text size="sm" style={{flex:1}}>{t('vault.acknowledge')}</Text></Pressable><Button title={t('vault.accept')} disabled={!accepted} loading={consent.isPending} onPress={()=>consent.mutate()}/><ErrorText message={err}/></Screen>;
  const next=[...data.goals].sort((a,b)=>(a.vault_target!-a.balance)-(b.vault_target!-b.balance))[0];
  const openNewGoal=()=>router.push({pathname:'/new-goal',params:{from:'vault'}});
  const available=data.available_goals.filter(g=>!g.vault_enabled);
  const targetNum=parseMoneyInput(target);
  const amountNum=parseMoneyInput(amount);
  return <Screen bottomPad={40} onRefresh={()=>q.refetch().then(()=>undefined)} refreshing={q.isRefetching}><FirstVisitTip screen="vault"/><Header title={t('vault.title')} subtitle={t('vault.subtitle')} back/><Hero><Text size="sm" color="#C9D6E3">{t('vault.locked')}</Text><Text size="xxl" serif color="#FFFFFF">{formatNumber(data.total_locked)} FCFA</Text>{next&&<Text size="xs" color="#E9D9A6">{t('vault.nextUnlock',{title:next.title,amount:formatNumber(next.vault_target!-next.balance)})}</Text>}</Hero>
    <SectionHeader title={t('vault.goals')}/>{data.goals.map(g=><Card key={g.id}><View className="flex-row items-center gap-4"><ProgressRing value={g.vault_target?g.balance/g.vault_target:0} size={78} label={`${Math.round((g.balance/(g.vault_target||1))*100)}%`}/><View className="flex-1 gap-2"><Text weight="700">{g.title}</Text><Text size="xs" muted>{formatNumber(g.balance)} / {formatNumber(g.vault_target||0)} FCFA</Text><ProgressBar value={g.balance/(g.vault_target||1)}/></View></View></Card>)}
    <SectionHeader title={t('vault.addGoal')} action={t('vault.createGoal')} onAction={openNewGoal}/>{available.length===0&&data.goals.length===0?<EmptyState icon="flag-outline" title={t('vault.noGoals')} action={t('vault.createGoal')} onAction={openNewGoal}/>:available.length===0?<Button title={t('vault.createGoal')} variant="ghost" icon="add" onPress={openNewGoal}/>:available.map(g=><Card key={g.id}><Text weight="700">{g.title}</Text>{editing===g.id?<><MoneyField label={t('vault.target')} value={target} onChangeText={setTarget}/><Field label={t('vault.priority')} value={priority} onChangeText={setPriority} keyboardType="number-pad"/><View className="flex-row items-center justify-between"><Text size="sm">{t('vault.emergency')}</Text><Switch value={emergency} onValueChange={setEmergency}/></View><Button title={t('vault.enable')} loading={enable.isPending} disabled={!Number.isSafeInteger(targetNum)||targetNum<=0} onPress={()=>enable.mutate(g.id)}/></>:<Button title={t('vault.enable')} variant="ghost" onPress={()=>{setEditing(g.id);setTarget('');setPriority('3');setEmergency(false);}}/>}</Card>)}
    {data.goals.length>0&&<><SectionHeader title={t('vault.deposit')}/><Card className="gap-3"><MoneyField label={t('vault.amount')} value={amount} onChangeText={v=>{setAmount(v);setPreview(null);}}/><Button title={t('vault.preview')} loading={previewM.isPending} disabled={!Number.isSafeInteger(amountNum)||amountNum<=0} onPress={()=>previewM.mutate()}/>{preview&&<><Text size="sm" muted>{t('vault.exact',{amount:formatNumber(preview.amount)})}</Text>{preview.parts.map(p=><View key={p.goalId} className="flex-row justify-between"><Text size="sm">{p.title}</Text><Text size="sm" weight="700">{formatNumber(p.amount)} FCFA</Text></View>)}<Button title={t('vault.confirm')} loading={deposit.isPending} onPress={()=>deposit.mutate()}/></>}</Card></>}<ErrorText message={err}/>
  </Screen>;
}
