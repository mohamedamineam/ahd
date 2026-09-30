/**
 * Builds the event schedule the Rust scheduler owns (brief §10.1): 35 days of prayer times, adhan
 * events, before/after reminders, adhkar and Friday reminders, plus everything the tray/indicator needs
 * to render labels without a webview (localised names, pre-formatted times, day headers).
 */
import { DateTime } from 'luxon';
import type { TFunction } from 'i18next';
import { addDays, localDate, type PrayerEngine } from './engine';
import { labelKey, type CountdownStart } from './displayState';
import { toHijri } from './hijri';
import { ADHAN_PRAYERS, PRAYER_IDS, type AdhanPrayerId, type PrayerId } from './types';
import { formatGregorian, formatHijri, formatTime, weekdayName } from '@/lib/format';
import type { AdhkarSchedule, Settings } from '@/features/settings/schema';

export const SCHEDULE_DAYS = 35;

export interface ScheduleTimelineEvent {
  id: PrayerId;
  at: number;
  friday: boolean;
  date: string;
  label: string;
  timeText: string;
}

export interface ScheduleDay {
  date: string;
  start: number; // local midnight (epoch ms)
  end: number;
  hijri: string;
  gregorian: string;
  weekday: string;
}

export interface FireAudio {
  sound: string;
  volume: number;
  fadeIn: boolean;
  /** seconds; play only up to here ("short" adhan mode) */
  stopAt: number | null;
  kind: 'adhan' | 'tone';
}

export interface FireEvent {
  key: string;
  at: number;
  kind: 'adhan' | 'reminder' | 'adhkar' | 'friday';
  prayer: PrayerId | null;
  audio: FireAudio | null;
  notification: { title: string; body: string } | null;
  toast: boolean;
  route: string | null;
}

export interface SchedulePayload {
  version: 1;
  generatedAt: number;
  lang: 'ar' | 'en';
  digits: 'latn' | 'arab';
  location: string;
  zone: string;
  labels: Record<PrayerId | 'jumuah', string>;
  strings: Record<string, string>;
  display: {
    countdownStart: CountdownStart;
    thresholdMinutes: number;
    includeSunrise: boolean;
    taskbarSeconds: boolean;
    jumuah: boolean;
    labelFormat: 'name-value' | 'value' | 'name-time';
  };
  missedGraceMinutes: number;
  toastAutoHideSeconds: number;
  /** "N minutes" phrases for N = 0…180, pre-pluralised (Arabic has six plural forms). */
  minutesText: string[];
  timeline: ScheduleTimelineEvent[];
  days: ScheduleDay[];
  fire: FireEvent[];
}

export interface ScheduleInput {
  engine: PrayerEngine;
  settings: Settings;
  t: TFunction;
  now: number;
  locationName: string;
  /** Short end (seconds) for each adhan sound id, from adhan.json / custom sounds. */
  shortEnds: Record<string, number | null>;
}

function anchorTime(engine: PrayerEngine, date: string, s: AdhkarSchedule): number | null {
  if (s.anchor === 'fixed') {
    const [h, m] = s.fixedTime.split(':').map(Number);
    const dt = DateTime.fromISO(date, { zone: engine.zone }).set({ hour: h ?? 0, minute: m ?? 0, second: 0 });
    return dt.isValid ? dt.toMillis() : null;
  }
  const t = engine.day(date).times[s.anchor];
  return Number.isFinite(t) ? t + s.offsetMinutes * 60_000 : null;
}

export function buildSchedule(input: ScheduleInput): SchedulePayload {
  const { engine, settings, t, now, locationName } = input;
  const lang = settings.general.language;
  const digits = settings.general.digits;
  const zone = engine.zone;
  const today = localDate(now, zone);
  const timeOpts = { lang, digits, format: settings.general.timeFormat } as const;

  const labels = Object.fromEntries(
    [...PRAYER_IDS, 'jumuah'].map((id) => [id, t(`prayers.${id}`)]),
  ) as Record<PrayerId | 'jumuah', string>;

  const timeline: ScheduleTimelineEvent[] = engine.timeline(today, SCHEDULE_DAYS).map((e) => ({
    id: e.id,
    at: e.at,
    friday: e.isFriday,
    date: e.date,
    label: labels[labelKey(e, settings.calc.jumuahLabel)],
    timeText: formatTime(e.at, zone, timeOpts),
  }));

  const days: ScheduleDay[] = [];
  for (let i = -1; i <= SCHEDULE_DAYS; i++) {
    const date = addDays(today, i);
    const start = DateTime.fromISO(date, { zone }).startOf('day');
    days.push({
      date,
      start: start.toMillis(),
      end: start.plus({ days: 1 }).toMillis(),
      hijri: formatHijri(toHijri(date, settings.calc.hijriOffset), { lang, digits }),
      gregorian: formatGregorian(date, { lang, digits, monthStyle: settings.general.monthStyle }),
      weekday: weekdayName(date, lang),
    });
  }

  const fire: FireEvent[] = [];
  const horizon = now + SCHEDULE_DAYS * 86_400_000;
  const within = (at: number) => Number.isFinite(at) && at > now - 10 * 60_000 && at < horizon;

  for (let i = 0; i < SCHEDULE_DAYS; i++) {
    const date = addDays(today, i);
    const day = engine.day(date);

    // adhan events
    for (const p of ADHAN_PRAYERS) {
      const at = day.times[p];
      if (!within(at)) continue;
      const cfg = settings.adhan.perPrayer[p as AdhanPrayerId];
      if (cfg.mode === 'off') continue;
      const name = labels[labelKey({ id: p, isFriday: day.isFriday }, settings.calc.jumuahLabel)];
      const sound = p === 'fajr' ? settings.adhan.fajrSound || cfg.sound : cfg.sound;
      let audio: FireAudio | null = null;
      if (cfg.mode === 'full' || cfg.mode === 'short') {
        audio = {
          sound,
          volume: cfg.volume,
          fadeIn: cfg.fadeIn,
          stopAt: cfg.mode === 'short' ? (input.shortEnds[sound] ?? 20) : null,
          kind: 'adhan',
        };
      } else if (cfg.mode === 'tone') {
        audio = { sound: 'tone', volume: cfg.volume, fadeIn: false, stopAt: null, kind: 'tone' };
      }
      fire.push({
        key: `${date}:adhan:${p}`,
        at,
        kind: 'adhan',
        prayer: p,
        audio,
        notification: {
          title: t('notify.adhanTitle', { prayer: name }),
          body: t('notify.adhanBody', { prayer: name, time: formatTime(at, zone, timeOpts), place: locationName }),
        },
        toast: cfg.mode === 'full' || cfg.mode === 'short',
        route: null,
      });
    }

    // per-prayer reminders
    for (const r of settings.reminders.items) {
      if (!r.enabled) continue;
      const base = day.times[r.prayer];
      const at = base + r.offsetMinutes * 60_000;
      if (!within(at)) continue;
      const name = labels[labelKey({ id: r.prayer, isFriday: day.isFriday }, settings.calc.jumuahLabel)];
      const minutes = Math.abs(r.offsetMinutes);
      const body =
        r.message.trim() ||
        (r.offsetMinutes < 0
          ? r.prayer === 'sunrise'
            ? t('notify.sunriseWarning', { minutes: t('time.minutes', { count: minutes }) })
            : t('notify.before', { minutes: t('time.minutes', { count: minutes }), prayer: name })
          : r.action === 'adhkar'
            ? t('notify.afterAdhkar', { prayer: name })
            : t('notify.after', { prayer: name }));
      fire.push({
        key: `${date}:reminder:${r.id}`,
        at,
        kind: 'reminder',
        prayer: r.prayer,
        audio:
          r.type === 'tone'
            ? { sound: 'tone', volume: 0.7, fadeIn: false, stopAt: null, kind: 'tone' }
            : r.type === 'sound' && r.sound
              ? { sound: r.sound, volume: 0.8, fadeIn: false, stopAt: 20, kind: 'adhan' }
              : null,
        notification: { title: t('notify.reminderTitle'), body },
        toast: false,
        route: r.action === 'adhkar' ? '/adhkar/after-salah' : null,
      });
    }

    // Friday reminders
    if (day.isFriday) {
      if (settings.reminders.fridayKahf) {
        const at = anchorTime(engine, date, { enabled: true, anchor: 'fixed', offsetMinutes: 0, fixedTime: settings.reminders.fridayKahfTime });
        if (at !== null && within(at)) {
          fire.push({
            key: `${date}:friday:kahf`,
            at,
            kind: 'friday',
            prayer: null,
            audio: null,
            notification: { title: t('notify.fridayTitle'), body: t('notify.kahf') },
            toast: false,
            route: '/quran/surah/18',
          });
        }
      }
      if (settings.reminders.fridayJumuahBefore) {
        const at = day.times.dhuhr - settings.reminders.fridayJumuahMinutes * 60_000;
        if (within(at)) {
          fire.push({
            key: `${date}:friday:jumuah`,
            at,
            kind: 'friday',
            prayer: 'dhuhr',
            audio: null,
            notification: {
              title: t('notify.fridayTitle'),
              body: t('notify.jumuahBefore', {
                minutes: t('time.minutes', { count: settings.reminders.fridayJumuahMinutes }),
              }),
            },
            toast: false,
            route: null,
          });
        }
      }
    }

    // Adhkar reminders (master switch)
    const ak = settings.adhkar;
    if (ak.notifications) {
      const push = (kind: string, at: number | null, route: string, body: string) => {
        if (at !== null && within(at)) {
          fire.push({
            key: `${date}:adhkar:${kind}`,
            at,
            kind: 'adhkar',
            prayer: null,
            audio: null,
            notification: { title: t('notify.adhkarTitle'), body },
            toast: false,
            route,
          });
        }
      };
      if (ak.morning.enabled) push('morning', anchorTime(engine, date, ak.morning), '/adhkar/morning', t('notify.adhkarMorning'));
      if (ak.evening.enabled) push('evening', anchorTime(engine, date, ak.evening), '/adhkar/evening', t('notify.adhkarEvening'));
      if (ak.sleep.enabled) push('sleep', anchorTime(engine, date, ak.sleep), '/adhkar/sleep', t('notify.adhkarSleep'));
      if (ak.afterSalah.enabled) {
        for (const p of ADHAN_PRAYERS) {
          if (!ak.afterSalah.prayers[p]) continue;
          const name = labels[labelKey({ id: p, isFriday: day.isFriday }, settings.calc.jumuahLabel)];
          push(`after-${p}`, day.times[p] + ak.afterSalah.offsetMinutes * 60_000, '/adhkar/after-salah', t('notify.adhkarAfter', { prayer: name }));
        }
      }
      if (ak.periodic.enabled && ak.periodic.everyMinutes >= 15) {
        const step = ak.periodic.everyMinutes * 60_000;
        for (let at = day.times.fajr + step; at < day.times.isha; at += step) {
          push(`periodic-${at}`, at, '/adhkar/tasbih', t('notify.adhkarPeriodic'));
        }
      }
    }
  }

  fire.sort((a, b) => a.at - b.at);

  return {
    version: 1,
    generatedAt: now,
    lang,
    digits,
    location: locationName,
    zone,
    labels,
    strings: {
      open: t('tray.open'),
      showPanel: t('tray.showPanel'),
      stopAdhan: t('tray.stopAdhan'),
      quit: t('tray.quit'),
      settings: t('tray.settings'),
      widget: t('tray.widget'),
      miniWidget: t('tray.miniWidget'),
      indicator: t('tray.indicator'),
      next: t('tray.next'),
      passed: '✓',
      nextMark: lang === 'ar' ? '←' : '→',
      tooltipSep: ' — ',
      toastStop: t('toast.stop'),
      toastClose: t('toast.close'),
      missedTitle: t('notify.missedTitle', { prayer: '{prayer}' }),
      missedBody: t('notify.missedBody', { prayer: '{prayer}', ago: '{ago}' }),
      testTitle: t('notify.testTitle'),
      testBody: t('notify.testBody'),
    },
    display: {
      countdownStart: settings.timer.countdownStart,
      thresholdMinutes: settings.timer.thresholdMinutes,
      includeSunrise: settings.timer.includeSunrise,
      taskbarSeconds: settings.timer.secondsTaskbar,
      jumuah: settings.calc.jumuahLabel,
      labelFormat: settings.widgets.indicator.labelFormat,
    },
    missedGraceMinutes: settings.adhan.missedGraceMinutes,
    toastAutoHideSeconds: settings.adhan.toastAutoHideSeconds,
    minutesText: Array.from({ length: 181 }, (_, n) => t('time.minutes', { count: n })),
    timeline,
    days,
    fire,
  };
}
