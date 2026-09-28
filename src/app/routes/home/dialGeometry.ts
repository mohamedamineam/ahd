/**
 * Geometry of the sun-path dial: time → point on a loop made of the day arc (sunrise → maghrib, upper
 * semicircle) and the night arc (maghrib → next sunrise, flattened lower half-ellipse). Pure and tested.
 */
import type { PrayerDay } from '@/features/prayer/types';

/** Day arc: half-ellipse rx × ry above the horizon; night arc: flattened half-ellipse rx × nry below it. */
export const DIAL = { W: 1000, H: 292, cx: 500, hy: 222, rx: 348, ry: 182, nry: 46 } as const;

export interface DialSpans {
  day: [number, number]; // sunrise → maghrib (today)
  night: [number, number]; // the night that is current or next to come
  morning: boolean; // true: now is before today's sunrise (night precedes the day)
  nightEvents: { isha: number; midnight: number; lastThird: number; fajr: number };
}

export function dialSpans(now: number, yesterday: PrayerDay, today: PrayerDay, tomorrow: PrayerDay): DialSpans {
  const morning = now < today.times.sunrise;
  const nightOf = morning ? yesterday : today;
  const nextFajr = morning ? today.times.fajr : tomorrow.times.fajr;
  const nightEnd = morning ? today.times.sunrise : tomorrow.times.sunrise;
  return {
    day: [today.times.sunrise, today.times.maghrib],
    night: [nightOf.times.maghrib, nightEnd],
    morning,
    nightEvents: { isha: nightOf.times.isha, midnight: nightOf.midnight, lastThird: nightOf.lastThird, fajr: nextFajr },
  };
}

export interface Pt {
  x: number;
  y: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Where on the loop a time falls. */
export function locate(t: number, spans: DialSpans): { part: 'day' | 'night'; f: number } {
  const [d0, d1] = spans.day;
  const [n0, n1] = spans.night;
  if (t >= d0 && t <= d1) return { part: 'day', f: clamp01((t - d0) / (d1 - d0)) };
  if (t >= n0 && t <= n1) return { part: 'night', f: clamp01((t - n0) / (n1 - n0)) };
  // outside both spans: snap to the nearest end
  const dd = Math.min(Math.abs(t - d0), Math.abs(t - d1));
  const dn = Math.min(Math.abs(t - n0), Math.abs(t - n1));
  if (dd <= dn) return { part: 'day', f: t < d0 ? 0 : 1 };
  return { part: 'night', f: t < n0 ? 0 : 1 };
}

export function pointOn(part: 'day' | 'night', f: number, rtl: boolean): Pt {
  const { cx, hy, rx, ry, nry } = DIAL;
  let x: number;
  let y: number;
  if (part === 'day') {
    const th = Math.PI * (1 - f);
    x = cx + rx * Math.cos(th);
    y = hy - ry * Math.sin(th);
  } else {
    const ph = Math.PI * f;
    x = cx + rx * Math.cos(ph);
    y = hy + nry * Math.sin(ph);
  }
  return { x: rtl ? DIAL.W - x : x, y };
}

export function pointAt(t: number, spans: DialSpans, rtl: boolean): Pt {
  const { part, f } = locate(t, spans);
  return pointOn(part, f, rtl);
}

/** Outward unit normal at a point of the loop (for placing labels outside the arc). */
export function normalAt(part: 'day' | 'night', f: number, rtl: boolean): Pt {
  // outward normal of an ellipse (rx cos a, ±ry sin a) is (cos a / rx, ±sin a / ry), normalised
  const a = part === 'day' ? Math.PI * (1 - f) : Math.PI * f;
  const ax = Math.cos(a) / DIAL.rx;
  const ay = part === 'day' ? -Math.sin(a) / DIAL.ry : Math.sin(a) / DIAL.nry;
  const len = Math.hypot(ax, ay) || 1;
  const nx = ax / len;
  const ny = ay / len;
  return { x: rtl ? -nx : nx, y: ny };
}

function arcPath(part: 'day' | 'night', f1: number, f2: number, rtl: boolean): string {
  if (f2 <= f1) return '';
  const a = pointOn(part, f1, rtl);
  const b = pointOn(part, f2, rtl);
  const sweep = rtl ? 0 : 1;
  const r = part === 'day' ? `${DIAL.rx} ${DIAL.ry}` : `${DIAL.rx} ${DIAL.nry}`;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} 0 0 ${sweep} ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

/** SVG path for the time interval [t1, t2], split across the day and night arcs when needed. */
export function segmentPath(t1: number, t2: number, spans: DialSpans, rtl: boolean): string {
  if (!(t2 > t1)) return '';
  const parts: string[] = [];
  const [d0, d1] = spans.day;
  const [n0, n1] = spans.night;
  const clip = (a: number, b: number, s0: number, s1: number) => [Math.max(a, s0), Math.min(b, s1)] as const;
  const [da, db] = clip(t1, t2, d0, d1);
  if (db > da) parts.push(arcPath('day', (da - d0) / (d1 - d0), (db - d0) / (d1 - d0), rtl));
  const [na, nb] = clip(t1, t2, n0, n1);
  if (nb > na) parts.push(arcPath('night', (na - n0) / (n1 - n0), (nb - n0) / (n1 - n0), rtl));
  return parts.join(' ');
}

export const fullDayPath = (rtl: boolean) => arcPath('day', 0, 1, rtl);
export const fullNightPath = (rtl: boolean) => arcPath('night', 0, 1, rtl);
