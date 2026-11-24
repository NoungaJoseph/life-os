import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, tap } from '../../src/components/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts, radius, shadowLift, spacing } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/useTheme';


const TAB_DEFS = [
  { name: 'index', title: 'tabs.home', icon: 'home' },
  { name: 'goals', title: 'tabs.goals', icon: 'flag' },
  { name: 'planner', title: 'tabs.planner', icon: 'calendar' },
  { name: 'areas', title: 'tabs.areas', icon: 'grid' },
  { name: 'profile', title: 'tabs.profile', icon: 'person' },
] as const;

const ACTIONS: { label: string; hint: string; icon: keyof typeof Ionicons.glyphMap; href: string }[] = [
  { label: 'tabs.addTask', hint: 'tabs.addTaskHint', icon: 'checkbox-outline', href: '/new-task' },
  { label: 'tabs.addHabit', hint: 'tabs.addHabitHint', icon: 'repeat', href: '/new-habit' },
  { label: 'tabs.addGoal', hint: 'tabs.addGoalHint', icon: 'flag-outline', href: '/new-goal' },
  { label: 'tabs.dailyCheckin', hint: 'tabs.dailyCheckinHint', icon: 'moon-outline', href: '/evening-checkin' },
  { label: 'tabs.writeReflection', hint: 'tabs.writeReflectionHint', icon: 'create-outline', href: '/journal' },
  { label: 'tabs.askCoach', hint: 'tabs.askCoachHint', icon: 'sparkles-outline', href: '/coach' },
];

export default function AppLayout() {
  const t = useTheme();
  const { t: tr } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  return (
    <View className="flex-1 bg-bg">
      <Tabs screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.textSecondary,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 10.5, letterSpacing: 0.2 },
        tabBarStyle: {
          position: 'absolute', left: 14, right: 14, bottom: Math.max(insets.bottom, 10) + 4, height: 68, borderRadius: 26,
          backgroundColor: t.surface, borderTopWidth: 0, paddingTop: 8, paddingBottom: 8, ...shadowLift,
        },
      }}>
        {TAB_DEFS.map((d) => (
          <Tabs.Screen key={d.name} name={d.name} options={{
            title: tr(d.title),
            tabBarIcon: ({ color, focused }) => (
              <View className="items-center">
                <Ionicons name={(focused ? d.icon : `${d.icon}-outline`) as keyof typeof Ionicons.glyphMap} color={color as string} size={23} />
                <View className={`mt-[3px] h-[3px] w-4 rounded-sm ${focused ? 'bg-gold' : 'bg-transparent'}`} />
              </View>
            ),
          }} />
        ))}
      </Tabs>

      <Pressable accessibilityRole="button" accessibilityLabel={tr('tabs.quickActions')} onPress={() => { tap(); setOpen(true); }}
        style={[styles.fab, shadowLift, { bottom: Math.max(insets.bottom, 10) + 4 + 68 + 14 }]}>
        <LinearGradient colors={['#2DD4BF', '#0F9F8F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabInner}>
          <Ionicons name="add" size={30} color="#04201C" />
        </LinearGradient>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel={tr('tabs.closeMenu')}>
          <Pressable style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: insets.bottom + spacing.md }]} onPress={() => undefined}>
            <View style={[styles.grabber, { backgroundColor: t.border }]} />
            <Text size="lg" serif style={{ marginBottom: spacing.sm }}>{tr('tabs.quickActions')}</Text>
            {ACTIONS.map((a) => (
              <Pressable key={a.label} accessibilityRole="button" style={styles.action}
                onPress={() => { tap(); setOpen(false); router.push(a.href as never); }}>
                <View style={[styles.actionIcon, { backgroundColor: t.surfaceAlt }]}><Ionicons name={a.icon} size={22} color={t.primary} /></View>
                <View className="flex-1">
                  <Text weight="600">{tr(a.label)}</Text>
                  <Text size="xs" muted>{tr(a.hint)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={t.textSecondary} />
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30, padding: 3, backgroundColor: '#C9A24B' },
  fabInner: { flex: 1, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(11,18,36,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: 4 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: spacing.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10 },
  actionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
