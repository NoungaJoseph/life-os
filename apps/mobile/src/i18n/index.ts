import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { useSyncExternalStore } from 'react';
import { initReactI18next } from 'react-i18next';
import { en } from './en';
import { fr } from './fr';

export type Lang = 'en' | 'fr';
const KEY = 'mylifeos-lang';
const CHOSEN_KEY = 'mylifeos-lang:chosen';

const deviceLang = (): Lang => (Localization.getLocales()[0]?.languageCode === 'fr' ? 'fr' : 'en');

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: deviceLang(), fallbackLng: 'en', interpolation: { escapeValue: false }, returnNull: false,
});

// undefined = still reading storage, null = fresh install (show the language picker), otherwise the saved choice
let chosen: Lang | null | undefined;
const listeners = new Set<() => void>();
const emit = (v: Lang | null) => { chosen = v; listeners.forEach((f) => f()); };

/** Older builds saved the device default without asking. Only a confirmed choice skips the picker. */
export async function loadLanguage(): Promise<Lang | null> {
  let v: Lang = deviceLang();
  let saved: Lang | null = null;
  try {
    const [[, raw], [, confirmed], [, introSeen]] = await AsyncStorage.multiGet([KEY, CHOSEN_KEY, 'mylifeos:intro:seen']);
    if (raw === 'en' || raw === 'fr') {
      v = raw;
      if (confirmed === '1' || introSeen === '1') saved = raw;
    }
    await i18n.changeLanguage(v);
  } catch { /* storage unavailable: fall back to the device language */ }
  emit(saved);
  return saved;
}
export async function setLanguage(l: Lang) {
  await i18n.changeLanguage(l);
  try { await AsyncStorage.multiSet([[KEY, l], [CHOSEN_KEY, '1']]); } catch { /* ignore */ }
  emit(l);
}
export const useChosenLanguage = () => useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => chosen, () => chosen);
export const currentLocale = () => (i18n.language === 'fr' ? 'fr-FR' : 'en-US');
export const formatNumber = (n: number) => Math.round(n).toLocaleString(currentLocale());
export const currencyLabel = (currency: string) => i18n.language === 'fr' && currency === 'XAF' ? 'FCFA' : currency;
export const formatCurrency = (amount: number, currency: string) => `${formatNumber(amount)} ${currencyLabel(currency)}`;
export default i18n;
