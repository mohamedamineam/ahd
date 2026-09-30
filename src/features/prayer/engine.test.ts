/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { CalculationMethod } from 'adhan';
import fixtures from './__fixtures__/aladhan.json';
import aladhanOffsets from '../../../data-pipeline/sources/aladhan-method-offsets.json';
import { DEFAULT_CALC, PrayerEngine, addDays, calculatedTimes, localDate, parseLocalTime, resolveZone } from './engine';
import { displayState } from './displayState';
import { defaultAsrFor, defaultMethodFor, METHODS, METHOD_IDS } from './methods';
import { toHijri } from './hijri';
import { PRAYER_IDS, type CalcSettings, type PrayerId } from './types';

const calcFor = (method: string, asr: 'standard' | 'hanafi' = 'standard'): CalcSettings => ({ ...DEFAULT_CALC, method, asr });

interface Case {
  city: string;
  lat: number;
  lon: number;
  tz: string;
  method: string;
  asr: 'standard' | 'hanafi';
  date: string;
  times: Record<PrayerId, string>;
}

// adhan-js built-in methods carry precautionary adjustments that the Aladhan API does not apply
// (e.g. Dhuhr +1 min for MWL/Egyptian, Dhuhr +5 and Maghrib +3 for the Moonsighting Committee).
// The reference is shifted by (adhan-js method adjustment − Aladhan method offset) so that only the
// astronomy is compared. See docs/ENGINE_ACCURACY.md.
function adjustmentDelta(method: string, p: PrayerId): number {
  const def = METHODS[method as keyof typeof METHODS];
  if (!def?.adhanBase) return 0;
  const adhanAdj = CalculationMethod[def.adhanBase]().methodAdjustments[p] ?? 0;
  const key = ALADHAN_KEY[method];
  const offsets = (aladhanOffsets.methods as Record<string, { offset: Record<string, number> }>)[key ?? '']?.offset;
  const cap = p.charAt(0).toUpperCase() + p.slice(1);
  const aladhanAdj = offsets?.[cap] ?? 0;
  return (adhanAdj - aladhanAdj) * 60_000;
}
const ALADHAN_KEY: Record<string, string> = {
  mwl: 'MWL',
  egypt: 'EGYPT',
  umm_al_qura: 'MAKKAH',
  moonsighting: 'MOONSIGHTING',
  turkey: 'TURKEY',
};

// Asr: adhan-js evaluates the sun's declination with Meeus' interpolation at transit, Aladhan
// (PrayTimes) at the approximate prayer time. Near the equinoxes, when the declination changes fastest,
// the two differ by up to ~1.5 min at 36°, ~2.2 min at 44° and ~3.5 min at 60°. Against a high-precision
// reference (astronomy-engine, geometric altitude) adhan-js is the closer of the two (≤ 66 s vs ≤ 152 s at Oslo).
const tolerance = (p: PrayerId, lat: number) => {
  if (p !== 'asr') return 60;
  const a = Math.abs(lat);
  return a < 40 ? 100 : a < 50 ? 160 : 240;
};

describe('engine vs Aladhan reference values (10 cities × 4 dates)', () => {
  for (const c of fixtures.cases as Case[]) {
    it(`${c.city} ${c.date} (${c.method})`, () => {
      const engine = new PrayerEngine({
        place: { lat: c.lat, lon: c.lon, tz: c.tz },
        calc: calcFor(c.method, c.asr),
        hijriMonthOf: (d) => toHijri(d).month,
      });
      const day = engine.day(c.date);
      for (const p of PRAYER_IDS) {
        // the app computes Asr by the majority opinion only; Hanafi reference Asr times are not comparable
        if (p === 'asr' && c.asr === 'hanafi') continue;
        const ref = parseLocalTime(c.date, c.times[p], c.tz) + adjustmentDelta(c.method, p);
        const diff = Math.abs(day.times[p] - ref) / 1000;
        expect(diff, `${p} differs by ${diff.toFixed(0)} s`).toBeLessThanOrEqual(tolerance(p, c.lat));
      }
    });
  }
});

describe('engine behaviour', () => {
  const setif = { lat: 36.19112, lon: 5.41373, tz: 'Africa/Algiers' };

  it('keeps seconds (no minute rounding)', () => {
    const t = calculatedTimes(setif, '2026-09-23', calcFor('algeria'));
    const withSeconds = PRAYER_IDS.filter((p) => new Date(t[p]).getUTCSeconds() !== 0);
    expect(withSeconds.length).toBeGreaterThan(3);
  });

  it('applies per-prayer offsets in seconds without reordering', () => {
    const base = new PrayerEngine({ place: setif, calc: calcFor('algeria') }).day('2026-09-23');
    const offsets = { fajr: 80, sunrise: -30, dhuhr: 1, asr: 0, maghrib: 180, isha: -61 };
    const adj = new PrayerEngine({ place: setif, calc: calcFor('algeria'), offsets }).day('2026-09-23');
    for (const p of PRAYER_IDS) expect(adj.times[p] - base.times[p]).toBe(offsets[p] * 1000);
    const order = [...PRAYER_IDS].sort((a, b) => adj.times[a] - adj.times[b]);
    expect(order).toEqual([...PRAYER_IDS]);
  });

  it('computes imsak, duha, Islamic midnight and the last third from final times', () => {
    const engine = new PrayerEngine({ place: setif, calc: { ...calcFor('algeria'), imsakMinutes: 10, duhaMinutes: 20 } });
    const d = engine.day('2026-09-23');
    const tomorrow = engine.day('2026-09-24');
    expect(d.imsak).toBe(d.times.fajr - 600_000);
    expect(d.duha).toBe(d.times.sunrise + 1_200_000);
    expect(d.midnight).toBe(d.times.maghrib + (tomorrow.times.fajr - d.times.maghrib) / 2);
    expect(d.lastThird).toBe(d.times.maghrib + ((tomorrow.times.fajr - d.times.maghrib) * 2) / 3);
  });

  it('uses the location time zone, not the machine one', () => {
    const original = process.env.TZ;
    try {
      const makkah = { lat: 21.42664, lon: 39.82563, tz: 'Asia/Riyadh' };
      process.env.TZ = 'Pacific/Kiritimati'; // UTC+14
      const a = new PrayerEngine({ place: makkah, calc: calcFor('umm_al_qura') }).day('2026-09-23');
      process.env.TZ = 'Pacific/Pago_Pago'; // UTC−11
      const b = new PrayerEngine({ place: makkah, calc: calcFor('umm_al_qura') }).day('2026-09-23');
      for (const p of PRAYER_IDS) {
        expect(a.times[p]).toBe(b.times[p]);
        expect(localDate(a.times[p], 'Asia/Riyadh')).toBe('2026-09-23');
      }
      expect(DateTime.fromMillis(a.times.maghrib, { zone: 'Asia/Riyadh' }).toFormat('HH:mm')).toBe('18:16');
    } finally {
      process.env.TZ = original;
    }
  });

  it('handles DST spring-forward and fall-back (Europe/London)', () => {
    const london = { lat: 51.50853, lon: -0.12574, tz: 'Europe/London' };
    const engine = new PrayerEngine({ place: london, calc: calcFor('moonsighting') });
    for (const [before, after] of [
      ['2026-03-28', '2026-03-29'],
      ['2026-10-24', '2026-10-25'],
    ] as const) {
      const d1 = engine.day(before);
      const d2 = engine.day(after);
      // Local clock times move by about an hour, absolute Dhuhr by only a few seconds
      const localDhuhr1 = DateTime.fromMillis(d1.times.dhuhr, { zone: london.tz });
      const localDhuhr2 = DateTime.fromMillis(d2.times.dhuhr, { zone: london.tz });
      expect(Math.abs(localDhuhr2.hour - localDhuhr1.hour)).toBe(1);
      expect(Math.abs(d2.times.dhuhr - d1.times.dhuhr - 86_400_000)).toBeLessThan(60_000);
      // the display state is continuous across the switch night
      const timeline = engine.timeline(before, 2);
      let last = displayState(d1.times.isha + 1000, timeline, { countdownStart: 'halfway', thresholdMinutes: 30, includeSunrise: true })!;
      for (let t = d1.times.isha + 2000; t < d2.times.fajr; t += 1000) {
        const s = displayState(t, timeline, { countdownStart: 'halfway', thresholdMinutes: 30, includeSunrise: true })!;
        if (s.mode === last.mode && s.event.at === last.event.at) {
          expect(Math.abs(s.seconds - last.seconds)).toBe(1);
        }
        last = s;
      }
    }
  });

  it('handles high-latitude summer days (Oslo, June)', () => {
    const oslo = { lat: 59.91273, lon: 10.74609, tz: 'Europe/Oslo' };
    const d = new PrayerEngine({ place: oslo, calc: calcFor('mwl') }).day('2026-06-21');
    for (const p of PRAYER_IDS) expect(Number.isFinite(d.times[p])).toBe(true);
    const order = [...PRAYER_IDS].sort((a, b) => d.times[a] - d.times[b]);
    expect(order).toEqual([...PRAYER_IDS]);
  });

  it('resolves polar days above the Arctic circle instead of failing', () => {
    const tromso = { lat: 69.6496, lon: 18.956, tz: 'Europe/Oslo' };
    const d = new PrayerEngine({ place: tromso, calc: calcFor('mwl') }).day('2026-12-21');
    expect(Number.isFinite(d.times.sunrise)).toBe(true);
    expect(Number.isFinite(d.times.maghrib)).toBe(true);
  });

  it('adds 30 minutes to Umm al-Qura Isha in Ramadan only', () => {
    const makkah = { lat: 21.42664, lon: 39.82563, tz: 'Asia/Riyadh' };
    const engine = new PrayerEngine({ place: makkah, calc: calcFor('umm_al_qura'), hijriMonthOf: (d) => toHijri(d).month });
    const ramadan = engine.day('2026-03-01'); // 12 Ramadan 1447
    const shawwal = engine.day('2026-03-25');
    expect(Math.round((ramadan.times.isha - ramadan.times.maghrib) / 60_000)).toBe(120);
    expect(Math.round((shawwal.times.isha - shawwal.times.maghrib) / 60_000)).toBe(90);
  });

  it('lets an official timetable override calculation for listed dates only', () => {
    const engine = new PrayerEngine({
      place: setif,
      calc: calcFor('algeria'),
      offsets: { fajr: 600, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
      official: { '2026-09-23': { fajr: '05:05', sunrise: '06:28', dhuhr: '12:34', asr: '15:59', maghrib: '18:37', isha: '19:57' } },
    });
    const official = engine.day('2026-09-23');
    expect(official.source).toBe('official');
    expect(DateTime.fromMillis(official.times.fajr, { zone: setif.tz }).toFormat('HH:mm:ss')).toBe('05:05:00');
    const calculated = engine.day('2026-09-24');
    expect(calculated.source).toBe('calculation');
  });

  it('flags Fridays in the location calendar', () => {
    const engine = new PrayerEngine({ place: setif, calc: calcFor('algeria') });
    expect(engine.day('2026-09-25').isFriday).toBe(true);
    expect(engine.day('2026-09-24').isFriday).toBe(false);
  });

  it('builds a sorted timeline that includes the previous evening', () => {
    const engine = new PrayerEngine({ place: setif, calc: calcFor('algeria') });
    const tl = engine.timeline('2026-09-24', 2);
    expect(tl[0]!.date).toBe('2026-09-23');
    for (let i = 1; i < tl.length; i++) expect(tl[i]!.at).toBeGreaterThan(tl[i - 1]!.at);
  });

  it('supports fixed UTC offsets with manual DST', () => {
    expect(resolveZone({ tz: 'Africa/Algiers' }, { kind: 'fixed', offsetMinutes: 60, dst: false })).toBe('UTC+1');
    expect(resolveZone({ tz: 'Africa/Algiers' }, { kind: 'fixed', offsetMinutes: 60, dst: true })).toBe('UTC+2');
    expect(resolveZone({ tz: 'Africa/Algiers' }, { kind: 'iana', zone: 'Europe/Paris' })).toBe('Europe/Paris');
  });

  it('adds days on the calendar, independent of DST', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('methods table', () => {
  it('has a source for every method and computes finite times for each', () => {
    for (const id of METHOD_IDS) {
      expect(METHODS[id].source.length).toBeGreaterThan(5);
      const t = calculatedTimes({ lat: 36.19, lon: 5.41 }, '2026-09-23', calcFor(id));
      for (const p of PRAYER_IDS) expect(Number.isFinite(t[p]), `${id} ${p}`).toBe(true);
    }
  });

  it('maps countries to default methods and Asr', () => {
    expect(defaultMethodFor('DZ')).toBe('algeria');
    expect(defaultMethodFor('ma')).toBe('morocco');
    expect(defaultMethodFor('SA')).toBe('umm_al_qura');
    expect(defaultMethodFor('XX')).toBe('mwl');
    expect(defaultMethodFor(undefined)).toBe('mwl');
    expect(defaultAsrFor('PK')).toBe('standard'); // Asr follows the majority opinion everywhere
    expect(defaultAsrFor('DZ')).toBe('standard');
  });
});
