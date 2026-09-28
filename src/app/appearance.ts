import { applyPalette, type ThemeMode } from '@/design/palette';
import type { Settings } from '@/features/settings/schema';
import { setDigits } from '@/i18n';
import i18n from 'i18next';

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function resolvedTheme(s: Settings): ThemeMode {
  if (s.appearance.theme === 'system') return media?.matches ? 'dark' : 'light';
  return s.appearance.theme;
}

/** Apply language/direction, theme, palette, scale, motion and pattern to <html>. */
export function applyAppearance(s: Settings, root: HTMLElement = document.documentElement) {
  const lang = s.general.language;
  root.lang = lang;
  root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  const mode = resolvedTheme(s);
  root.dataset.theme = mode;
  root.dataset.motion = s.appearance.reduceMotion ? 'reduce' : 'full';
  root.dataset.pattern = s.appearance.pattern ? 'on' : 'off';
  root.style.setProperty('--ui-scale', String(s.appearance.uiScale));
  applyPalette(s.appearance.palette, mode, s.appearance.custom, root);
  setDigits(s.general.digits);
  if (i18n.language !== lang) void i18n.changeLanguage(lang);
}

export function onSystemThemeChange(fn: () => void) {
  media?.addEventListener('change', fn);
  return () => media?.removeEventListener('change', fn);
}
