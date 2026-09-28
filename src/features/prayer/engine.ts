/**
 * The single source of truth for prayer times. Every window (main, widget, panel, toast) and the Rust
 * scheduler get their times from here.
 *
 * - Astronomy: adhan-js (MIT), rounding disabled so seconds are kept.
 * - Time zone: the *location's* zone (IANA via Luxon), never the machine's.
 * - User offsets: applied here in seconds; adhan-js minute adjustments are only used for the method's own
 *   fixed offsets (e.g. Morocco +5 min Dhuhr/Maghrib).
 */
import {
  CalculationMethod,
  CalculationParameters,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PolarCircleResolution,
  PrayerTimes,
  Rounding,
} from 'adhan';
import { DateTime, FixedOffsetZone } from 'luxon';
import { METHODS, isMethodId, type MethodId } from './methods';
import {
  PRAYER_IDS,
  ZERO_OFFSETS,
  type CalcSettings,
  type Place,
  type PrayerDay,
  type PrayerId,
  type PrayerOffsets,
  type TimeZoneMode,
  type TimelineEvent,
} from './types';

export const DEFAULT_CALC: CalcSettings = {
  method: 'mwl',
  fajrAngle: null,
  ishaAngle: null,
  ishaInterval: null,
  maghribAngle: null,
  asr: 'standard',
  highLat: 'auto',
  polar: 'aqrab_yaum',
  imsakMinutes: 10,
  duhaMinutes: 15,
};

export type OfficialRow = Partial<Record<PrayerId, string>>; // "HH:MM" or "HH:MM:SS" local time
export type OfficialTimetable = Record<string, OfficialRow>; // keyed by YYYY-MM-DD

export interface EngineInput {
  place: Pick<Place, 'lat' | 'lon' | 'tz'>;
  tzMode?: TimeZoneMode;
  calc: CalcSettings;
  offsets?: PrayerOffsets;
  official?: OfficialTimetable | null;
  /** Hijri month lookup for the Ramadan rule of Umm al-Qura; returns 1..12 */
  hijriMonthOf?: (date: string) => number;
}

/** Luxon zone name for the location: IANA name or a fixed `UTC±h` zone. */
export function resolveZone(place: Pick<Place, 'tz'>, mode: TimeZoneMode = { kind: 'auto' }): string {
  if (mode.kind === 'iana') return mode.zone;
  if (mode.kind === 'fixed') {
    const minutes = mode.offsetMinutes + (mode.dst ? 60 : 0);
    return FixedOffsetZone.instance(minutes).name;
  }
  return place.tz || 'UTC';
}

export function buildParams(calc: CalcSettings, coords: Coordinates, ramadan: boolean): CalculationParameters {
  const methodId: MethodId = isMethodId(calc.method) ? calc.method : 'mwl';
  const def = METHODS[methodId];
  const params = def.adhanBase ? CalculationMethod[def.adhanBase]() : CalculationMethod.Other();

  if (!def.adhanBase) {
    params.fajrAngle = def.fajrAngle ?? 18;
    params.ishaAngle = def.ishaAngle ?? 0;
    params.ishaInterval = def.ishaInterval ?? 0;
    if (def.maghribAngle !== undefined) params.maghribAngle = def.maghribAngle;
  }
  if (def.adjustments) {
    for (const [k, v] of Object.entries(def.adjustments)) {
      params.methodAdjustments[k as keyof typeof params.methodAdjustments] = v;
    }
  }

  // User overrides (Settings → custom angles). An explicit Isha angle clears an interval and vice versa.
  if (calc.fajrAngle !== null) params.fajrAngle = calc.fajrAngle;
  if (calc.ishaAngle !== null) {
    params.ishaAngle = calc.ishaAngle;
    params.ishaInterval = 0;
  }
  if (calc.ishaInterval !== null) {
    params.ishaInterval = calc.ishaInterval;
  }
  if (calc.maghribAngle !== null) params.maghribAngle = calc.maghribAngle;

  if (ramadan && def.ramadanIshaExtra && params.ishaInterval > 0) {
    params.ishaInterval += def.ramadanIshaExtra;
  }

  params.madhab = calc.asr === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule =
    calc.highLat === 'middle'
      ? HighLatitudeRule.MiddleOfTheNight
      : calc.highLat === 'seventh'
        ? HighLatitudeRule.SeventhOfTheNight
        : calc.highLat === 'twilight'
          ? HighLatitudeRule.TwilightAngle
          : HighLatitudeRule.recommended(coords);
  params.polarCircleResolution =
    calc.polar === 'aqrab_balad'
      ? PolarCircleResolution.AqrabBalad
      : calc.polar === 'unresolved'
        ? PolarCircleResolution.Unresolved
        : PolarCircleResolution.AqrabYaum;
  params.rounding = Rounding.None;
  return params;
}

function ymd(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y!, m!, d!];
}

/** Astronomical times for a local calendar date at the location (epoch ms, NaN if not computable). */
export function calculatedTimes(
  place: Pick<Place, 'lat' | 'lon'>,
  date: string,
  calc: CalcSettings,
  ramadan = false,
): Record<PrayerId, number> {
  const coords = new Coordinates(place.lat, place.lon);
  const params = buildParams(calc, coords, ramadan);
  const [y, m, d] = ymd(date);
  // adhan-js reads the calendar day from the Date's local fields; noon avoids DST gaps at midnight.
  const pt = new PrayerTimes(coords, new Date(y, m - 1, d, 12, 0, 0), params);
  return {
    fajr: pt.fajr.getTime(),
    sunrise: pt.sunrise.getTime(),
    dhuhr: pt.dhuhr.getTime(),
    asr: pt.asr.getTime(),
    maghrib: pt.maghrib.getTime(),
    isha: pt.isha.getTime(),
  };
}

const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

export function parseLocalTime(date: string, hhmm: string, zone: string): number {
  const m = TIME_RE.exec(hhmm.trim());
  if (!m) return NaN;
  const [y, mo, d] = ymd(date);
  const dt = DateTime.fromObject(
    { year: y, month: mo, day: d, hour: Number(m[1]), minute: Number(m[2]), second: Number(m[3] ?? 0) },
    { zone },
  );
  return dt.isValid ? dt.toMillis() : NaN;
}

export function addDays(date: string, days: number): string {
  return DateTime.fromISO(date, { zone: 'UTC' }).plus({ days }).toISODate()!;
}

export function localDate(epochMs: number, zone: string): string {
  return DateTime.fromMillis(epochMs, { zone }).toISODate()!;
}

export function isFridayLocal(date: string): boolean {
  return DateTime.fromISO(date, { zone: 'UTC' }).weekday === 5;
}

/**
 * Engine with a small per-date cache (the same dates are asked for repeatedly by the dial, list, widget
 * and scheduler). Create a new engine whenever any input changes.
 */
export class PrayerEngine {
  readonly zone: string;
  private cache = new Map<string, PrayerDay>();
  private rawCache = new Map<string, Record<PrayerId, number>>();

  constructor(private readonly input: EngineInput) {
    this.zone = resolveZone({ tz: input.place.tz }, input.tzMode);
  }

  private raw(date: string): Record<PrayerId, number> {
    let r = this.rawCache.get(date);
    if (!r) {
      const ramadan = this.input.hijriMonthOf ? this.input.hijriMonthOf(date) === 9 : false;
      r = calculatedTimes(this.input.place, date, this.input.calc, ramadan);
      this.rawCache.set(date, r);
    }
    return r;
  }

  /** Final times for a date, before night boundaries (used to avoid recursion). */
  private finalTimes(date: string): { times: Record<PrayerId, number>; source: PrayerDay['source']; degraded: boolean } {
    const calculated = this.raw(date);
    const row = this.input.official?.[date];
    const times = {} as Record<PrayerId, number>;
    let degraded = false;
    let official = false;
    for (const p of PRAYER_IDS) {
      const o = row?.[p];
      if (o) {
        const t = parseLocalTime(date, o, this.zone);
        if (Number.isFinite(t)) {
          times[p] = t;
          official = true;
          continue;
        }
      }
      const base = calculated[p];
      if (!Number.isFinite(base)) degraded = true;
      times[p] = base + (this.input.offsets ?? ZERO_OFFSETS)[p] * 1000;
    }
    return { times, source: official ? 'official' : 'calculation', degraded };
  }

  day(date: string): PrayerDay {
    const hit = this.cache.get(date);
    if (hit) return hit;
    const { times, source, degraded } = this.finalTimes(date);
    const tomorrowFajr = this.finalTimes(addDays(date, 1)).times.fajr;
    const night = tomorrowFajr - times.maghrib;
    const calc = this.input.calc;
    const day: PrayerDay = {
      date,
      zone: this.zone,
      times,
      calculated: this.raw(date),
      imsak: times.fajr - calc.imsakMinutes * 60_000,
      duha: times.sunrise + calc.duhaMinutes * 60_000,
      midnight: times.maghrib + night / 2,
      lastThird: times.maghrib + (night * 2) / 3,
      isFriday: isFridayLocal(date),
      source,
      degraded,
    };
    this.cache.set(date, day);
    return day;
  }

  today(now: number): PrayerDay {
    return this.day(localDate(now, this.zone));
  }

  /**
   * Chronological events from the day before `fromDate` to `days` days later. The day before is needed
   * for "before the first event after midnight, prev is yesterday's Isha".
   */
  timeline(fromDate: string, days: number): TimelineEvent[] {
    const out: TimelineEvent[] = [];
    for (let i = -1; i <= days; i++) {
      const date = addDays(fromDate, i);
      const d = this.day(date);
      for (const id of PRAYER_IDS) {
        const at = d.times[id];
        if (Number.isFinite(at)) out.push({ id, at, isFriday: d.isFriday, date });
      }
    }
    out.sort((a, b) => a.at - b.at);
    return out;
  }
}
