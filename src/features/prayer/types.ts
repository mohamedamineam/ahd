export const PRAYER_IDS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerId = (typeof PRAYER_IDS)[number];

/** Prayers that have an adhan (sunrise is an event that ends Fajr time, not a prayer). */
export const ADHAN_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type AdhanPrayerId = (typeof ADHAN_PRAYERS)[number];

export type PrayerOffsets = Record<PrayerId, number>; // seconds, may be negative

export const ZERO_OFFSETS: PrayerOffsets = { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };

export interface Place {
  /** Stable id: `geonames:<id>`, `osm:<type><id>`, or `manual:<lat>,<lon>` */
  id: string;
  name: string;
  nameAr?: string | undefined;
  admin1?: string | undefined;
  admin1Ar?: string | undefined;
  country: string; // ISO 3166-1 alpha-2
  countryName?: string | undefined;
  countryNameAr?: string | undefined;
  lat: number;
  lon: number;
  elevation?: number | undefined;
  tz: string; // IANA
  source: 'geonames' | 'nominatim' | 'manual' | 'detected';
}

export type AsrMethod = 'standard' | 'hanafi';
export type HighLatitudeRuleId = 'auto' | 'middle' | 'seventh' | 'twilight';
export type PolarResolution = 'aqrab_yaum' | 'aqrab_balad' | 'unresolved';

export interface CalcSettings {
  method: string; // MethodId
  /** Overrides applied on top of the method (Settings → Prayer calculation → custom angles). */
  fajrAngle: number | null;
  ishaAngle: number | null;
  ishaInterval: number | null; // minutes after Maghrib
  maghribAngle: number | null;
  asr: AsrMethod;
  highLat: HighLatitudeRuleId;
  polar: PolarResolution;
  imsakMinutes: number; // Fajr − N
  duhaMinutes: number; // Sunrise + N
}

export type TimeZoneMode =
  | { kind: 'auto' }
  | { kind: 'iana'; zone: string }
  | { kind: 'fixed'; offsetMinutes: number; dst: boolean };

export interface PrayerDay {
  /** Local calendar date at the location, `YYYY-MM-DD` */
  date: string;
  zone: string;
  /** Final times (epoch ms) with the user's per-second offsets applied (or the official timetable). */
  times: Record<PrayerId, number>;
  /** Pure astronomical times before user offsets (epoch ms). */
  calculated: Record<PrayerId, number>;
  imsak: number;
  duha: number;
  /** Islamic midnight (middle of Maghrib → next Fajr) and start of the last third of the night. */
  midnight: number;
  lastThird: number;
  isFriday: boolean;
  source: 'calculation' | 'official';
  /** True if some time could not be computed (polar day/night) and was resolved or is missing. */
  degraded: boolean;
}

export interface TimelineEvent {
  id: PrayerId;
  at: number; // epoch ms
  isFriday: boolean;
  date: string; // local date of this event's prayer day
}
