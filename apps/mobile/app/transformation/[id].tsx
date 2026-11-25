import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { Button, Card, Chip, EmptyState, ErrorText, Field, Header, Hero, Loading, Pill, ProgressBar, Row, Screen, SectionHeader, Text, success } from '../../src/components/ui';
import { api } from '../../src/lib/api';
import { errorMessage } from '../../src/lib/errors';
import { useTheme } from '../../src/theme/useTheme';

type Event = { id: string; kind: 'urge' | 'relapse' | 'success'; trigger_note: string; occurred_at: string };
type QuitProgress = {
  current: number;
  best: number;
  target_days: number | null;
  progress_pct: number;
  days_remaining: number | null;
  latest_milestone: number | null;
  next_milestone: number | null;
  goal_achieved: boolean;
  today_status: Event['kind'] | null;
};
type Behavior = {
  id: string;
  title: string;
  direction: 'build' | 'quit';
  target_days?: number | null;
  reward_text?: string | null;
  completed_at?: string | null;
  streak: { current: number; best: number } | null;
  progress?: QuitProgress | null;
  events: Event[];
};
type Checkin = { id: string; week_start: string; current_score: number; target_score: number; note: string };
type Area = { id: string; title: string; current_self: string; target_self: string; reason: string; behaviors: Behavior[]; checkins: Checkin[] };

const TARGET_PRESETS = [7, 14, 30, 60, 90] as const;

export default function TransformationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState(false);
  const [currentSelf, setCurrentSelf] = useState('');
  const [targetSelf, setTargetSelf] = useState('');
  const [reason, setReason] = useState('');
  const [direction, setDirection] = useState<'build' | 'quit'>('build');
  const [habitId, setHabitId] = useState<string | null>(null);
  const [targetDaysInput, setTargetDaysInput] = useState('30');
  const [rewardInput, setRewardInput] = useState('');
  const [editingBehaviorId, setEditingBehaviorId] = useState<string | null>(null);
  const [editTargetDays, setEditTargetDays] = useState('');
  const [editReward, setEditReward] = useState('');
  const [score, setScore] = useState('5');
  const [targetScore, setTargetScore] = useState('8');
  const [note, setNote] = useState('');
  const [activeUrge, setActiveUrge] = useState<string | null>(null);
  const [activeRelapse, setActiveRelapse] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [trigger, setTrigger] = useState('');
  useEffect(() => {
    if (!activeUrge || secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [activeUrge, secondsLeft]);

  const visual = process.env.EXPO_PUBLIC_VISUAL_TESTS === '1';
  const preview: Area = {
    id: 'preview',
    title: t('transformation.preview.title'),
    current_self: t('transformation.preview.current'),
    target_self: t('transformation.preview.target'),
    reason: t('transformation.preview.reason'),
    behaviors: [{
      id: 'b1',
      title: t('transformation.preview.behavior'),
      direction: 'quit',
      target_days: 30,
      reward_text: '',
      streak: { current: 7, best: 14 },
      progress: { current: 7, best: 14, target_days: 30, progress_pct: 23, days_remaining: 23, latest_milestone: 7, next_milestone: 14, goal_achieved: false, today_status: null },
      events: [],
    }],
    checkins: [
      { id: 'c1', week_start: '2026-11-09', current_score: 4, target_score: 8, note: '' },
      { id: 'c2', week_start: '2026-11-16', current_score: 6, target_score: 8, note: '' },
    ],
  };

  const detail = useQuery({ queryKey: ['transformation', id], queryFn: () => visual ? Promise.resolve(preview) : api<Area>(`/transformation/${id}`), enabled: !!id });
  const habits = useQuery({ queryKey: ['transformation-habits'], queryFn: () => api<{ id: string; name: string }[]>('/habits?pageSize=50') });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['transformation', id] });
    void qc.invalidateQueries({ queryKey: ['quit-behaviors-active'] });
  };

  const parsedTarget = Number(targetDaysInput.trim());
  const addBehavior = useMutation({
    mutationFn: () => api(`/transformation/${id}/behaviors`, {
      method: 'POST',
      body: {
        title: title.trim(),
        direction,
        habit_id: habitId,
        ...(direction === 'quit' ? {
          target_days: Number.isInteger(parsedTarget) && parsedTarget > 0 ? parsedTarget : null,
          reward_text: rewardInput.trim(),
        } : {}),
      },
    }),
    onSuccess: () => {
      success();
      setTitle('');
      setHabitId(null);
      setRewardInput('');
      refresh();
    },
  });

  const patchBehavior = useMutation({
    mutationFn: (behaviorId: string) => {
      const n = Number(editTargetDays.trim());
      return api(`/transformation/behaviors/${behaviorId}`, {
        method: 'PATCH',
        body: {
          target_days: Number.isInteger(n) && n > 0 ? n : null,
          reward_text: editReward.trim(),
        },
      });
    },
    onSuccess: () => {
      success();
      setEditingBehaviorId(null);
      refresh();
    },
  });

  const event = useMutation({
    mutationFn: ({ behaviorId, kind }: { behaviorId: string; kind: Event['kind'] }) =>
      api(`/transformation/behaviors/${behaviorId}/events`, { method: 'POST', body: { kind, trigger_note: trigger } }),
    onSuccess: (_data, vars) => {
      if (vars.kind === 'success') success();
      setActiveUrge(null);
      setActiveRelapse(null);
      setTrigger('');
      refresh();
    },
  });

  const checkin = useMutation({ mutationFn: () => api(`/transformation/${id}/checkin`, { method: 'PUT', body: { current_score: Number(score), target_score: Number(targetScore), note } }), onSuccess: refresh });
  const saveArea = useMutation({ mutationFn: () => api(`/transformation/${id}`, { method: 'PATCH', body: { current_self: currentSelf, target_self: targetSelf, reason } }), onSuccess: () => { setEditing(false); refresh(); void qc.invalidateQueries({ queryKey: ['transformation'] }); } });

  if (detail.isLoading) return <Loading />;
  if (!detail.data) return <Screen><EmptyState icon="alert-circle-outline" title={errorMessage(detail.error, t)} /></Screen>;
  const area = detail.data;

  return <Screen onRefresh={() => detail.refetch().then(() => undefined)} refreshing={detail.isRefetching}>
    <Header title={area.title} subtitle={t('transformation.subtitle')} back />
    <Card className="gap-2">{editing ? <>
      <Field label={t('transformation.current')} value={currentSelf} onChangeText={setCurrentSelf} multiline />
      <Field label={t('transformation.target')} value={targetSelf} onChangeText={setTargetSelf} multiline />
      <Field label={t('transformation.reason')} value={reason} onChangeText={setReason} multiline />
      <Button title={t('common.save')} loading={saveArea.isPending} onPress={() => saveArea.mutate()} />
    </> : <><Text size="sm" muted>{t('transformation.current')}</Text><Text>{area.current_self || t('transformation.empty')}</Text><Text size="sm" muted>{t('transformation.target')}</Text><Text>{area.target_self || t('transformation.empty')}</Text>{!!area.reason && <Text size="sm" muted>{area.reason}</Text>}<Button title={t('common.edit')} variant="ghost" onPress={() => { setCurrentSelf(area.current_self); setTargetSelf(area.target_self); setReason(area.reason); setEditing(true); }} /></>}</Card>

    <SectionHeader title={t('transformation.behaviors')} />
    {area.behaviors.map((behavior) => {
      const current = behavior.progress?.current ?? behavior.streak?.current ?? 0;
      const best = behavior.progress?.best ?? behavior.streak?.best ?? 0;
      const targetDays = behavior.progress?.target_days ?? behavior.target_days ?? null;
      const achieved = behavior.progress?.goal_achieved ?? false;
      const todayStatus = behavior.progress?.today_status ?? null;
      const milestone = behavior.progress?.latest_milestone ?? null;
      const nextMilestone = behavior.progress?.next_milestone ?? null;
      const isEditingBehavior = editingBehaviorId === behavior.id;

      return (
        <Card key={behavior.id} className="gap-3">
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1 gap-1">
              <Text weight="700">{behavior.title}</Text>
              <Text size="sm" muted>{t(`transformation.${behavior.direction}`)}</Text>
            </View>
            {todayStatus === 'success' ? <Pill label={t('transformation.stayedCleanPill')} tone="success" /> : null}
          </View>

          {behavior.direction === 'quit' && (
            <View className="gap-2">
              <Row gap={8}>
                <Pill label={targetDays ? t('transformation.streakProgress', { current, target: targetDays }) : t('transformation.days', { count: current })} tone={achieved ? 'success' : 'info'} />
                {milestone ? <Pill label={t('transformation.milestoneBadge', { n: milestone })} tone="accent" /> : null}
              </Row>
              <Text size="xs" muted>
                {t('transformation.best', { count: best })}
                {behavior.progress?.days_remaining != null && behavior.progress.days_remaining > 0 ? ` · ${t('transformation.daysRemaining', { count: behavior.progress.days_remaining })}` : ''}
                {nextMilestone ? ` · ${t('transformation.nextMilestone', { n: nextMilestone })}` : ''}
              </Text>
              {targetDays ? <ProgressBar value={current / targetDays} tone={achieved ? 'success' : 'info'} /> : null}
              {behavior.reward_text ? (
                <View className="flex-row items-center gap-2 rounded-md bg-surface-alt p-2.5">
                  <Ionicons name="gift-outline" size={16} color={theme.gold} />
                  <Text size="sm" style={{ flex: 1 }}>{t('transformation.rewardShow', { reward: behavior.reward_text })}</Text>
                </View>
              ) : null}
              {achieved && targetDays ? (
                <Hero colors={['#0F766E', '#14B8A6']}>
                  <Text size="sm" weight="700" color="#FFFFFF">{t('transformation.goalAchievedTitle')}</Text>
                  <Text size="xs" color="#E6FFFB" style={{ marginTop: 2 }}>{t('transformation.goalAchievedBody', { target: targetDays })}</Text>
                  {behavior.reward_text ? <Text size="sm" weight="600" color="#FEF3C7" style={{ marginTop: 6 }}>{t('transformation.rewardShow', { reward: behavior.reward_text })}</Text> : null}
                </Hero>
              ) : null}
            </View>
          )}

          {behavior.direction === 'quit' && (
            <View className="gap-2">
              <Button
                title={todayStatus === 'success' ? t('transformation.stayedCleanPill') : t('transformation.stayedCleanBtn')}
                variant={todayStatus === 'success' ? 'ghost' : 'primary'}
                icon="checkmark-circle-outline"
                disabled={todayStatus === 'success'}
                loading={event.isPending && event.variables?.behaviorId === behavior.id && event.variables.kind === 'success'}
                onPress={() => event.mutate({ behaviorId: behavior.id, kind: 'success' })}
              />
              <Row gap={8}>
                <View className="flex-1"><Button title={t('transformation.urges')} variant="ghost" onPress={() => { setActiveUrge(behavior.id); setActiveRelapse(null); setSecondsLeft(60); }} /></View>
                <View className="flex-1"><Button title={t('transformation.relapse')} variant="ghost" onPress={() => { setActiveRelapse(behavior.id); setActiveUrge(null); }} /></View>
              </Row>
              <Button
                title={t('transformation.editGoalReward')}
                variant="ghost"
                onPress={() => {
                  setEditingBehaviorId(isEditingBehavior ? null : behavior.id);
                  setEditTargetDays(targetDays ? String(targetDays) : '');
                  setEditReward(behavior.reward_text ?? '');
                }}
              />
              {isEditingBehavior && (
                <View className="gap-2 rounded-md bg-surface-alt p-3">
                  <Row gap={6}>
                    <Chip label={t('transformation.noneTarget')} selected={!editTargetDays} onPress={() => setEditTargetDays('')} />
                    {TARGET_PRESETS.map((d) => (
                      <Chip key={d} label={`${d}d`} selected={editTargetDays === String(d)} onPress={() => setEditTargetDays(String(d))} />
                    ))}
                  </Row>
                  <Field label={t('transformation.targetDays')} value={editTargetDays} onChangeText={setEditTargetDays} keyboardType="number-pad" placeholder={t('transformation.targetDaysPlaceholder')} />
                  <Field label={t('transformation.rewardLabel')} value={editReward} onChangeText={setEditReward} placeholder={t('transformation.rewardPlaceholder')} />
                  <Button title={t('common.save')} loading={patchBehavior.isPending} onPress={() => patchBehavior.mutate(behavior.id)} />
                </View>
              )}
            </View>
          )}

          {behavior.direction === 'build' && (
            <Button title={t('transformation.success')} variant="ghost" onPress={() => event.mutate({ behaviorId: behavior.id, kind: 'success' })} />
          )}

          {activeUrge === behavior.id && (
            <View className="gap-3">
              <Text>{t('transformation.breathe')}</Text>
              <Text size="xl" weight="700">{secondsLeft}</Text>
              <Text>{area.reason}</Text>
              <Field label={t('transformation.trigger')} value={trigger} onChangeText={setTrigger} multiline />
              <Button title={t('transformation.record')} disabled={secondsLeft > 0} onPress={() => event.mutate({ behaviorId: behavior.id, kind: 'urge' })} />
            </View>
          )}
          {activeRelapse === behavior.id && (
            <View className="gap-3">
              <Text>{t('transformation.noShame')}</Text>
              <Field label={t('transformation.trigger')} value={trigger} onChangeText={setTrigger} multiline />
              <Button title={t('transformation.record')} onPress={() => event.mutate({ behaviorId: behavior.id, kind: 'relapse' })} />
            </View>
          )}
          {behavior.events[0]?.kind === 'relapse' && <Text size="sm" muted>{t('transformation.noShame')}</Text>}
        </Card>
      );
    })}

    <Card className="gap-3">
      <Field label={t('transformation.behavior')} value={title} onChangeText={setTitle} />
      <Row>
        <Chip label={t('transformation.build')} selected={direction === 'build'} onPress={() => setDirection('build')} />
        <Chip label={t('transformation.quit')} selected={direction === 'quit'} onPress={() => setDirection('quit')} />
      </Row>
      {direction === 'quit' && (
        <View className="gap-2">
          <Text size="sm" weight="600">{t('transformation.targetDays')}</Text>
          <Row gap={6}>
            <Chip label={t('transformation.noneTarget')} selected={!targetDaysInput} onPress={() => setTargetDaysInput('')} />
            {TARGET_PRESETS.map((d) => (
              <Chip key={d} label={`${d}d`} selected={targetDaysInput === String(d)} onPress={() => setTargetDaysInput(String(d))} />
            ))}
          </Row>
          <Field label={t('transformation.targetDays')} value={targetDaysInput} onChangeText={setTargetDaysInput} keyboardType="number-pad" placeholder={t('transformation.targetDaysPlaceholder')} />
          <Field label={t('transformation.rewardLabel')} value={rewardInput} onChangeText={setRewardInput} placeholder={t('transformation.rewardPlaceholder')} />
        </View>
      )}
      <Text weight="700">{t('transformation.linkHabit')}</Text>
      <Row>
        <Chip label={t('transformation.none')} selected={!habitId} onPress={() => setHabitId(null)} />
        {habits.data?.map((habit) => <Chip key={habit.id} label={habit.name} selected={habitId === habit.id} onPress={() => setHabitId(habit.id)} />)}
      </Row>
      <Button title={t('transformation.addBehavior')} disabled={title.trim().length < 2} loading={addBehavior.isPending} onPress={() => addBehavior.mutate()} />
    </Card>

    <SectionHeader title={t('transformation.checkin')} />
    <Card className="gap-3"><Field label={t('transformation.currentScore')} value={score} onChangeText={setScore} keyboardType="number-pad" /><Field label={t('transformation.targetScore')} value={targetScore} onChangeText={setTargetScore} keyboardType="number-pad" /><Field label={t('transformation.note')} value={note} onChangeText={setNote} multiline /><Button title={t('transformation.saveCheckin')} disabled={!validScore(score) || !validScore(targetScore)} loading={checkin.isPending} onPress={() => checkin.mutate()} /></Card>

    <SectionHeader title={t('transformation.history')} />
    {area.checkins.length > 1 && <Card><ScoreChart values={[...area.checkins].reverse()} /></Card>}
    {area.checkins.map((item) => <Card key={item.id} className="gap-2"><Text weight="700">{item.week_start}</Text><Text size="sm" muted>{item.current_score} / {item.target_score}</Text><ProgressBar value={item.current_score / 10} /><Text size="sm">{item.note}</Text></Card>)}
    <ErrorText message={addBehavior.error || patchBehavior.error || event.error || checkin.error || saveArea.error ? errorMessage(addBehavior.error ?? patchBehavior.error ?? event.error ?? checkin.error ?? saveArea.error, t) : null} />
  </Screen>;
}
const validScore = (value: string) => /^([1-9]|10)$/.test(value);

function ScoreChart({ values }: { values: Checkin[] }) {
  const width = 300;
  const height = 110;
  const coordinates = values.map((item, index) => ({ x: 12 + index * (width - 24) / Math.max(1, values.length - 1), y: height - 10 - item.current_score * 9 }));
  return <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} accessibilityRole="image">
    {[1, 5, 10].map((score) => <Line key={score} x1={12} x2={width - 12} y1={height - 10 - score * 9} y2={height - 10 - score * 9} stroke="#9BA9B2" strokeOpacity={0.35} />)}
    <Polyline points={coordinates.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="#14B8A6" strokeWidth={3} strokeLinejoin="round" />
    {coordinates.map((point, index) => <Circle key={values[index].id} cx={point.x} cy={point.y} r={4} fill="#14B8A6" />)}
  </Svg>;
}
