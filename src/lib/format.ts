import { DateTime } from 'luxon';
import { HIJRI_MONTHS_AR, HIJRI_MONTHS_EN, type HijriDate } from '@/features/prayer/hijri';

export type Lang = 'ar' | 'en';
export type Digits = 'latn' | 'arab';
export type TimeFormat = '24h' | '12h';
export type MonthStyle = 'maghreb' | 'egypt' | 'levant';

const ARABIC_INDIC = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** Replace Western digits with Arabic-Indic digits when requested. */
export function toDigits(s: string, digits: Digits): string {
  if (digits === 'latn') return s;
  return s.replace(/[0-9]/g, (c) => ARABIC_INDIC[c.charCodeAt(0) - 48]!);
}

/** Parse either digit system back to a number (used by time inputs). */
export function fromDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660));
}

export interface TimeOpts {
  lang: Lang;
  digits: Digits;
  format: TimeFormat;
  seconds?: boolean;
}

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

export function formatTime(epochMs: number, zone: string, o: TimeOpts): string {
  if (!Number.isFinite(epochMs)) return '—';
  const dt = DateTime.fromMillis(epochMs, { zone });
  let s: string;
  if (o.format === '24h') {
    s = `${pad2(dt.hour)}:${pad2(dt.minute)}${o.seconds ? `:${pad2(dt.second)}` : ''}`;
  } else {
    const h = dt.hour % 12 === 0 ? 12 : dt.hour % 12;
    const suffix = o.lang === 'ar' ? (dt.hour < 12 ? 'ص' : 'م') : dt.hour < 12 ? 'AM' : 'PM';
    s = `${h}:${pad2(dt.minute)}${o.seconds ? `:${pad2(dt.second)}` : ''} ${suffix}`;
  }
  return toDigits(s, o.digits);
}

export const GREGORIAN_MONTHS_AR: Record<MonthStyle, readonly string[]> = {
  maghreb: ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  egypt: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  levant: [
    'كانون الثاني',
    'شباط',
    'آذار',
    'نيسان',
    'أيار',
    'حزيران',
    'تموز',
    'آب',
    'أيلول',
    'تشرين الأول',
    'تشرين الثاني',
    'كانون الأول',
  ],
};

const GREGORIAN_MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Luxon weekday: 1 = Monday … 7 = Sunday
const WEEKDAYS_AR = ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];
const WEEKDAYS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKDAYS_EN_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function monthStyleForCountry(country: string | undefined): MonthStyle {
  const c = (country ?? '').toUpperCase();
  if (['DZ', 'MA', 'TN', 'LY', 'MR'].includes(c)) return 'maghreb';
  if (['SY', 'LB', 'JO', 'PS', 'IQ'].includes(c)) return 'levant';
  return 'egypt';
}

export interface DateOpts {
  lang: Lang;
  digits: Digits;
  monthStyle: MonthStyle;
}

export function weekdayName(date: string, lang: Lang, short = false): string {
  const wd = DateTime.fromISO(date, { zone: 'UTC' }).weekday - 1;
  return lang === 'ar' ? WEEKDAYS_AR[wd]! : (short ? WEEKDAYS_EN_SHORT : WEEKDAYS_EN)[wd]!;
}

export function gregorianMonthName(month: number, o: Pick<DateOpts, 'lang' | 'monthStyle'>): string {
  return o.lang === 'ar' ? GREGORIAN_MONTHS_AR[o.monthStyle][month - 1]! : GREGORIAN_MONTHS_EN[month - 1]!;
}

/** "30 سبتمبر 2026" / "30 September 2026" (optionally prefixed with the weekday). */
export function formatGregorian(date: string, o: DateOpts & { weekday?: boolean; year?: boolean }): string {
  const dt = DateTime.fromISO(date, { zone: 'UTC' });
  const month = gregorianMonthName(dt.month, o);
  const core = o.year === false ? `${dt.day} ${month}` : `${dt.day} ${month} ${dt.year}`;
  const s = o.weekday ? `${weekdayName(date, o.lang)} ${core}` : core;
  return toDigits(s, o.digits);
}

export function hijriMonthName(month: number, lang: Lang): string {
  return (lang === 'ar' ? HIJRI_MONTHS_AR : HIJRI_MONTHS_EN)[month - 1] ?? '';
}

/** "18 ربيع الآخر 1448" / "18 Rabiʿ al-Akhir 1448 AH" */
export function formatHijri(h: HijriDate, o: Pick<DateOpts, 'lang' | 'digits'> & { year?: boolean }): string {
  const month = hijriMonthName(h.month, o.lang);
  const year = o.year === false ? '' : o.lang === 'ar' ? ` ${h.year}` : ` ${h.year} AH`;
  return toDigits(`${h.day} ${month}${year}`, o.digits);
}

/** Split seconds into h/m/s. */
export function hms(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** Signed offset label: "+1 min 20 s" style is localised by the caller; this gives the parts. */
export function offsetParts(seconds: number) {
  const sign = seconds < 0 ? -1 : 1;
  const abs = Math.abs(seconds);
  return { sign, min: Math.floor(abs / 60), sec: abs % 60 };
}

export function formatClock(seconds: number, digits: Digits): string {
  const { h, m, s } = hms(seconds);
  return toDigits(h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`, digits);
}
