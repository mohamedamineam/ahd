import { addDays, localDate, type PrayerEngine } from './engine';

/** Gregorian date whose Hijri equivalent is "today" — optionally switching at Maghrib. */
export function hijriBaseDate(now: number, engine: PrayerEngine, atMaghrib: boolean): string {
  const date = localDate(now, engine.zone);
  if (atMaghrib && now >= engine.day(date).times.maghrib) return addDays(date, 1);
  return date;
}
