import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ar from './ar.json';
import { toDigits, type Digits, type Lang } from '@/lib/format';

let currentDigits: Digits = 'latn';

/** Applies the user's digit system to every translated string (counts, times inside messages…). */
const digitsPostProcessor = {
  type: 'postProcessor' as const,
  name: 'digits',
  process: (value: string) => toDigits(value, currentDigits),
};

export function initI18n(lang: Lang, digits: Digits) {
  currentDigits = digits;
  if (i18n.isInitialized) {
    if (i18n.language !== lang) void i18n.changeLanguage(lang);
    return i18n;
  }
  void i18n
    .use(digitsPostProcessor)
    .use(initReactI18next)
    .init({
      resources: { en: { translation: en }, ar: { translation: ar } },
      lng: lang,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      postProcess: ['digits'],
      returnNull: false,
      react: { useSuspense: false },
    });
  return i18n;
}

export function setDigits(digits: Digits) {
  currentDigits = digits;
}

export function detectLanguage(): Lang {
  const langs = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [];
  return langs.some((l) => l?.toLowerCase().startsWith('ar')) ? 'ar' : 'en';
}

export default i18n;
