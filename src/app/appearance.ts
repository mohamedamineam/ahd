import { applyPalette, type ThemeMode } from '@/design/palette';
import type { Settings } from '@/features/settings/schema';
import type { WindowKind } from '@/lib/bridge';
import { setDigits } from '@/i18n';
import i18n from 'i18next';

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function resolvedTheme(s: Settings): ThemeMode {
  if (s.appearance.theme === 'system') return media?.matches ? 'dark' : 'light';
  return s.appearance.theme;
}

/** The widgets' text colour: white text is drawn with the dark theme (on dark glass), dark text with the light one. */
export function windowTheme(s: Settings, kind: WindowKind = 'main'): ThemeMode {
  const text = kind === 'widget' ? s.widgets.main.text : kind === 'mini' ? s.widgets.mini.text : 'auto';
  return text === 'light' ? 'dark' : text === 'dark' ? 'light' : resolvedTheme(s);
}

/** Apply language/direction, theme, palette, scale, motion and pattern to <html>. */
export function applyAppearance(s: Settings, root: HTMLElement = document.documentElement, kind: WindowKind = 'main') {
  const lang = s.general.language;
  root.lang = lang;
  root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  const mode = windowTheme(s, kind);
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
