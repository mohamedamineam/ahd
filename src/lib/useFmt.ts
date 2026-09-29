import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useS } from '@/features/settings/store';
import { toHijri } from '@/features/prayer/hijri';
import { labelKey } from '@/features/prayer/displayState';
import type { PrayerId } from '@/features/prayer/types';
import { formatGregorian, formatHHMM, formatHijri, formatTime, hms, ltr, toDigits } from './format';

export function useFmt() {
  const { t } = useTranslation();
  const general = useS((s) => s.general);
  const hijriOffset = useS((s) => s.calc.hijriOffset);
  const jumuah = useS((s) => s.calc.jumuahLabel);
  const { language: lang, digits, timeFormat, monthStyle } = general;

  const time = useCallback(
    (epoch: number, zone: string, seconds = false) => formatTime(epoch, zone, { lang, digits, format: timeFormat, seconds }),
    [lang, digits, timeFormat],
  );

  /** "2 h 3 min" / "ساعتين و3 دقائق" — for secondary text. */
  const duration = useCallback(
    (totalSeconds: number) => {
      const { h, m, s } = hms(totalSeconds);
      if (h > 0 && m > 0) return t('time.hm', { h: t('time.h', { count: h }), m: t('time.m', { count: m }) });
      if (h > 0) return t('time.h', { count: h });
      if (m > 0) return t('time.m', { count: m });
      return t('time.s', { count: s });
    },
    [t],
  );

  /** Full words for screen readers: "12 minutes 30 seconds". */
  const durationLong = useCallback(
    (totalSeconds: number) => {
      const { h, m, s } = hms(totalSeconds);
      const parts: string[] = [];
      if (h) parts.push(t('time.hours', { count: h }));
      if (m) parts.push(t('time.minutes', { count: m }));
      if (s || !parts.length) parts.push(t('time.seconds', { count: s }));
      return lang === 'ar' ? parts.join(' و') : parts.join(' ');
    },
    [t, lang],
  );

  const hijri = useCallback((date: string, year = true) => formatHijri(toHijri(date, hijriOffset), { lang, digits, year }), [lang, digits, hijriOffset]);
  const gregorian = useCallback(
    (date: string, opts: { weekday?: boolean; year?: boolean } = {}) => formatGregorian(date, { lang, digits, monthStyle, ...opts }),
    [lang, digits, monthStyle],
  );
  const num = useCallback((v: number | string) => toDigits(String(v), digits), [digits]);
  /** a wall-clock "HH:MM" in the user's time format */
  const clock = useCallback((hhmm: string) => formatHHMM(hhmm, { lang, digits, format: timeFormat }), [lang, digits, timeFormat]);
  const prayer = useCallback((id: PrayerId, isFriday = false) => t(`prayers.${labelKey({ id, isFriday }, jumuah)}`), [t, jumuah]);

  return useMemo(
    () => ({ t, lang, digits, time, duration, durationLong, hijri, gregorian, num, clock, ltr, prayer, dir: lang === 'ar' ? 'rtl' : 'ltr' }),
    [t, lang, digits, time, duration, durationLong, hijri, gregorian, num, clock, prayer],
  );
}
