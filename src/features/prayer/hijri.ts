/**
 * Hijri (Umm al-Qura) dates.
 * Primary: Intl.DateTimeFormat with the `islamic-umalqura` calendar (ICU in WebView2/WebKitGTK).
 * Fallback: @tabby_ai/hijri-converter (MIT, KACST Umm al-Qura table 1343–1500 AH) when the webview's ICU
 * lacks the calendar. The two agree day-for-day from 2000-01-01 to 2029-08-10 (checked at build time,
 * see docs/ATTRIBUTIONS.md); after that their projected month lengths differ, which the user's
 * Hijri day offset (−2…+2) covers until official announcements.
 */
import { gregorianToHijri } from '@tabby_ai/hijri-converter';
import { addDays } from './engine';

export interface HijriDate {
  year: number;
  month: number; // 1..12
  day: number;
}

let formatter: Intl.DateTimeFormat | null = null;
let intlOk: boolean | null = null;

/** Start-up self-test: the calendar exists and maps a known date (1 Ramadan 1446 = 2025-03-01). */
export function hijriSelfTest(): boolean {
  if (intlOk !== null) return intlOk;
  try {
    const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    const ok = f.resolvedOptions().calendar === 'islamic-umalqura';
    const parts = partsOf(f, Date.UTC(2025, 2, 1, 12));
    intlOk = ok && parts.year === 1446 && parts.month === 9 && parts.day === 1;
    formatter = intlOk ? f : null;
  } catch {
    intlOk = false;
  }
  return intlOk;
}

function partsOf(f: Intl.DateTimeFormat, t: number): HijriDate {
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return { year: Number.parseInt(p.year ?? '0', 10), month: Number(p.month), day: Number(p.day) };
}

/** Hijri date for a Gregorian calendar date (`YYYY-MM-DD`), with the user's day offset. */
export function toHijri(date: string, offsetDays = 0): HijriDate {
  const d = offsetDays ? addDays(date, offsetDays) : date;
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  if (hijriSelfTest() && formatter) return partsOf(formatter, Date.UTC(y, m - 1, day, 12));
  try {
    return gregorianToHijri({ year: y, month: m, day });
  } catch {
    return tabular(y, m, day);
  }
}

/** Arithmetic (tabular) Islamic calendar — last resort outside the Umm al-Qura table range. */
function tabular(y: number, m: number, d: number): HijriDate {
  const jd =
    Math.floor((1461 * (y + 4800 + Math.floor((m - 14) / 12))) / 4) +
    Math.floor((367 * (m - 2 - 12 * Math.floor((m - 14) / 12))) / 12) -
    Math.floor((3 * Math.floor((y + 4900 + Math.floor((m - 14) / 12)) / 100)) / 4) +
    d -
    32075;
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { year, month, day };
}

export const HIJRI_MONTHS_AR = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
] as const;

export const HIJRI_MONTHS_EN = [
  'Muharram',
  'Safar',
  'Rabiʿ al-Awwal',
  'Rabiʿ al-Akhir',
  'Jumada al-Ula',
  'Jumada al-Akhirah',
  'Rajab',
  'Shaʿban',
  'Ramadan',
  'Shawwal',
  'Dhu al-Qaʿdah',
  'Dhu al-Hijjah',
] as const;
