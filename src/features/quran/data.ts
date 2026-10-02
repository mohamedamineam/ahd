/**
 * Quran data (public/quran/{hafs,warsh}.json, built by data-pipeline/build-quran.ts from KFGQPC).
 * The display text is used exactly as shipped. Search uses the separate normalised key of each ayah.
 */
import { useEffect, useState } from 'react';
import type { Riwaya } from '@/lib/db';

export type { Riwaya };

export interface Surah {
  n: number;
  ar: string;
  en: string;
  ayat: number;
  type: 'meccan' | 'medinan';
  page: number;
  juz: number;
}

/** [surah, ayah, page, juz, text, searchKey] */
export type AyahRow = [number, number, number, number, string, string];

export interface QuranData {
  riwaya: Riwaya;
  source: { name: string; publisher: string; official: string; downloadedFrom: string; sha256: string; terms: string };
  font: string;
  pages: number;
  surahs: Surah[];
  ayat: AyahRow[];
  /** derived: page → index range into ayat */
  pageIndex: [number, number][];
  juzStart: number[]; // juz (1..30) → page
  looseKeys: string[];
}

const cache = new Map<Riwaya, Promise<QuranData>>();

/** Search normalisation for the user's query and the index (alif-insensitive for Uthmani spellings). */
export function looseSearch(s: string): string {
  return s
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
    .replace(/[ٱآأإ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ا/g, '')
    .replace(/[^ء-ي ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const resolved = new Map<Riwaya, QuranData>();

export function loadQuran(riwaya: Riwaya): Promise<QuranData> {
  let p = cache.get(riwaya);
  if (!p) {
    p = fetch(`/quran/${riwaya}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`quran ${riwaya}: ${r.status}`);
        return r.json() as Promise<Omit<QuranData, 'pageIndex' | 'juzStart' | 'looseKeys'>>;
      })
      .then((d) => {
        const pageIndex: [number, number][] = Array.from({ length: d.pages + 1 }, () => [-1, -1] as [number, number]);
        const juzStart: number[] = [];
        d.ayat.forEach((a, i) => {
          const r = pageIndex[a[2]]!;
          if (r[0] < 0) r[0] = i;
          r[1] = i;
          if (!juzStart[a[3]]) juzStart[a[3]] = a[2];
        });
        // Surah names are UI labels: shown without harakat, which the Linux webview misplaces in UI fonts. The ayat
        // themselves are always displayed verbatim (and shaped by src/features/shaping).
        const surahs = d.surahs.map((s) => ({ ...s, ar: s.ar.replace(/[\u064B-\u0652\u0670]/g, '') }));
        const q: QuranData = { ...d, surahs, pageIndex, juzStart, looseKeys: d.ayat.map((a) => looseSearch(a[5])) };
        resolved.set(riwaya, q);
        return q;
      });
    cache.set(riwaya, p);
  }
  return p;
}

export function useQuran(riwaya: Riwaya) {
  const [, setLoaded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const data = resolved.get(riwaya) ?? null;
  useEffect(() => {
    let alive = true;
    loadQuran(riwaya)
      .then(() => alive && setLoaded((n) => n + 1))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [riwaya]);
  return { data, error };
}

export function ayatOfPage(d: QuranData, page: number): AyahRow[] {
  const r = d.pageIndex[page];
  if (!r || r[0] < 0) return [];
  return d.ayat.slice(r[0], r[1] + 1);
}

export function pageOf(d: QuranData, surah: number, ayah: number): number {
  const row = d.ayat.find((a) => a[0] === surah && a[1] === ayah);
  return row ? row[2] : (d.surahs[surah - 1]?.page ?? 1);
}

export interface SearchHit {
  surah: number;
  ayah: number;
  page: number;
  text: string;
}

export function searchQuran(d: QuranData, query: string, limit = 200): SearchHit[] {
  const q = looseSearch(query);
  if (q.length < 2) return [];
  const out: SearchHit[] = [];
  for (let i = 0; i < d.ayat.length && out.length < limit; i++) {
    if (d.looseKeys[i]!.includes(q)) {
      const a = d.ayat[i]!;
      out.push({ surah: a[0], ayah: a[1], page: a[2], text: a[4] });
    }
  }
  return out;
}

/** The English translation (public/quran/en.json, built by data-pipeline/build-quran-translation.ts). */
export interface QuranTranslation {
  id: string;
  lang: string;
  source: { name: string; downloadedFrom: string; sha256: string; terms: string };
  /** one per ayah, in the order of the Hafs text (index i translates hafs.ayat[i]) */
  ayat: string[];
}

let translation: Promise<QuranTranslation> | null = null;
let translationLoaded: QuranTranslation | null = null;

export function loadTranslation(): Promise<QuranTranslation> {
  translation ??= fetch('/quran/en.json')
    .then((r) => {
      if (!r.ok) throw new Error(`translation: ${r.status}`);
      return r.json() as Promise<QuranTranslation>;
    })
    .then((t) => (translationLoaded = t));
  return translation;
}

/** The translation, loaded once it is needed (`enabled`). */
export function useQuranTranslation(enabled: boolean) {
  const [, setLoaded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || translationLoaded) return;
    let alive = true;
    loadTranslation()
      .then(() => alive && setLoaded((n) => n + 1))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return { translation: enabled ? translationLoaded : null, error };
}

/** Search in the translation of the Hafs text `d` (case-insensitive). */
export function searchTranslation(d: QuranData, tr: QuranTranslation, query: string, limit = 200): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const out: SearchHit[] = [];
  for (let i = 0; i < tr.ayat.length && out.length < limit; i++) {
    if (tr.ayat[i]!.toLowerCase().includes(q)) {
      const a = d.ayat[i]!;
      out.push({ surah: a[0], ayah: a[1], page: a[2], text: tr.ayat[i]! });
    }
  }
  return out;
}

/**
 * Hafs ↔ Warsh: verse numbers differ between the Kufi and Madani counts, so the position is mapped by page
 * within the same surah (both editions follow the Madinah mushaf pagination). If the surah is not on that page
 * in the other riwaya, go to the start of the surah and report it.
 */
export function mapPosition(to: QuranData, surah: number, page: number): { page: number; exact: boolean } {
  const onPage = ayatOfPage(to, page).some((a) => a[0] === surah);
  if (onPage) return { page, exact: true };
  return { page: to.surahs[surah - 1]?.page ?? 1, exact: false };
}
