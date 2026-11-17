import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { useSyncExternalStore } from 'react';
import { initReactI18next } from 'react-i18next';
import { en } from './en';
import { fr } from './fr';

export type Lang = 'en' | 'fr';
const KEY = 'mylifeos-lang';

const deviceLang = (): Lang => (Localization.getLocales()[0]?.languageCode === 'fr' ? 'fr' : 'en');

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: deviceLang(), fallbackLng: 'en', interpolation: { escapeValue: false }, returnNull: false,
});

// undefined = still reading storage, null = fresh install (show the language picker), otherwise the saved choice
let chosen: Lang | null | undefined;
const listeners = new Set<() => void>();
const emit = (v: Lang | null) => { chosen = v; listeners.forEach((f) => f()); };

/** Reads the saved language once at start-up, defaulting to the device language. */
export async function loadLanguage(): Promise<Lang> {
  let v: Lang = deviceLang();
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw === 'en' || raw === 'fr') {
      v = raw;
    } else {
      await AsyncStorage.setItem(KEY, v);
    }
    await i18n.changeLanguage(v);
  } catch { /* storage unavailable: fall back to the device language */ }
  emit(v);
  return v;
}
export async function setLanguage(l: Lang) {
  await i18n.changeLanguage(l);
  try { await AsyncStorage.setItem(KEY, l); } catch { /* ignore */ }
  emit(l);
}
export const useChosenLanguage = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => chosen, () => chosen);
export const currentLocale = () => (i18n.language === 'fr' ? 'fr-FR' : 'en-US');
export const formatNumber = (n: number) => Math.round(n).toLocaleString(currentLocale());
export const currencyLabel = (currency: string) => i18n.language === 'fr' && currency === 'XAF' ? 'FCFA' : currency;
export const formatCurrency = (amount: number, currency: string) => `${formatNumber(amount)} ${currencyLabel(currency)}`;
export default i18n;
