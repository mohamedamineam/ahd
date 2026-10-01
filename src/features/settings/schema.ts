import type { PaletteId, PaletteSpec } from '@/design/palette';
import type { Digits, Lang, MonthStyle, TimeFormat } from '@/lib/format';
import type { AdhanPrayerId, CalcSettings, Place, PrayerId, TimeZoneMode } from '@/features/prayer/types';
import { DEFAULT_CALC } from '@/features/prayer/engine';
import type { CountdownStart } from '@/features/prayer/displayState';

export const SETTINGS_VERSION = 1;

export type AdhanMode = 'full' | 'short' | 'tone' | 'silent' | 'off';

/** Where a widget lives: on the desktop behind windows, or floating above all apps. */
export type WidgetLayer = 'desktop' | 'top';

export interface PrayerNotify {
  mode: AdhanMode;
  /** adhan sound id (built-in `builtin:<id>` or `custom:<id>`) */
  sound: string;
  volume: number; // 0..1
  fadeIn: boolean;
}

export type ReminderType = 'notification' | 'tone' | 'sound';

/** Widget text: 'light' = white text on dark glass, 'dark' = dark text on light glass, 'auto' = the app's theme. */
export type WidgetText = 'auto' | 'light' | 'dark';
/** Main widget types: 1 standard (tall), 2 panel (dates, all times, Open app), 3 wide. */
export type MainWidgetStyle = 'classic' | 'panel' | 'wide';

export interface Reminder {
  id: string;
  prayer: PrayerId;
  offsetMinutes: number; // negative = before, positive = after (−120 … +120)
  type: ReminderType;
  sound?: string | undefined;
  /** custom message; empty → localised default */
  message: string;
  /** 'adhkar' opens the after-salah adhkar when clicked */
  action?: 'adhkar' | undefined;
  enabled: boolean;
}

export type AdhkarAnchor = 'fixed' | 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export interface AdhkarSchedule {
  enabled: boolean;
  anchor: AdhkarAnchor;
  offsetMinutes: number;
  fixedTime: string; // HH:MM, when anchor = fixed
}

export interface Settings {
  version: number;
  onboarding: { done: boolean; step: number };
  general: {
    language: Lang;
    digits: Digits;
    timeFormat: TimeFormat;
    monthStyle: MonthStyle;
    startWithSystem: boolean;
    keepInTray: boolean;
    checkUpdates: boolean;
  };
  location: {
    current: Place | null;
    tz: TimeZoneMode;
  };
  calc: CalcSettings & {
    hijriOffset: number; // −2 … +2 days
    hijriAtMaghrib: boolean;
    jumuahLabel: boolean;
    useOfficialTimetable: boolean;
    showImsak: boolean;
    showDuha: boolean;
  };
  timer: {
    countdownStart: CountdownStart;
    thresholdMinutes: number;
    includeSunrise: boolean;
    secondsMain: boolean;
    secondsWidget: boolean;
    secondsTaskbar: boolean;
  };
  adhan: {
    perPrayer: Record<AdhanPrayerId, PrayerNotify>;
    fajrSound: string;
    stopShortcut: string | null;
    toastAutoHideSeconds: number;
    toastPosition: 'auto' | 'bottom-end' | 'bottom-start' | 'top-end' | 'top-start';
    muteWhenFullscreen: boolean;
    respectDnd: boolean;
    missedGraceMinutes: number;
    sunriseWarning: boolean;
  };
  reminders: {
    /** Built-in reminder before each of the five prayers (on by default) */
    beforePrayer: { enabled: boolean; minutes: number; type: 'notification' | 'tone' };
    items: Reminder[];
    fridayKahf: boolean;
    fridayKahfTime: string; // HH:MM
    fridayJumuahBefore: boolean;
    fridayJumuahMinutes: number;
  };
  appearance: {
    theme: 'system' | 'light' | 'dark';
    palette: PaletteId;
    custom: PaletteSpec;
    uiScale: number; // 0.9 … 1.5
    reduceMotion: boolean;
    pattern: boolean;
    quranPaper: 'parchment' | 'sepia' | 'dark' | 'auto';
  };
  widgets: {
    /** The main desktop widget: current state large, all times, dates, progress ring. */
    main: {
      enabled: boolean;
      style: MainWidgetStyle;
      size: 'M' | 'L'; // type 1 only: L adds dates and tomorrow's Fajr
      layer: WidgetLayer;
      /** background opacity, 0 … 1 (the text stays fully opaque) */
      opacity: number;
      text: WidgetText;
      locked: boolean;
      seconds: boolean;
    };
    /** The very small widget: prayer name and timer only. */
    mini: {
      enabled: boolean;
      layer: WidgetLayer;
      /** background opacity, 0 … 1 */
      opacity: number;
      text: WidgetText;
      locked: boolean;
      seconds: boolean;
      showName: boolean;
    };
    indicator: {
      enabled: boolean;
      dynamicTrayIcon: boolean; // Windows
      pill: boolean; // Windows taskbar pill
      pillLocked: boolean;
      /** 'auto' follows the light/dark taskbar (Windows setting "Choose your default Windows mode") */
      pillBackground: 'auto' | 'dark' | 'light' | 'transparent';
      /** Text on a transparent pill */
      pillText: 'auto' | 'light' | 'dark';
      panelLabel: boolean; // Linux tray title
      labelFormat: 'name-value' | 'value' | 'name-time';
      trayIconStyle: 'auto' | 'light' | 'dark';
      hideTrayIcon: boolean;
    };
    waylandCompat: boolean;
  };
  quran: {
    riwaya: 'hafs' | 'warsh';
    /** Warsh in Eastern writing (the letters and dots of the Hafs mushaf) or as the Maghrebi Madinah Warsh mushaf */
    warshScript: 'eastern' | 'maghrebi';
    fontScale: number; // 0.8 … 1.8
    layout: 'auto' | 'single' | 'spread';
    arrowNextIsLeft: boolean;
    theme: 'auto' | 'parchment' | 'sepia' | 'dark';
    tafsir: string | null; // selected tafsir resource id
  };
  adhkar: {
    notifications: boolean;
    morning: AdhkarSchedule;
    evening: AdhkarSchedule;
    afterSalah: { enabled: boolean; offsetMinutes: number; prayers: Record<AdhanPrayerId, boolean> };
    sleep: AdhkarSchedule;
    periodic: { enabled: boolean; everyMinutes: number };
    fontScale: number;
    autoAdvance: boolean;
    counterAnimation: boolean;
  };
  privacy: {
    placeSearch: boolean;
    mapTiles: boolean;
    library: boolean;
    tafsirDownloads: boolean;
    updateChecks: boolean;
  };
}

const notify = (sound: string): PrayerNotify => ({ mode: 'full', sound, volume: 0.8, fadeIn: true });

export const DEFAULT_ADHAN = 'builtin:makkah-ibrahim-almadani';
export const DEFAULT_FAJR_ADHAN = 'builtin:fajr-marwan-qassas';

export function defaultSettings(lang: Lang = 'ar'): Settings {
  return {
    version: SETTINGS_VERSION,
    onboarding: { done: false, step: 0 },
    general: {
      language: lang,
      digits: 'latn',
      timeFormat: '24h',
      monthStyle: 'maghreb',
      startWithSystem: true,
      keepInTray: true,
      checkUpdates: true,
    },
    location: { current: null, tz: { kind: 'auto' } },
    calc: {
      ...DEFAULT_CALC,
      hijriOffset: 0,
      hijriAtMaghrib: false,
      jumuahLabel: true,
      useOfficialTimetable: false,
      showImsak: false,
      showDuha: false,
    },
    timer: { countdownStart: 'halfway', thresholdMinutes: 30, includeSunrise: true, secondsMain: true, secondsWidget: true, secondsTaskbar: false },
    adhan: {
      perPrayer: {
        fajr: notify(DEFAULT_FAJR_ADHAN),
        dhuhr: notify(DEFAULT_ADHAN),
        asr: notify(DEFAULT_ADHAN),
        maghrib: notify(DEFAULT_ADHAN),
        isha: notify(DEFAULT_ADHAN),
      },
      fajrSound: DEFAULT_FAJR_ADHAN,
      stopShortcut: 'CommandOrControl+Alt+S',
      toastAutoHideSeconds: 60,
      toastPosition: 'auto',
      muteWhenFullscreen: false,
      respectDnd: false,
      missedGraceMinutes: 3,
      sunriseWarning: false,
    },
    reminders: {
      beforePrayer: { enabled: true, minutes: 10, type: 'tone' },
      items: [],
      fridayKahf: false,
      fridayKahfTime: '09:00',
      fridayJumuahBefore: false,
      fridayJumuahMinutes: 60,
    },
    appearance: {
      theme: 'system',
      palette: 'sage-linen',
      custom: { primaryHue: 150, accentHue: 88, chromaScale: 1 },
      uiScale: 1,
      reduceMotion: false,
      pattern: true,
      quranPaper: 'auto',
    },
    widgets: {
      main: { enabled: false, style: 'classic', size: 'M', layer: 'desktop', opacity: 1, text: 'auto', locked: false, seconds: true },
      mini: { enabled: false, layer: 'top', opacity: 0.96, text: 'auto', locked: false, seconds: true, showName: true },
      indicator: {
        enabled: false,
        dynamicTrayIcon: true,
        pill: true,
        pillLocked: false,
        pillBackground: 'auto',
        pillText: 'auto',
        panelLabel: true,
        labelFormat: 'name-value',
        trayIconStyle: 'auto',
        hideTrayIcon: false,
      },
      waylandCompat: false,
    },
    quran: { riwaya: 'hafs', warshScript: 'eastern', fontScale: 1, layout: 'auto', arrowNextIsLeft: true, theme: 'auto', tafsir: null },
    adhkar: {
      notifications: false,
      morning: { enabled: true, anchor: 'fajr', offsetMinutes: 20, fixedTime: '06:30' },
      evening: { enabled: true, anchor: 'asr', offsetMinutes: 30, fixedTime: '17:00' },
      afterSalah: {
        enabled: true,
        offsetMinutes: 10,
        prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
      },
      sleep: { enabled: true, anchor: 'fixed', offsetMinutes: 120, fixedTime: '22:30' },
      periodic: { enabled: false, everyMinutes: 60 },
      fontScale: 1,
      autoAdvance: false,
      counterAnimation: true,
    },
    privacy: { placeSearch: true, mapTiles: true, library: true, tafsirDownloads: true, updateChecks: true },
  };
}

/** Deep-merge stored settings over defaults so new keys appear after updates. */
export function migrateSettings(stored: unknown, lang: Lang): Settings {
  const base = defaultSettings(lang);
  if (!stored || typeof stored !== 'object') return base;
  const merged = deepMerge(base, stored as Record<string, unknown>) as Settings;
  merged.version = SETTINGS_VERSION;
  return merged;
}

function deepMerge(base: unknown, over: unknown): unknown {
  if (Array.isArray(base) || Array.isArray(over)) return over ?? base;
  if (base && typeof base === 'object' && over && typeof over === 'object') {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
      out[k] = k in out ? deepMerge(out[k], v) : v;
    }
    return out;
  }
  return over === undefined ? base : over;
}
