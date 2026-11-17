import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button, Card, Chip, ErrorText, Field, Loading, Screen, Text } from '../../src/components/ui';
import { api } from '../../src/lib/api';
import { LifeArea, LifeVision, Pillar, Preferences, Profile, UserLifeArea } from '../../src/lib/types';

const STEP_COUNT = 8;
const CURRENCIES = ['XAF', 'USD', 'EUR', 'NGN', 'GBP'];
const LANGUAGES = ['en', 'fr'] as const;
const DAYS: [number, string][] = [[1, 'mon'], [2, 'tue'], [3, 'wed'], [4, 'thu'], [5, 'fri'], [6, 'sat'], [0, 'sun']];
const GOAL_TYPES = ['long_term', 'annual', 'monthly'] as const;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

interface NewGoal { title: string; goal_type: string }

export default function Onboarding() {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const isEdit = edit === '1';

  const profileQ = useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/profile') });
  const visionQ = useQuery({ queryKey: ['vision'], queryFn: () => api<LifeVision | null>('/life-vision') });
  const pillarsQ = useQuery({ queryKey: ['pillars'], queryFn: () => api<Pillar[]>('/pillars') });
  const areasQ = useQuery({ queryKey: ['areas'], queryFn: () => api<LifeArea[]>('/life-areas') });
  const userAreasQ = useQuery({ queryKey: ['userAreas'], queryFn: () => api<UserLifeArea[]>('/me/life-areas') });

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [currency, setCurrency] = useState('XAF');
  const [language, setLanguage] = useState('en');
  const [identity, setIdentity] = useState('');
  const [idealLife, setIdealLife] = useState('');
  const [ambitions, setAmbitions] = useState('');
  const [priorities, setPriorities] = useState<Record<string, string>>({});
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [prefs, setPrefs] = useState<Preferences>({});
  const [goals, setGoals] = useState<NewGoal[]>([{ title: '', goal_type: 'long_term' }]);

  const loaded = [profileQ, visionQ, pillarsQ, areasQ, userAreasQ].every((q) => q.isSuccess);

  // Prefill once, so users editing later see their earlier answers.
  useEffect(() => {
    if (!loaded || ready) return;
    const p = profileQ.data!;
    setName(p.display_name ?? '');
    setTimezone(p.timezone);
    setCurrency(p.currency);
    setLanguage(p.language);
    setPrefs(p.preferences ?? {});
    const v = visionQ.data;
    if (v) {
      setIdentity(v.identity_statement ?? '');
      setIdealLife(v.ideal_life ?? '');
      setAmbitions(v.long_term_ambitions ?? '');
      setPriorities(v.pillar_priorities ?? {});
    }
    const a: Record<string, boolean> = {};
    for (const ua of userAreasQ.data!) a[ua.life_area_id] = ua.is_active;
    // First time through, all areas start switched on so users deselect what doesn't apply.
    if (userAreasQ.data!.length === 0) for (const area of areasQ.data!) a[area.id] = true;
    setActive(a);
    setReady(true);
  }, [loaded, ready, profileQ.data, visionQ.data, userAreasQ.data, areasQ.data]);

  if (!ready) {
    const err = [profileQ, visionQ, pillarsQ, areasQ, userAreasQ].find((q) => q.error)?.error as Error | undefined;
    return err ? <Screen><ErrorText message={err.message} /></Screen> : <Loading />;
  }

  const setPref = <K extends keyof Preferences>(key: K, patch: Partial<NonNullable<Preferences[K]>>) =>
    setPrefs((p) => ({ ...p, [key]: { ...(p[key] as object | undefined), ...patch } }));

  const planning = prefs.planning ?? { daily: true, weekly: true, monthly: true };
  const routine = prefs.routine ?? {};

  function validate(): string | null {
    if (step === 0 && !name.trim()) return 'Please enter a name.';
    if (step === 7) {
      for (const t of [routine.work_start, routine.work_end, routine.reading_time, routine.exercise_time]) {
        if (t && !TIME_RE.test(t)) return 'Use 24-hour times like 08:30.';
      }
    }
    return null;
  }

  async function save(): Promise<void> {
    switch (step) {
      case 0:
        await api('/profile', { method: 'PATCH', body: { display_name: name.trim(), timezone, currency, language } });
        break;
      case 1:
      case 2:
        await api('/life-vision', {
          method: 'PUT',
          body: { identity_statement: identity, ideal_life: idealLife, long_term_ambitions: ambitions, pillar_priorities: priorities },
        });
        break;
      case 3: {
        const before = new Map(userAreasQ.data!.map((u) => [u.life_area_id, u.is_active]));
        const changes = areasQ.data!.filter((a) => (before.get(a.id) ?? null) !== (active[a.id] ?? false));
        await Promise.all(changes.map((a) =>
          api(`/me/life-areas/${a.id}`, { method: 'PUT', body: { is_active: !!active[a.id] } })));
        break;
      }
      case 4:
      case 5:
      case 7:
        await api('/profile', { method: 'PATCH', body: { preferences: prefs } });
        break;
      case 6: {
        if (isEdit) break; // goals are managed in the planner after setup
        for (const g of goals.filter((x) => x.title.trim())) {
          await api('/goals', { method: 'POST', body: { title: g.title.trim(), goal_type: g.goal_type, status: 'active' } });
        }
        setGoals([{ title: '', goal_type: 'long_term' }]); // avoid duplicates if the user comes back
        break;
      }
    }
  }

  async function next() {
    const problem = validate();
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    try {
      await save();
      if (step === STEP_COUNT - 1) {
        await api('/profile', { method: 'PATCH', body: { onboarding_completed: true } });
        await Promise.all([qc.invalidateQueries({ queryKey: ['profile'] }), qc.invalidateQueries({ queryKey: ['goals'] })]);
        router.replace('/');
      } else {
        setStep(step + 1);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const last = step === STEP_COUNT - 1;

  return (
    <Screen>
      <Text size="sm" muted>{t('onboarding.step', { n: step + 1, total: STEP_COUNT })}</Text>
      <Text size="xl" weight="700">{(t('onboarding.titles', { returnObjects: true }) as string[])[step]}</Text>

      {step === 0 && (
        <>
          <Field label={t('onboarding.name')} value={name} onChangeText={setName} />
          <Field label={t('onboarding.timezone')} value={timezone} onChangeText={setTimezone} autoCapitalize="none" />
          <Text size="sm" weight="600">{t('onboarding.currency')}</Text>
          <Row>{CURRENCIES.map((c) => <Chip key={c} label={c} selected={currency === c} onPress={() => setCurrency(c)} />)}</Row>
          <Text size="sm" weight="600">{t('onboarding.language')}</Text>
          <Row>{LANGUAGES.map((c) => <Chip key={c} label={t(`language.${c === 'en' ? 'english' : 'french'}`)} selected={language === c} onPress={() => setLanguage(c)} />)}</Row>
        </>
      )}

      {step === 1 && (
        <>
          <Field label={t('onboarding.identity')} multiline value={identity} onChangeText={setIdentity} />
          <Field label={t('onboarding.idealLife')} multiline value={idealLife} onChangeText={setIdealLife} />
          <Field label={t('onboarding.ambitions')} multiline value={ambitions} onChangeText={setAmbitions} />
        </>
      )}

      {step === 2 && (
        <>
          <Text muted>{t('onboarding.pillarsIntro')}</Text>
          {pillarsQ.data!.map((p) => (
            <Card key={p.id}>
              <Text weight="600">{p.name}</Text>
              {p.purpose ? <Text size="sm" muted>{p.purpose}</Text> : null}
              <Field label={t('onboarding.priorities')} multiline value={priorities[p.slug] ?? ''}
                onChangeText={(v) => setPriorities((s) => ({ ...s, [p.slug]: v }))} />
            </Card>
          ))}
        </>
      )}

      {step === 3 && (
        <>
          <Text muted>{t('onboarding.areasIntro')}</Text>
          <Row>
            {areasQ.data!.map((a) => (
              <Chip key={a.id} label={a.name} selected={!!active[a.id]} onPress={() => setActive((s) => ({ ...s, [a.id]: !s[a.id] }))} />
            ))}
          </Row>
        </>
      )}

      {step === 4 && (
        <>
          <Field label={t('onboarding.obstacles')} multiline value={prefs.challenges?.obstacles ?? ''}
            onChangeText={(v) => setPref('challenges', { obstacles: v })} />
          <Field label={t('onboarding.distractions')} multiline value={prefs.challenges?.distractions ?? ''}
            onChangeText={(v) => setPref('challenges', { distractions: v })} />
          <Field label={t('onboarding.improve')} multiline value={prefs.challenges?.improve ?? ''}
            onChangeText={(v) => setPref('challenges', { improve: v })} />
        </>
      )}

      {step === 5 && (
        <>
          <Text muted>{t('onboarding.planningIntro')}</Text>
          <Row>
            {(['daily', 'weekly', 'monthly'] as const).map((k) => (
              <Chip key={k} label={`${k[0].toUpperCase()}${k.slice(1)} planning`} selected={planning[k]}
                onPress={() => setPref('planning', { ...planning, [k]: !planning[k] })} />
            ))}
          </Row>
        </>
      )}

      {step === 6 && (isEdit ? (
        <Text muted>{t('onboarding.goalsEditIntro')}</Text>
      ) : (
        <>
          <Text muted>{t('onboarding.goalsIntro')}</Text>
          {goals.map((g, i) => (
            <Card key={i}>
              <Field label={t('onboarding.goalN', { n: i + 1 })} value={g.title}
                onChangeText={(v) => setGoals((arr) => arr.map((x, j) => (j === i ? { ...x, title: v } : x)))} />
              <Row>
                {GOAL_TYPES.map((type) => (
                  <Chip key={type} label={t(`onboarding.goalTypes.${type}`)} selected={g.goal_type === type}
                    onPress={() => setGoals((arr) => arr.map((x, j) => (j === i ? { ...x, goal_type: type } : x)))} />
                ))}
              </Row>
            </Card>
          ))}
          {goals.length < 3 && (
            <Button title={t('onboarding.addGoal')} variant="ghost" onPress={() => setGoals((a) => [...a, { title: '', goal_type: 'annual' }])} />
          )}
        </>
      ))}

      {step === 7 && (
        <>
          <Field label={t('onboarding.workStart')} value={routine.work_start ?? ''} onChangeText={(v) => setPref('routine', { work_start: v })} placeholder="08:00" />
          <Field label={t('onboarding.workEnd')} value={routine.work_end ?? ''} onChangeText={(v) => setPref('routine', { work_end: v })} placeholder="17:00" />
          <Field label={t('onboarding.readingTime')} value={routine.reading_time ?? ''} onChangeText={(v) => setPref('routine', { reading_time: v })} placeholder="20:00" />
          <Text size="sm" weight="600">{t('onboarding.exerciseDays')}</Text>
          <Row>
            {DAYS.map(([d, key]) => {
              const days = routine.exercise_days ?? [];
              return (
                <Chip key={d} label={t(`onboarding.days.${key}`)} selected={days.includes(d)}
                  onPress={() => setPref('routine', { exercise_days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d] })} />
              );
            })}
          </Row>
          <Field label={t('onboarding.exerciseTime')} value={routine.exercise_time ?? ''} onChangeText={(v) => setPref('routine', { exercise_time: v })} placeholder="06:30" />
        </>
      )}

      <ErrorText message={error} />
      <Button title={last ? t('onboarding.finish') : t('common.continue')} onPress={next} loading={saving} />
      {step > 0 && <Button title={t('common.back')} variant="ghost" onPress={() => { setError(null); setStep(step - 1); }} disabled={saving} />}
      <Button title={isEdit ? t('common.close') : t('tutorial.skip')} variant="ghost" onPress={() => { void api('/profile', { method: 'PATCH', body: { onboarding_completed: true } }).catch(() => undefined); router.replace('/'); }} disabled={saving} />
    </Screen>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap gap-[8px]">{children}</View>;
}
