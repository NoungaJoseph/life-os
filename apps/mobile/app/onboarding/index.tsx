import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { TimeField } from '../../src/components/TimeField';
import { Button, Card, Chip, ErrorText, Field, Loading, Pill, ProgressBar, Row, Screen, Text, success } from '../../src/components/ui';
import { setLanguage as setAppLanguage } from '../../src/i18n';
import { areaText, pillarName } from '../../src/i18n/helpers';
import { api } from '../../src/lib/api';
import { useLock } from '../../src/lib/lock';
import { validateOnboardingStep } from '../../src/lib/onboardingValidation';
import { wasIntroViewedThisSession } from '../../src/lib/tutorial';
import { LifeArea, LifeVision, Pillar, Preferences, Profile, UserLifeArea } from '../../src/lib/types';
import { useTheme } from '../../src/theme/useTheme';

const STEP_COUNT = 8;
const CURRENCIES = ['XAF', 'USD', 'EUR', 'NGN', 'GBP'];
const LANGUAGES = ['en', 'fr'] as const;
const DAYS: [number, string][] = [[1, 'mon'], [2, 'tue'], [3, 'wed'], [4, 'thu'], [5, 'fri'], [6, 'sat'], [0, 'sun']];
const GOAL_TYPES = ['long_term', 'annual', 'monthly'] as const;

interface NewGoal { title: string; goal_type: string }

export default function Onboarding() {
  const { t } = useTranslation();
  const th = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const lock = useLock();
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
  const [missingFields, setMissingFields] = useState<string[]>([]);
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

  const clearValidation = () => {
    if (error) setError(null);
    if (missingFields.length > 0) setMissingFields([]);
  };

  const setPref = <K extends keyof Preferences>(key: K, patch: Partial<NonNullable<Preferences[K]>>) => {
    clearValidation();
    setPrefs((p) => ({ ...p, [key]: { ...(p[key] as object | undefined), ...patch } }));
  };

  const planning = prefs.planning ?? { daily: true, weekly: true, monthly: true };
  const routine = prefs.routine ?? {};
  const titles = t('onboarding.titles', { returnObjects: true }) as string[];
  const fieldErr = (fieldKey: string) => (missingFields.includes(fieldKey) ? t('common.errors.required') : undefined);

  async function save(): Promise<void> {
    switch (step) {
      case 0:
        await api('/profile', { method: 'PATCH', body: { display_name: name.trim(), timezone: timezone.trim(), currency, language } });
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
        if (isEdit) break;
        for (const g of goals.filter((x) => x.title.trim())) {
          await api('/goals', { method: 'POST', body: { title: g.title.trim(), goal_type: g.goal_type, status: 'active' } });
        }
        setGoals([{ title: '', goal_type: 'long_term' }]);
        break;
      }
    }
  }

  async function completeOnboarding() {
    const patchBody: Record<string, unknown> = { onboarding_completed: true };
    if (wasIntroViewedThisSession()) {
      patchBody.preferences = { ...prefs, tutorial: { ...prefs.tutorial, tour_seen: true } };
    }
    const updated = await api<Profile>('/profile', { method: 'PATCH', body: patchBody }).catch(() => null);
    if (updated) qc.setQueryData(['profile'], updated);
    await Promise.all([qc.invalidateQueries({ queryKey: ['profile'] }), qc.invalidateQueries({ queryKey: ['goals'] })]);
    success();
    if (isEdit) {
      router.replace('/');
      return;
    }
    if (!wasIntroViewedThisSession() && !updated?.preferences?.tutorial?.tour_seen) {
      router.replace('/tutorial');
      return;
    }
    router.replace(lock.hasPin ? '/' : '/create-pin');
  }

  async function next() {
    const check = validateOnboardingStep(step, {
      isEdit,
      name,
      timezone,
      identity,
      idealLife,
      ambitions,
      priorities,
      active,
      obstacles: prefs.challenges?.obstacles ?? '',
      distractions: prefs.challenges?.distractions ?? '',
      improve: prefs.challenges?.improve ?? '',
      planning,
      goals,
      routine,
    });
    if (check.errorKey) {
      setMissingFields(check.missingFields);
      setError(t(check.errorKey));
      return;
    }
    setSaving(true);
    setError(null);
    setMissingFields([]);
    try {
      await save();
      if (step === STEP_COUNT - 1) {
        await completeOnboarding();
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
    <Screen bottomPad={40}>
      <View className="gap-3 border-b border-line pb-4">
        <View className="flex-row items-center justify-between">
          <Text size="xs" weight="700" color={th.gold} style={{ letterSpacing: 1.6 }}>
            {t('onboarding.step', { n: step + 1, total: STEP_COUNT }).toUpperCase()}
          </Text>
          <Pill label={t('common.appName')} tone="accent" />
        </View>
        <Text size="xl" serif weight="700">{titles[step]}</Text>
        <ProgressBar value={(step + 1) / STEP_COUNT} tone="accent" height={5} />
      </View>

      {step === 0 && (
        <Card className="gap-3">
          <Field
            label={t('onboarding.name')}
            value={name}
            onChangeText={(v) => { clearValidation(); setName(v); }}
            error={fieldErr('name')}
          />
          <Field
            label={t('onboarding.timezone')}
            value={timezone}
            onChangeText={(v) => { clearValidation(); setTimezone(v); }}
            autoCapitalize="none"
            error={fieldErr('timezone')}
          />
          <Text size="sm" weight="600">{t('onboarding.currency')}</Text>
          <Row>{CURRENCIES.map((c) => <Chip key={c} label={c} selected={currency === c} onPress={() => setCurrency(c)} />)}</Row>
          <Text size="sm" weight="600">{t('onboarding.language')}</Text>
          <Row>
            {LANGUAGES.map((c) => (
              <Chip
                key={c}
                label={t(`language.${c === 'en' ? 'english' : 'french'}`)}
                selected={language === c}
                onPress={() => {
                  setLanguage(c);
                  void setAppLanguage(c);
                }}
              />
            ))}
          </Row>
        </Card>
      )}

      {step === 1 && (
        <Card className="gap-3">
          <Field
            label={t('onboarding.identity')}
            multiline
            value={identity}
            onChangeText={(v) => { clearValidation(); setIdentity(v); }}
            error={fieldErr('identity')}
          />
          <Field
            label={t('onboarding.idealLife')}
            multiline
            value={idealLife}
            onChangeText={(v) => { clearValidation(); setIdealLife(v); }}
            error={fieldErr('idealLife')}
          />
          <Field
            label={t('onboarding.ambitions')}
            multiline
            value={ambitions}
            onChangeText={(v) => { clearValidation(); setAmbitions(v); }}
            error={fieldErr('ambitions')}
          />
        </Card>
      )}

      {step === 2 && (
        <View className="gap-3">
          <Text size="sm" muted>{t('onboarding.pillarsIntro')}</Text>
          {pillarsQ.data!.map((p) => (
            <Card key={p.id} className="gap-2">
              <Text weight="700">{pillarName(t, p.name)}</Text>
              {p.purpose ? <Text size="xs" muted>{p.purpose}</Text> : null}
              <Field
                label={t('onboarding.priorities')}
                multiline
                value={priorities[p.slug] ?? ''}
                onChangeText={(v) => { clearValidation(); setPriorities((s) => ({ ...s, [p.slug]: v })); }}
                error={fieldErr('pillars')}
              />
            </Card>
          ))}
        </View>
      )}

      {step === 3 && (
        <Card className="gap-3">
          <Text size="sm" muted>{t('onboarding.areasIntro')}</Text>
          <Row>
            {areasQ.data!.map((a) => (
              <Chip
                key={a.id}
                label={areaText(t, a).name}
                selected={!!active[a.id]}
                onPress={() => { clearValidation(); setActive((s) => ({ ...s, [a.id]: !s[a.id] })); }}
              />
            ))}
          </Row>
        </Card>
      )}

      {step === 4 && (
        <Card className="gap-3">
          <Field
            label={t('onboarding.obstacles')}
            multiline
            value={prefs.challenges?.obstacles ?? ''}
            onChangeText={(v) => setPref('challenges', { obstacles: v })}
            error={fieldErr('obstacles')}
          />
          <Field
            label={t('onboarding.distractions')}
            multiline
            value={prefs.challenges?.distractions ?? ''}
            onChangeText={(v) => setPref('challenges', { distractions: v })}
            error={fieldErr('distractions')}
          />
          <Field
            label={t('onboarding.improve')}
            multiline
            value={prefs.challenges?.improve ?? ''}
            onChangeText={(v) => setPref('challenges', { improve: v })}
            error={fieldErr('improve')}
          />
        </Card>
      )}

      {step === 5 && (
        <Card className="gap-3">
          <Text size="sm" muted>{t('onboarding.planningIntro')}</Text>
          <Row>
            {(['daily', 'weekly', 'monthly'] as const).map((k) => (
              <Chip
                key={k}
                label={t(`onboarding.planning.${k}`)}
                selected={planning[k]}
                onPress={() => setPref('planning', { ...planning, [k]: !planning[k] })}
              />
            ))}
          </Row>
        </Card>
      )}

      {step === 6 && (isEdit ? (
        <Card><Text size="sm" muted>{t('onboarding.goalsEditIntro')}</Text></Card>
      ) : (
        <View className="gap-3">
          <Text size="sm" muted>{t('onboarding.goalsIntro')}</Text>
          {goals.map((g, i) => (
            <Card key={i} className="gap-3">
              <Field
                label={t('onboarding.goalN', { n: i + 1 })}
                value={g.title}
                onChangeText={(v) => {
                  clearValidation();
                  setGoals((arr) => arr.map((x, j) => (j === i ? { ...x, title: v } : x)));
                }}
                error={i === 0 ? fieldErr('goal0') : undefined}
              />
              <Row>
                {GOAL_TYPES.map((type) => (
                  <Chip
                    key={type}
                    label={t(`onboarding.goalTypes.${type}`)}
                    selected={g.goal_type === type}
                    onPress={() => setGoals((arr) => arr.map((x, j) => (j === i ? { ...x, goal_type: type } : x)))}
                  />
                ))}
              </Row>
            </Card>
          ))}
          {goals.length < 3 && (
            <Button title={t('onboarding.addGoal')} variant="ghost" onPress={() => setGoals((a) => [...a, { title: '', goal_type: 'annual' }])} />
          )}
        </View>
      ))}

      {step === 7 && (
        <Card className="gap-3">
          <TimeField
            label={t('onboarding.workStart')}
            value={routine.work_start ?? ''}
            onChange={(v) => setPref('routine', { work_start: v })}
            error={fieldErr('work_start')}
            required
          />
          <TimeField
            label={t('onboarding.workEnd')}
            value={routine.work_end ?? ''}
            onChange={(v) => setPref('routine', { work_end: v })}
            error={fieldErr('work_end')}
            required
          />
          <TimeField
            label={t('onboarding.readingTime')}
            value={routine.reading_time ?? ''}
            onChange={(v) => setPref('routine', { reading_time: v })}
            error={fieldErr('reading_time')}
            required
          />
          <Text size="sm" weight="600" color={missingFields.includes('exercise_days') ? th.error : undefined}>
            {t('onboarding.exerciseDays')}
          </Text>
          <Row>
            {DAYS.map(([d, key]) => {
              const days = routine.exercise_days ?? [];
              return (
                <Chip
                  key={d}
                  label={t(`onboarding.days.${key}`)}
                  selected={days.includes(d)}
                  onPress={() => setPref('routine', { exercise_days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d] })}
                />
              );
            })}
          </Row>
          <TimeField
            label={t('onboarding.exerciseTime')}
            value={routine.exercise_time ?? ''}
            onChange={(v) => setPref('routine', { exercise_time: v })}
            error={fieldErr('exercise_time')}
            required
          />
        </Card>
      )}

      <ErrorText message={error} />
      <Button title={last ? t('onboarding.finish') : t('common.continue')} onPress={() => void next()} loading={saving} />
      {step > 0 && (
        <Button
          title={t('common.back')}
          variant="ghost"
          onPress={() => { setError(null); setMissingFields([]); setStep(step - 1); }}
          disabled={saving}
        />
      )}
      <Button title={isEdit ? t('common.close') : t('tutorial.skip')} variant="ghost" onPress={() => void completeOnboarding()} disabled={saving} />
    </Screen>
  );
}
