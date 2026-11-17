import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { FirstVisitTip } from '../src/components/Tutorial';
import { Button, Card, EmptyState, Header, Loading, Row, Screen, Text } from '../src/components/ui';
import { api } from '../src/lib/api';
import { useTheme } from '../src/theme/useTheme';

type Group={id:string;name:string;contribution_amount:number;frequency:'daily'|'weekly'|'monthly';end_date:string;status:string};
export default function GroupsScreen(){const{t}=useTranslation();const router=useRouter();const th=useTheme();const visual=process.env.EXPO_PUBLIC_VISUAL_TESTS==='1';const query=useQuery({queryKey:['groups'],queryFn:()=>visual?Promise.resolve([{id:'preview',name:'Back-to-school fund',contribution_amount:10000,frequency:'weekly',end_date:'2027-08-15',status:'active'}] as Group[]):api<Group[]>('/groups')});
  if(query.isLoading)return<Loading/>;
  return <Screen onRefresh={()=>query.refetch().then(()=>undefined)} refreshing={query.isRefetching}><FirstVisitTip screen="groups"/><Header title={t('groups.title')} subtitle={t('groups.subtitle')} back/><View className="gap-2"><Button title={t('groups.create')} icon="add" onPress={()=>router.push('/group-create')}/><Button title={t('groups.join')} icon="enter-outline" variant="ghost" onPress={()=>router.push('/group-join')}/></View>{!query.data?.length?<Card><EmptyState icon="people-outline" title={t('groups.empty')}/></Card>:query.data.map(group=><Card key={group.id} onPress={()=>router.push(`/group/${group.id}`)}><View className="flex-row items-center gap-3"><View className="h-12 w-12 items-center justify-center rounded-2xl" style={{backgroundColor:th.surfaceAlt}}><Ionicons name="people" size={24} color={th.primary}/></View><View className="flex-1"><Text weight="700">{group.name}</Text><Text size="sm" muted>{t(`groups.${group.frequency}`)} · {group.end_date}</Text></View><Ionicons name="chevron-forward" size={20} color={th.textSecondary}/></View></Card>)}</Screen>}
