// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { QuranTranslation } from './data';

const root = join(import.meta.dirname, '../../..');
const json = <T>(p: string) => JSON.parse(readFileSync(join(root, 'public/quran', p), 'utf8')) as T;
const hafs = json<{ ayat: [number, number, number][]; surahs: { n: number; ayat: number }[] }>('hafs.json');
const en = json<QuranTranslation>('en.json');
const of = (surah: number, ayah: number) =>
  en.ayat[hafs.ayat.findIndex((a) => a[0] === surah && a[1] === ayah)]!;

describe('English translation of the Quran', () => {
  it('has one translation per ayah of the Hafs text, in its order', () => {
    expect(en.ayat).toHaveLength(hafs.ayat.length);
    expect(en.ayat.every((t) => t.trim().length > 0)).toBe(true);
    // surah lengths: the ayat of each surah line up
    let i = 0;
    for (const s of hafs.surahs) {
      expect(hafs.ayat[i]!.slice(0, 2)).toEqual([s.n, 1]);
      i += s.ayat;
    }
  });

  it('puts each translation on its ayah', () => {
    expect(of(1, 1)).toBe('In the name of Allah, the Entirely Merciful, the Especially Merciful.');
    expect(of(2, 255)).toMatch(/^Allah - there is no deity except Him, the Ever-Living/);
    expect(of(112, 1)).toBe('Say, "He is Allah, [who is] One,');
    expect(of(114, 6)).toBe('From among the jinn and mankind."');
  });

  it('names its source', () => {
    expect(en.source.name).toBe('Saheeh International');
    expect(en.source.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
