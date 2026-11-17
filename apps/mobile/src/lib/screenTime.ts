import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export type InstalledApp = { identifier: string; name: string };
export type DailyUsage = { app_identifier: string; used_on: string; minutes: number };
type NativeScreenTime = {
  hasUsagePermission(): boolean;
  hasAccessibilityPermission(): boolean;
  openUsageSettings(): void;
  openAccessibilitySettings(): void;
  installedApps(): Promise<InstalledApp[]>;
  dailyUsage(): Promise<DailyUsage[]>;
  applyRules(rules: { app_identifier: string; daily_limit_minutes: number; block_minutes: number; enabled: boolean; blocked_until: string | null }[]): void;
};
const native = Platform.OS === 'android' && Constants.appOwnership !== 'expo'
  ? requireOptionalNativeModule<NativeScreenTime>('MyLifeScreenTime') : null;

export const screenTimeCapability = () => Platform.OS === 'android' && !!native;
export const screenTimeNative = native;
