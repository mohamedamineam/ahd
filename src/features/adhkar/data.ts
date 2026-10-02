/**
 * Hisn al-Muslim data (src/content/adhkar/adhkar.json, built by data-pipeline/build-adhkar.ts).
 * Text is shown verbatim, without the square brackets the book puts around words from another narration (the
 * reference names it): readers took them for stray characters. Nothing here composes religious text.
 */
import { useEffect, useState } from 'react';
import { addDays, localDate, type PrayerEngine } from '@/features/prayer/engine';
import { ADHAN_PRAYERS } from '@/features/prayer/types';

export interface Dhikr {
  id: string;
  chapter: number;
  text: string;
  count: number;
  reference: string;
  /** the book's English translation (hisnmuslim.com), shown under the Arabic in the English interface */
  en?: string;
}
export interface AdhkarChapter {
  index: number;
  title: string;
  items: Dhikr[];
}
export interface AdhkarCategory {
  id: string;
  en: string;
  chapters: number[];
}
export interface AdhkarData {
  source: { name: string; url: string; license: string; sha256: string };
  english: { name: string; url: string; sha256: string };
  special: { duaAfterAdhan: string };
  categories: AdhkarCategory[];
  chapters: AdhkarChapter[];
}

/** The text as shown: without the book's square brackets (see above). */
export function withoutBrackets(text: string): string {
  return text.replace(/[[\]]/g, '').replace(/ {2,}/g, ' ').trim();
}

let cache: Promise<AdhkarData> | null = null;
export function loadAdhkar(): Promise<AdhkarData> {
  if (!cache)
    cache = import('@/content/adhkar/adhkar.json').then((m) => {
      const d = m.default as unknown as AdhkarData;
      return { ...d, chapters: d.chapters.map((c) => ({ ...c, items: c.items.map((i) => ({ ...i, text: withoutBrackets(i.text) })) })) };
    });
  return cache;
}

export function useAdhkar(): AdhkarData | null {
  const [data, setData] = useState<AdhkarData | null>(null);
  useEffect(() => {
    let alive = true;
    void loadAdhkar().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);
  return data;
}

export function itemsOf(data: AdhkarData, categoryId: string): { chapter: AdhkarChapter; items: Dhikr[] }[] {
  const cat = data.categories.find((c) => c.id === categoryId);
  if (!cat) return [];
  return cat.chapters.map((i) => data.chapters[i]!).map((chapter) => ({ chapter, items: chapter.items }));
}

export function findDhikr(data: AdhkarData, id: string): Dhikr | undefined {
  for (const c of data.chapters) {
    const d = c.items.find((x) => x.id === id);
    if (d) return d;
  }
  return undefined;
}

/** The dua after the adhan (Hisn al-Muslim, adhan chapter), for the adhan toast. */
export function useDuaAfterAdhan(): Dhikr | null {
  const data = useAdhkar();
  return data ? (findDhikr(data, data.special.duaAfterAdhan) ?? null) : null;
}

/**
 * Counter session for a category (brief §15.3): morning restarts at Fajr, evening at Asr, after-salah at each
 * prayer, everything else at midnight.
 */
export function sessionKey(categoryId: string, engine: PrayerEngine | null, now: number): string {
  if (!engine) return `${categoryId}:${new Date(now).toISOString().slice(0, 10)}`;
  const today = localDate(now, engine.zone);
  const day = engine.day(today);
  if (categoryId === 'morning') return `morning:${now >= day.times.fajr ? today : addDays(today, -1)}`;
  if (categoryId === 'evening') return `evening:${now >= day.times.asr ? today : addDays(today, -1)}`;
  if (categoryId === 'after-salah') {
    const passed = ADHAN_PRAYERS.filter((p) => day.times[p] <= now);
    return passed.length ? `after-salah:${today}:${passed[passed.length - 1]}` : `after-salah:${addDays(today, -1)}:isha`;
  }
  return `${categoryId}:${today}`;
}

export function keepDates(engine: PrayerEngine | null, now: number): string[] {
  const today = engine ? localDate(now, engine.zone) : new Date(now).toISOString().slice(0, 10);
  return [today, addDays(today, -1)];
}
