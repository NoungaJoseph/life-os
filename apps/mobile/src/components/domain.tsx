import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { insightText, pillarName } from '../i18n/helpers';
import { GoalView, Insight, PillarBalance } from '../lib/types';
import { spacing } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Card, IconBadge, Pill, Press, ProgressBar, Text, Tone } from './ui';

export const PACE_TONE: Record<GoalView['projection']['status'], Tone> = {
  completed: 'success', on_track: 'success', at_risk: 'warning', behind: 'error', no_deadline: 'info', not_started: 'neutral',
};
const paceTone = (p: GoalView['projection']['status']): Tone => (p === 'behind' ? 'error' : p === 'at_risk' ? 'warning' : p === 'not_started' ? 'neutral' : 'success');

export function GoalRow({ goal }: { goal: GoalView }) {
  const router = useRouter();
  const { t } = useTranslation();
  const st = goal.projection.status;
  return (
    <Card onPress={() => router.push({ pathname: '/goal/[id]', params: { id: goal.id } })}>
      <View className="flex-row justify-between items-start gap-[8px]">
        <View className="flex-1">
          <Text weight="600" numberOfLines={2}>{goal.title}</Text>
          <Text size="xs" muted>{t(`domain.goalType.${goal.goal_type}`, { defaultValue: goal.goal_type })}{goal.target_date ? ` · ${t('domain.due', { date: goal.target_date })}` : ''}</Text>
        </View>
        <Pill label={t(`domain.pace.${st}`)} tone={PACE_TONE[st]} />
      </View>
      <ProgressBar value={goal.progress} tone={paceTone(goal.projection.status)} />
      <Text size="xs" muted>{t('domain.complete', { pct: Math.round(goal.progress * 100) })}</Text>
    </Card>
  );
}

const KIND: Record<Insight['kind'], { icon: keyof typeof Ionicons.glyphMap; tone: Tone }> = {
  prediction: { icon: 'sparkles', tone: 'info' }, pattern: { icon: 'analytics', tone: 'accent' },
  warning: { icon: 'alert-circle', tone: 'warning' }, win: { icon: 'trophy', tone: 'success' },
};
export function InsightCard({ insight, width }: { insight: Insight; width?: number }) {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const k = KIND[insight.kind];
  const text = insightText(tr, insight);
  const color = { info: t.primary, accent: t.accent, warning: t.warning, success: t.success, error: t.error, neutral: t.textSecondary }[k.tone];
  return (
    <Card style={{ width, gap: 10, minHeight: 168 }}>
      <View className="flex-row items-center gap-[10px]">
        <IconBadge icon={k.icon} tone={k.tone} size={34} />
        <Text size="xs" weight="700" color={color} style={{ letterSpacing: 1.4 }}>{tr(`domain.kind.${insight.kind}`).toUpperCase()}</Text>
      </View>
      <Text weight="600" style={{ lineHeight: 22 }}>{text.title}</Text>
      <Text size="sm" muted>{text.body}</Text>
    </Card>
  );
}

export function BalanceBar({ pillar }: { pillar: PillarBalance }) {
  const { t } = useTranslation();
  return (
    <View className="gap-[6px]">
      <View className="flex-row justify-between items-center">
        <Text size="sm" weight="500">{pillarName(t, pillar.name)}</Text>
        {pillar.neglected ? <Pill label={t('domain.needsAttention')} tone="warning" /> : <Text size="xs" muted>{pillar.score}/100</Text>}
      </View>
      <ProgressBar value={pillar.score / 100} tone={pillar.neglected ? 'warning' : 'info'} height={7} />
    </View>
  );
}

export { Press };
