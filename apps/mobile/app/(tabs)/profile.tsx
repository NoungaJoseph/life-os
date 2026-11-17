import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button, Card, ErrorState, Header, Loading, Pill, ProgressBar, Screen, SectionHeader, Text } from '../../src/components/ui';
import { api } from '../../src/lib/api';
import { errorMessage } from '../../src/lib/errors';
import { useInsights } from '../../src/lib/hooks';
import { useSession } from '../../src/lib/session';
import { signOutDevice } from '../../src/lib/signOut';
import { Profile } from '../../src/lib/types';
import { spacing } from '../../src/theme/tokens';

const hour = (h: number) => `${String(h).padStart(2, '0')}:00`;

export default function ProfileScreen() {
  const router = useRouter();
  const { t: tr } = useTranslation();
  const { session } = useSession();
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/profile') });
  const insights = useInsights();

  if (profile.isLoading || insights.isLoading) return <Loading />;
  if (profile.error || !profile.data) return <Screen><ErrorState message={profile.error ? errorMessage(profile.error, tr) : tr('profile.loadError')} onRetry={() => void profile.refetch()} /></Screen>;
  const p = profile.data;
  const b = insights.data?.behavior;
  const habits = (insights.data?.habits ?? []).filter((h) => h.rate30 > 0 || h.streak > 0);

  return (
    <Screen bottomPad={130}>
      <Header title={p.display_name ?? tr('profile.title')} subtitle={session?.user.email} />
      <Card>
        <Text size="sm" muted>{tr('profile.prefs', { currency: p.currency, tz: p.timezone })}</Text>
        <Button title={tr('profile.editSetup')} variant="ghost" icon="options-outline" onPress={() => router.push('/onboarding?edit=1')} />
      </Card>

      <SectionHeader title={tr('profile.patterns')} />
      <Card className="gap-[16px]">
        {!b || (b.best_weekday === null && b.completion_rate === null && habits.length === 0) ? (
          <Text size="sm" muted>{tr('profile.learning')}</Text>
        ) : (
          <>
            {b.best_weekday && b.peak_hour !== null ? (
              <View className="gap-[2px]"><Text size="xs" muted>{tr('profile.mostProductive')}</Text><Text weight="600">{tr('profile.mostProductiveValue', { weekday: tr(`domain.weekdayPlural.${b.best_weekday}`, { defaultValue: b.best_weekday }), hour: hour(b.peak_hour) })}</Text></View>
            ) : null}
            {b.completion_rate !== null ? (
              <View className="gap-[6px]">
                <View className="flex-row justify-between"><Text size="sm">{tr('profile.completion')}</Text><Text size="sm" weight="600">{Math.round(b.completion_rate * 100)}%</Text></View>
                <ProgressBar value={b.completion_rate} tone={b.completion_rate >= 0.7 ? 'success' : 'warning'} />
              </View>
            ) : null}
            {b.avg_days_late !== null && b.avg_days_late >= 1 ? <Text size="sm" muted>{tr('profile.late', { days: b.avg_days_late })}</Text> : null}
            {habits.slice(0, 5).map((h) => (
              <View key={h.id} className="gap-[6px]">
                <View className="flex-row justify-between items-center">
                  <Text size="sm" style={{ flex: 1 }}>{h.name}</Text>
                  {h.best_weekday ? <Pill label={tr('profile.best', { weekday: tr(`domain.weekday.${h.best_weekday}`, { defaultValue: h.best_weekday }) })} tone="accent" /> : null}
                </View>
                <ProgressBar value={h.rate30} tone={h.rate30 >= 0.7 ? 'success' : 'info'} height={6} />
              </View>
            ))}
          </>
        )}
      </Card>

      <SectionHeader title={tr('profile.more')} />
      <Button title={tr('profile.journal')} variant="ghost" icon="book-outline" onPress={() => router.push('/journal')} />
      <Button title={tr('profile.coach')} variant="ghost" icon="sparkles-outline" onPress={() => router.push('/coach')} />
      <Button title={tr('profile.review')} variant="ghost" icon="calendar-number-outline" onPress={() => router.push('/review')} />
      <Button title={tr('transformation.title')} variant="ghost" icon="leaf-outline" onPress={() => router.push('/transformation')} />
      <Button title={tr('screenTime.title')} variant="ghost" icon="hourglass-outline" onPress={() => router.push('/screen-time')} />
      <Button title={tr('profile.finance')} variant="ghost" icon="wallet-outline" onPress={() => router.push('/finance')} />
      <Button title={tr('wallet.profileButton')} variant="ghost" icon="card-outline" onPress={() => router.push('/wallet')} />
      <Button title={tr('profile.settings')} variant="ghost" icon="settings-outline" onPress={() => router.push('/settings')} />
      <Button title={tr('profile.sessions')} variant="ghost" icon="phone-portrait-outline" onPress={() => router.push('/sessions')} />
      <Button title={tr('profile.signOut')} variant="danger" icon="log-out-outline" onPress={() => { void signOutDevice().then(() => router.replace('/login')); }} />
      <Text size="xs" muted style={{ textAlign: 'center' }}>{tr('profile.privacy')}</Text>
    </Screen>
  );
}
