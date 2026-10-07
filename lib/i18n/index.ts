// lib/i18n/index.ts: i18next setup for Rewardly Admin.
//
// en, es-MX, zh-Hans today. The Customer app also ships ar, hi and ta; they are
// added here the same way (a catalogue plus an entry in SUPPORTED and LANGUAGES)
// once translated. Until then i18next falls back to English, never to a raw key.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './en.json';
import esMX from './es-MX.json';
import zhHans from './zh-Hans.json';

export const SUPPORTED = ['en', 'es-MX', 'zh-Hans'] as const;
export type AppLanguage = (typeof SUPPORTED)[number];
const STORE_KEY = 'rwa_language'; // 'system' | AppLanguage

function deviceLanguage(): AppLanguage {
  const tag = Localization.getLocales?.()[0]?.languageTag ?? 'en';
  if (tag.startsWith('es')) return 'es-MX';
  if (tag.startsWith('zh')) return 'zh-Hans';
  return 'en';
}

export async function initI18n(): Promise<void> {
  const stored = await AsyncStorage.getItem(STORE_KEY).catch(() => null);
  const lng: AppLanguage =
    stored && (SUPPORTED as readonly string[]).includes(stored)
      ? (stored as AppLanguage)
      : deviceLanguage();

  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      'es-MX': { translation: esMX },
      'zh-Hans': { translation: zhHans },
    },
    lng,
    fallbackLng: 'en',
    compatibilityJSON: 'v4',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export async function setAppLanguage(choice: AppLanguage | 'system'): Promise<void> {
  await AsyncStorage.setItem(STORE_KEY, choice);
  await i18n.changeLanguage(choice === 'system' ? deviceLanguage() : choice);
}

export default i18n;
