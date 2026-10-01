// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createShapingFont, easternWarshFont, type ShapingFont } from '@/features/shaping/engine';
import { easternWarsh } from './warshEastern';

const root = join(import.meta.dirname, '../../..');
const file = (p: string) => new Uint8Array(readFileSync(join(root, 'public', p)));
type Row = [number, number, number, number, string, string];
const ayat = (JSON.parse(readFileSync(join(root, 'public/quran/warsh.json'), 'utf8')) as { ayat: Row[] }).ayat;
const words = ayat.flatMap((a) => a[4].split(/[ \u00A0]+/).filter(Boolean));
/** the word of an ayah that starts with, or contains, the given characters */
const wordOf = (surah: number, ayah: number, part: string) =>
  ayat
    .find((a) => a[0] === surah && a[1] === ayah)![4]
    .split(/[ \u00A0]+/)
    .find((w) => w.includes(part))!;

const YEH_BARREE = '\u06D2';
/** hamzat al-wasl as this text writes it: alif, its starting vowel, then the dot (see warshEastern.ts) */
const WASL = /^([\u0648\u0641]\u064E)?\u0627[\u064E\u064F\u0650][\u06EC\u06EA\u06DF]/;

describe('Warsh in Eastern writing: the text', () => {
  it('writes hamzat al-wasl as ٱ, without the starting vowel and the Maghrebi dot', () => {
    expect(easternWarsh(wordOf(1, 1, '\u06EC'))).toBe('\u0671\u0644\u0652\u062D\u064E\u0645\u0652\u062F\u064F'); // ٱلْحَمْدُ
    expect(easternWarsh(wordOf(1, 5, '\u06EA')).startsWith('\u0671\u0647')).toBe(true); // ٱهْدِنَا
    expect(easternWarsh(wordOf(2, 20, '\u06DF')).startsWith('\u0671\u0639')).toBe(true); // ٱعْبُدُواْ
    // after the prefix wa
    const wa = words.find((w) => /^\u0648\u064E\u0627[\u064E\u064F\u0650][\u06EC\u06EA\u06DF]/.test(w))!;
    expect(easternWarsh(wa).startsWith('\u0648\u064E\u0671')).toBe(true);
  });

  it('writes the dotless final ya as \u064A, and as \u0626 under a hamza', () => {
    expect(easternWarsh(wordOf(2, 10, YEH_BARREE))).toBe('\u0641\u0650\u064A'); // فِي
    expect(easternWarsh(wordOf(2, 14, '\u06D2\u0654'))).toContain('\u0626');
  });

  it('leaves tashil, naql and everything else as written', () => {
    // the dot before the vowel: tashil of a hamza of qat after a word ending in hamza (2:13 al-sufahau ala)
    const tashil = wordOf(2, 12, '\u0627\u06EC\u064E');
    expect(easternWarsh(tashil)).toBe(tashil);
    // U+06DF on an alif without a vowel: a hamza of qat dropped by naql (2:160 ulaika)
    const naql = wordOf(2, 160, '\u0627\u06DF');
    expect(easternWarsh(naql)).toBe(naql);
    // the dot on an alif after a hamza: tashil
    const afterHamza = words.find((w) => /^\u0621\u064E\u0627/.test(w) && w.includes('\u06EC'))!;
    expect(easternWarsh(afterHamza)).toBe(afterHamza);
    // naql with no mark at all (ila), and every word with neither form: unchanged
    expect(easternWarsh('\u0627\u0650\u0644\u064E\u0649\u0670')).toBe('\u0627\u0650\u0644\u064E\u0649\u0670');
    for (const w of words) if (!w.includes(YEH_BARREE) && !WASL.test(w)) expect(easternWarsh(w)).toBe(w);
  });

  it('leaves no dotless ya and no Maghrebi hamzat al-wasl anywhere in the Warsh text', () => {
    const all = words.map(easternWarsh);
    expect(all.filter((w) => w.includes(YEH_BARREE))).toEqual([]);
    expect(all.filter((w) => WASL.test(w))).toEqual([]);
    const converted = all.filter((w) => /^([\u0648\u0641]\u064E)?\u0671/.test(w)).length;
    expect(converted).toBe(words.filter((w) => WASL.test(w)).length);
    expect(converted).toBeGreaterThan(10_000);
  });
});

describe('Warsh in Eastern writing: drawing', () => {
  let hafs: ShapingFont, warsh: ShapingFont, eastern: ShapingFont;
  beforeAll(async () => {
    const amiri = await createShapingFont('amiri', file('fonts/Amiri-Regular.ttf'), null);
    hafs = await createShapingFont('hafs', file('quran/fonts/hafs.18.ttf'), amiri);
    warsh = await createShapingFont('warsh', file('quran/fonts/warsh.10.ttf'), amiri);
    eastern = easternWarshFont(hafs, warsh);
  });

  it('draws every word of the Warsh text with no missing glyph and no mark the Hafs font cannot place', () => {
    // the Hafs font leaves U+06DF on the baseline (it never uses it): none may be drawn from it
    const unplaced = hafs.font.nominalGlyph(0x06df);
    const bad = [...new Set(words)].filter((w) => eastern.word(w).glyphs.some((g) => g.gid === 0 || (g.font === eastern && g.gid === unplaced)));
    expect(bad).toEqual([]);
  });

  it('draws the letter carrying U+06DF that is not a wasl dot (naql, eased second hamza) as in the Warsh mushaf', () => {
    const marked = [...new Set(words.map(easternWarsh))].filter((w) => w.includes('\u06DF'));
    expect(marked.length).toBeGreaterThan(60); // 134 places, 72 distinct words
    for (const w of marked) {
      const glyphs = eastern.word(w).glyphs;
      const fromWarsh = glyphs.filter((g) => g.font === warsh);
      expect(fromWarsh.length, w).toBeGreaterThan(0);
      // the word keeps a sensible width and every glyph stays inside it
      const width = eastern.word(w).width;
      expect(width, w).toBeGreaterThan(0.3);
      for (const g of glyphs) {
        expect(g.x, w).toBeGreaterThan(-0.4);
        expect(g.x, w).toBeLessThan(width + 0.4);
      }
    }
  });

  it('draws the Warsh pause sign (U+06D6) from the Warsh font, not as the Hafs sala', () => {
    const pause = warsh.font.nominalGlyph(0x06d6);
    const glyphs = eastern.word(wordOf(1, 3, '\u06D6')).glyphs;
    expect(glyphs.filter((g) => g.font === warsh)).toHaveLength(1);
    expect(glyphs.find((g) => g.font === warsh)!.gid).toBe(pause);
    // everything else comes from the Hafs font
    expect(eastern.word(wordOf(2, 10, YEH_BARREE)).glyphs.every((g) => g.font === eastern)).toBe(true);
  });

  it('uses the Eastern letters: the final nun of al-din with its dot, as in the Hafs font', () => {
    const din = wordOf(1, 3, '\u06D6').replace('\u06D6', '');
    const gids = (f: ShapingFont, w: string) => f.word(w).glyphs.map((g) => g.gid).join(',');
    expect(gids(eastern, din)).toBe(gids(hafs, easternWarsh(din)));
  });
});
