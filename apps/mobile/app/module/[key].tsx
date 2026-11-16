import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, View } from 'react-native';
import { Button, Card, Check, Chip, EmptyState, ErrorState, ErrorText, FadeIn, Field, Header, IconBadge, Loading, Press, Row, Screen, Text, success } from '../../src/components/ui';
import { api } from '../../src/lib/api';
import { errorMessage } from '../../src/lib/errors';
import { FieldDef, findModule } from '../../src/lib/modules';
import { spacing } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/useTheme';

const todayStr = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => `${todayStr().slice(0, 7)}-01`;
const initial = (f: FieldDef): string | boolean => {
  if (f.type === 'toggle') return Boolean(f.default);
  if (f.default === 'FIRST_OF_MONTH') return firstOfMonth();
  if (f.default !== undefined) return String(f.default);
  return f.type === 'date' && f.today ? todayStr() : '';
};

/** Grocery items belong to a list; keep it simple with one default list that is created on first use. */
async function ensureGroceryList(name: string): Promise<string> {
  const lists = await api<{ id: string }[]>('/grocery-lists');
  if (lists.length) return lists[0].id;
  return (await api<{ id: string }>('/grocery-lists', { method: 'POST', body: { name, kind: 'weekly' } })).id;
}

export default function ModuleScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const def = findModule(String(key));
  const t = useTheme();
  const { t: tr } = useTranslation();
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string | boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({ queryKey: ['module', def?.key], enabled: !!def, queryFn: () => api<any[]>(`/${def!.path}?pageSize=200${def!.query?.replace('&pageSize=200', '') ?? ''}`) });
  const reload = () => { void qc.invalidateQueries({ queryKey: ['module', def?.key] }); void qc.invalidateQueries({ queryKey: ['finance'] }); void qc.invalidateQueries({ queryKey: ['dashboard'] }); };

  const add = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};
      for (const f of def!.fields) {
        const v = vals[f.key] ?? initial(f);
        if (f.type === 'toggle') { body[f.key] = v === true; continue; }
        if (v === '' || v === undefined) { if (f.required) throw new Error(tr('modules.required', { label: tr(f.label) })); continue; }
        if (f.type === 'number') { const n = Number(String(v).replace(/,/g, '')); if (Number.isNaN(n)) throw new Error(tr('modules.mustBeNumber', { label: tr(f.label) })); body[f.key] = n; }
        else body[f.key] = String(v).trim();
      }
      if (def!.key === 'grocery') body.list_id = await ensureGroceryList(tr('ui.shoppingList'));
      return api(`/${def!.path}`, { method: 'POST', body });
    },
    onSuccess: () => { success(); setOpen(false); setVals({}); setError(null); reload(); },
    onError: (e) => setError(e instanceof Error && !('code' in e) ? e.message : errorMessage(e, tr)),
  });
  const patch = useMutation({ mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api(`/${def!.path}/${id}`, { method: 'PATCH', body }), onSettled: reload });
  const del = useMutation({ mutationFn: (id: string) => api(`/${def!.path}/${id}`, { method: 'DELETE' }), onSettled: reload });

  if (!def) return <Screen><ErrorState message={tr('modules.notFound')} /></Screen>;
  const confirmDelete = (id: string, label: string) => {
    if (Platform.OS === 'web') { if (window.confirm(tr('modules.deleteConfirm', { label }))) del.mutate(id); return; }
    Alert.alert(tr('modules.deleteTitle'), tr('modules.deleteConfirm', { label }), [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('common.delete'), style: 'destructive', onPress: () => del.mutate(id) }]);
  };
  const set = (k: string, v: string | boolean) => setVals((s) => ({ ...s, [k]: v }));

  return (
    <Screen bottomPad={40} onRefresh={() => { void list.refetch(); }} refreshing={list.isRefetching}>
      <Header title={tr(def.title)} subtitle={tr(def.subtitle)} back right={
        <Press label={open ? tr('modules.closeForm') : tr('modules.addTo', { title: tr(def.title) })} onPress={() => { setOpen((o) => !o); setError(null); }}>
          <IconBadge icon={open ? 'close' : 'add'} tone="accent" />
        </Press>} />

      {open && (
        <FadeIn>
          <Card className="gap-[16px]">
            {def.fields.map((f) => {
              const v = vals[f.key] ?? initial(f);
              if (f.type === 'select') return (
                <View key={f.key} className="gap-[6px]">
                  <Text size="sm" weight="600">{tr(f.label)}</Text>
                  <Row>{f.options!.map(([val, l]) => <Chip key={val} label={tr(l)} selected={v === val} onPress={() => set(f.key, val)} />)}</Row>
                </View>);
              if (f.type === 'toggle') return (
                <Row key={f.key}><Check checked={v === true} onPress={() => set(f.key, v !== true)} label={tr(f.label)} /><Text>{tr(f.label)}</Text></Row>);
              return <Field key={f.key} label={tr(f.label)} value={String(v)} onChangeText={(x) => set(f.key, x)} multiline={f.type === 'multiline'}
                keyboardType={f.type === 'number' ? 'decimal-pad' : 'default'} placeholder={f.placeholder ? tr(f.placeholder) : f.type === 'date' ? tr('ui.datePlaceholder') : undefined} autoCapitalize={f.type === 'text' || f.type === 'multiline' ? 'sentences' : 'none'} />;
            })}
            <ErrorText message={error} />
            <Button title={tr('modules.save')} loading={add.isPending} onPress={() => add.mutate()} />
          </Card>
        </FadeIn>
      )}

      {list.isLoading ? <Loading /> : list.error ? <ErrorState message={errorMessage(list.error, tr)} onRetry={() => void list.refetch()} />
        : (list.data ?? []).length === 0 ? <EmptyState icon={def.icon} title={tr('modules.emptyTitle', { title: tr(def.title).toLowerCase() })} body={tr(def.emptyBody)} action={tr('modules.addFirst')} onAction={() => setOpen(true)} />
        : (list.data ?? []).map((r, i) => {
          const label = String(r[def.titleKey] ?? tr(def.title));
          const locked = def.readOnlyBuiltIn && !r.user_id;
          const done = def.doneValue?.(r) ?? false;
          return (
            <FadeIn key={r.id} delay={Math.min(i, 8) * 25}>
              <Card onPress={def.key === 'projects' ? () => router.push(`/project/${r.id}`) : undefined}>
                <View className="flex-row items-center gap-[16px]">
                  {def.donePatch && <Check checked={done} label={tr('modules.toggle', { label })} onPress={() => patch.mutate({ id: r.id, body: def.donePatch!(!done) })} />}
                  <View className="flex-1 gap-[2px]">
                    <Text weight="600" style={done ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}>{label}</Text>
                    {def.meta && <Text size="sm" muted>{def.meta(r, tr)}</Text>}
                    {def.key === 'workouts' && r.instructions ? <Text size="sm" muted>{r.instructions}</Text> : null}
                  </View>
                  {!locked && <Press label={tr('modules.deleteLabel', { label })} onPress={() => confirmDelete(r.id, label)}><Ionicons name="trash-outline" size={20} color={t.textSecondary} /></Press>}
                </View>
              </Card>
            </FadeIn>
          );
        })}
    </Screen>
  );
}
