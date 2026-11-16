import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text as RNText, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fontSize, fonts, radius, shadow, shadowLift, spacing } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

export const tap = () => { if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };
export const success = () => { if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); };

// ---------- Layout ----------
export function Screen({ children, scroll = true, onRefresh, refreshing = false, bottomPad = 0 }: {
  children: React.ReactNode; scroll?: boolean; onRefresh?: () => void; refreshing?: boolean; bottomPad?: number;
}) {
  const t = useTheme();
  const body = scroll ? (
    <ScrollView
      contentContainerClassName="grow"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} /> : undefined}
    >
      <View className="grow gap-4" style={{ marginHorizontal: spacing.lg, paddingBottom: spacing.xxl + bottomPad, paddingTop: spacing.lg }}>{children}</View>
    </ScrollView>
  ) : <View className="grow gap-4 p-6">{children}</View>;
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'left', 'right']}
      style={Platform.OS === 'web' ? { maxWidth: '100%', minWidth: 0, width: '100%' } : undefined}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={Platform.OS === 'web' ? { maxWidth: '100%', minWidth: 0, width: '100%' } : undefined}>{body}</KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Header({ title, subtitle, back, onBack, right, eyebrow }: { title: string; subtitle?: string; back?: boolean; onBack?: () => void; right?: React.ReactNode; eyebrow?: string }) {
  const router = useRouter();
  const t = useTheme();
  const { t: tr } = useTranslation();
  return (
    <View className="gap-1">
      {back && (
        <Pressable onPress={onBack ?? (() => router.back())} accessibilityRole="button" accessibilityLabel={tr('ui.goBack')} hitSlop={12} className="-ml-1 mb-0.5 flex-row items-center">
          <Ionicons name="chevron-back" size={22} color={t.primary} />
          <Text size="sm" color={t.primary} weight="600">{tr('ui.back')}</Text>
        </Pressable>
      )}
      {eyebrow ? <RNText className="font-semibold text-[11px] text-gold" style={{ letterSpacing: 1.8 }}>{eyebrow.toUpperCase()}</RNText> : null}
      <View className="flex-row items-center justify-between gap-4">
        <View className="flex-1">
          <Text size="xl" serif>{title}</Text>
          {subtitle ? <Text size="sm" muted style={{ marginTop: 2 }}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      <View className="mt-2 h-0.5 w-9 rounded-full bg-gold opacity-90" />
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const t = useTheme();
  return (
    <View className="mt-4 flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <View className="h-[18px] w-[3px] rounded-sm bg-gold" />
        <Text size="lg" serif>{title}</Text>
      </View>
      {action ? <Pressable onPress={onAction} hitSlop={10}><Text size="sm" color={t.primary} weight="600">{action}</Text></Pressable> : null}
    </View>
  );
}

// ---------- Text ----------
type W = '400' | '500' | '600' | '700';
const FAMILY: Record<W, string> = { '400': 'font-sans', '500': 'font-medium', '600': 'font-semibold', '700': 'font-bold' };
const SIZE: Record<keyof typeof fontSize, string> = { xs: 'text-[12px]', sm: 'text-[14px]', md: 'text-[16px]', lg: 'text-[20px]', xl: 'text-[26px]', xxl: 'text-[34px]' };
export function Text({ children, size = 'md', weight = '400', muted, color, serif, style, numberOfLines }: {
  children: React.ReactNode; size?: keyof typeof fontSize; weight?: W; muted?: boolean; color?: string; serif?: boolean;
  style?: object; numberOfLines?: number;
}) {
  return (
    <RNText
      numberOfLines={numberOfLines}
      className={`${SIZE[size]} ${serif ? 'font-serif' : FAMILY[weight]} ${muted ? 'text-ink-2' : 'text-ink'}`}
      style={[color ? { color } : null, { lineHeight: Math.round(fontSize[size] * (serif ? 1.25 : 1.45)) }, style]}
    >{children}</RNText>
  );
}

// ---------- Surfaces ----------
export function Card({ children, style, onPress, className = '' }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void; className?: string }) {
  // Default gap only when the caller did not choose one, so the two never fight.
  const inner = <View className={`${/\bgap-/.test(className) ? '' : 'gap-2'} rounded-lg border border-line bg-surface p-[18px] ${className}`} style={[shadow, style]}>{children}</View>;
  return onPress ? <Press onPress={onPress}>{inner}</Press> : inner;
}

/** Pressable with a subtle press-in scale for a tactile feel. */
export function Press({ children, onPress, style, disabled, label, className }: {
  children: React.ReactNode; onPress?: () => void; style?: ViewStyle; disabled?: boolean; label?: string; className?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} onPressIn={() => to(0.97)} onPressOut={() => to(1)}>
      <Animated.View style={{ transform: [{ scale }] }}><View className={className} style={style}>{children}</View></Animated.View>
    </Pressable>
  );
}

export function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Animated.timing(v, { toValue: 1, duration: 380, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delay]);
  // React Native's Animated timing can remain at opacity 0 in static web exports
  // and headless browsers. Keep motion on native while ensuring web content is
  // immediately visible and accessible.
  if (Platform.OS === 'web') return <View>{children}</View>;
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>{children}</Animated.View>
  );
}

// ---------- Inputs ----------
export function Button({ title, onPress, loading, disabled, variant = 'primary', icon }: {
  title: string; onPress: () => void; loading?: boolean; disabled?: boolean; variant?: 'primary' | 'ghost' | 'dark' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const t = useTheme();
  const fg = variant === 'primary' ? '#06231F' : variant === 'dark' ? '#FFFFFF' : variant === 'danger' ? t.error : t.text;
  const border = variant === 'ghost' ? t.border : variant === 'danger' ? t.error : variant === 'dark' ? t.gold : 'transparent';
  const content = loading ? <ActivityIndicator color={fg} /> : (
    <View className="flex-row items-center gap-2">
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <RNText className="font-semibold text-[16px]" style={{ color: fg, letterSpacing: 0.2 }}>{title}</RNText>
    </View>
  );
  const base = { borderColor: border, borderWidth: variant === 'primary' ? 0 : 1, opacity: disabled || loading ? 0.5 : 1 };
  return (
    <Press onPress={() => { tap(); onPress(); }} disabled={disabled || loading} label={title}
      className="min-h-[50px] items-center justify-center rounded-md py-3.5"
      style={variant === 'primary' ? { ...base, ...shadow, shadowColor: '#0F766E', shadowOpacity: 0.25, overflow: 'hidden' } : { ...base, backgroundColor: variant === 'dark' ? t.primaryDark : 'transparent' }}>
      {variant === 'primary' ? (
        <LinearGradient colors={['#2DD4BF', '#14B8A6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      ) : null}
      {content}
    </Press>
  );
}

export function Field({ label, error, multiline, onFocus, onBlur, right, hint, ...rest }: TextInputProps & { label: string; error?: string; right?: React.ReactNode; hint?: string }) {
  const t = useTheme();
  const [focus, setFocus] = React.useState(false);
  return (
    <View className="gap-1">
      <Text size="sm" weight="600">{label}</Text>
      <View>
      <TextInput
        placeholderTextColor={t.textSecondary} multiline={multiline} accessibilityLabel={label} {...rest}
        onFocus={(e) => { setFocus(true); onFocus?.(e); }} onBlur={(e) => { setFocus(false); onBlur?.(e); }}
        className={`rounded-md border bg-surface px-4 py-3 font-sans text-[16px] text-ink ${error ? 'border-danger' : focus ? 'border-primary' : 'border-line'} ${multiline ? 'min-h-[96px]' : ''}`}
        style={[focus && { shadowColor: t.primary, shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, multiline && { textAlignVertical: 'top' }, right ? { paddingRight: 72 } : null]}
      />
      {right ? <View className="absolute bottom-0 right-3 top-0 justify-center">{right}</View> : null}
      </View>
      {hint && !error ? <Text size="xs" muted>{hint}</Text> : null}
      {error ? <Text size="xs" color={t.error}>{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { tap(); onPress(); }}
      className={`rounded-full border px-3.5 py-2 ${selected ? 'border-primary bg-primary' : 'border-line bg-surface'}`}>
      <RNText className={`font-medium text-[14px] ${selected ? 'text-[#0B1224]' : 'text-ink'}`}>{label}</RNText>
    </Pressable>
  );
}

export function Row({ children, gap = 8 }: { children: React.ReactNode; gap?: number }) {
  return <View className="flex-row flex-wrap" style={{ gap }}>{children}</View>;
}

/** Animated round checkbox used for tasks and habits. */
export function Check({ checked, onPress, label }: { checked: boolean; onPress: () => void; label: string }) {
  const t = useTheme();
  const v = useRef(new Animated.Value(checked ? 1 : 0)).current;
  useEffect(() => { Animated.spring(v, { toValue: checked ? 1 : 0, useNativeDriver: false, speed: 30, bounciness: 8 }).start(); }, [checked, v]);
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label} hitSlop={10}
      onPress={() => { checked ? tap() : success(); onPress(); }}>
      <Animated.View style={{
        width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
        borderColor: v.interpolate({ inputRange: [0, 1], outputRange: [t.border, t.primary] }),
        backgroundColor: v.interpolate({ inputRange: [0, 1], outputRange: [t.surface, t.primary] }),
      }}>
        <Animated.View style={{ opacity: v, transform: [{ scale: v }] }}><Ionicons name="checkmark" size={16} color="#0B1224" /></Animated.View>
      </Animated.View>
    </Pressable>
  );
}

// ---------- Data display ----------
const TONES = (t: ReturnType<typeof useTheme>) => ({
  success: t.success, warning: t.warning, error: t.error, info: t.primary, accent: t.accent, neutral: t.textSecondary,
});
export type Tone = 'success' | 'warning' | 'error' | 'info' | 'accent' | 'neutral';
export function Pill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = useTheme();
  const c = TONES(t)[tone];
  return (
    <View style={{ backgroundColor: `${c}22`, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' }}>
      <RNText style={{ color: c, fontSize: 12, fontFamily: fonts.semibold }}>{label}</RNText>
    </View>
  );
}

export function ProgressBar({ value, tone = 'info', height = 8 }: { value: number; tone?: Tone; height?: number }) {
  const t = useTheme();
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(w, { toValue: Math.max(0, Math.min(1, value)), duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [value, w]);
  return (
    <View style={{ height, borderRadius: height, backgroundColor: t.surfaceAlt, overflow: 'hidden' }}>
      <Animated.View style={{ height, borderRadius: height, backgroundColor: TONES(t)[tone], width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export function ProgressRing({ value, size = 96, stroke = 9, label, sublabel, trackColor, color, textColor, count }: {
  value: number; size?: number; stroke?: number; label?: string; sublabel?: string; trackColor?: string; color?: string; textColor?: string; count?: number | null;
}) {
  const [shown, setShown] = React.useState(0);
  useEffect(() => {
    if (count === undefined || count === null) return;
    const v = new Animated.Value(0);
    const id = v.addListener(({ value: x }) => setShown(Math.round(x)));
    Animated.timing(v, { toValue: count, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => v.removeListener(id);
  }, [count]);
  const t = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(p, { toValue: Math.max(0, Math.min(1, value)), duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [value, p]);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor ?? t.border} strokeWidth={stroke} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={color ?? t.primary} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${c}`} strokeDashoffset={p.interpolate({ inputRange: [0, 1], outputRange: [c, 0] }) as unknown as number} />
      </Svg>
      {(count !== undefined && count !== null) || label ? <RNText style={{ fontSize: size * 0.3, fontFamily: fonts.serif, color: textColor ?? t.text }}>{count !== undefined && count !== null ? String(shown) : label}</RNText> : null}
      {sublabel ? <RNText style={{ fontSize: 10, letterSpacing: 0.3, fontFamily: fonts.medium, color: textColor ?? t.textSecondary, opacity: 0.8, marginTop: -2 }}>{sublabel}</RNText> : null}
    </View>
  );
}


// ---------- Premium extras ----------
export function IconBadge({ icon, tone = 'info', size = 40 }: { icon: keyof typeof Ionicons.glyphMap; tone?: Tone; size?: number }) {
  const t = useTheme();
  const c = TONES(t)[tone];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2.6, backgroundColor: `${c}1F`, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.5} color={c} />
    </View>
  );
}

export function StatTile({ label, value, sub, icon, tone = 'info' }: { label: string; value: string; sub?: string; icon?: keyof typeof Ionicons.glyphMap; tone?: Tone }) {
  return (
    <View className="min-w-[140px] flex-1 gap-1 rounded-lg border border-line bg-surface p-4" style={shadow}>
      {icon ? <IconBadge icon={icon} tone={tone} size={34} /> : null}
      <Text size="xs" muted>{label}</Text>
      <Text size="lg" serif>{value}</Text>
      {sub ? <Text size="xs" muted>{sub}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View className="flex-row rounded-md bg-surface-alt p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { tap(); onChange(o.value); }}
            className={`flex-1 items-center rounded-[11px] py-[9px] ${on ? 'bg-surface' : ''}`} style={on ? shadow : undefined}>
            <RNText className={`text-[13px] ${on ? 'font-semibold text-ink' : 'font-medium text-ink-2'}`}>{o.label}</RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Divider() {
  return <View className="bg-line" style={{ height: StyleSheet.hairlineWidth }} />;
}

/** Navy gradient panel with soft decorative circles: the signature hero surface. */
export function Hero({ children, colors = ['#14213D', '#223E66'] as [string, string] }: { children: React.ReactNode; colors?: [string, string] }) {
  return (
    <View className="overflow-hidden rounded-xl" style={shadowLift}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: spacing.lg }}>
        <View pointerEvents="none" className="absolute -right-10 -top-[50px] h-[180px] w-[180px] rounded-full bg-[#C9A24B]/15" />
        <View pointerEvents="none" className="absolute -bottom-[60px] -left-[30px] h-[150px] w-[150px] rounded-full bg-[#2DD4BF]/10" />
        <View className="absolute left-6 right-6 top-0 h-px bg-[#C9A24B]/50" />
        {children}
      </LinearGradient>
    </View>
  );
}

// ---------- States ----------
export function ErrorText({ message }: { message?: string | null }) {
  return message ? <Text size="sm" color="#EF4444">{message}</Text> : null;
}
export function Skeleton({ height = 16, width = '100%', radius: r = 10 }: { height?: number; width?: number | string; radius?: number }) {
  const t = useTheme();
  const v = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.45, duration: 800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={{ height, width: width as number, borderRadius: r, backgroundColor: t.border, opacity: v }} />;
}
export function Loading() {
  const { t } = useTranslation();
  return (
    <View className="grow gap-4 bg-bg p-6" accessibilityLabel={t('ui.loading')}>
      <Skeleton height={14} width={90} />
      <Skeleton height={30} width="60%" />
      <Skeleton height={120} radius={24} />
      <Skeleton height={86} radius={20} />
      <Skeleton height={86} radius={20} />
    </View>
  );
}
export function EmptyState({ icon = 'leaf-outline', title, body, action, onAction }: {
  icon?: keyof typeof Ionicons.glyphMap; title: string; body?: string; action?: string; onAction?: () => void;
}) {
  const t = useTheme();
  return (
    <View className="items-center gap-2 py-6">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-surface-alt">
        <Ionicons name={icon} size={26} color={t.primary} />
      </View>
      <Text weight="600">{title}</Text>
      {body ? <Text size="sm" muted style={{ textAlign: 'center' }}>{body}</Text> : null}
      {action ? <View className="self-stretch"><Button title={action} onPress={onAction ?? (() => undefined)} variant="ghost" /></View> : null}
    </View>
  );
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="gap-4 p-6">
      <EmptyState icon="cloud-offline-outline" title={t('ui.errorTitle')} body={message} action={onRetry ? t('ui.tryAgain') : undefined} onAction={onRetry} />
    </View>
  );
}
