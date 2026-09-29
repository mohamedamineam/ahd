// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createShapingFont, splitRuns, type ShapingFont } from './engine';
import { layoutText } from './layout';
import adhkar from '@/content/adhkar/adhkar.json';
import { AHD_HADITH } from '@/content/ahdHadith';

const root = join(import.meta.dirname, '../../..');
const file = (p: string) => new Uint8Array(readFileSync(join(root, 'public', p)));
let amiri: ShapingFont, hafs: ShapingFont, warsh: ShapingFont, ruqaa: ShapingFont;

beforeAll(async () => {
  amiri = await createShapingFont('amiri', file('fonts/Amiri-Regular.ttf'), null);
  hafs = await createShapingFont('hafs', file('quran/fonts/hafs.18.ttf'), amiri);
  warsh = await createShapingFont('warsh', file('quran/fonts/warsh.10.ttf'), amiri);
  ruqaa = await createShapingFont('ruqaa', file('fonts/ArefRuqaa-Regular.ttf'), amiri);
});

type Row = [number, number, number, number, string, string];
const quran = (r: string) => (JSON.parse(readFileSync(join(root, `public/quran/${r}.json`), 'utf8')) as { ayat: Row[] }).ayat;
const missing = (f: ShapingFont, texts: string[]) => {
  const bad = new Set<string>();
  for (const t of texts) for (const w of t.split(/\s+/)) if (w && f.word(w).glyphs.some((g) => g.gid === 0)) bad.add(w);
  return [...bad];
};

describe('shaping', () => {
  it('keeps the vertical offsets of marks (the reason this module exists)', () => {
    const w = hafs.word('رَبِّ');
    expect(w.glyphs.length).toBeGreaterThan(2);
    expect(w.glyphs.some((g) => g.y > 0.2)).toBe(true);
  });

  it('shapes numbers left to right inside right-to-left text', () => {
    expect(splitRuns(amiri, '(190)').map((r) => [r.dir, r.text])).toEqual([
      ['R', '('],
      ['L', '190'],
      ['R', ')'],
    ]);
    expect(splitRuns(amiri, '11/113').map((r) => r.dir)).toEqual(['L']);
    const digits = amiri.word('(190)').glyphs.map((g) => g.gid);
    const one = amiri.font.nominalGlyph(0x31)!;
    const nine = amiri.font.nominalGlyph(0x39)!;
    expect(digits.indexOf(one)).toBeLessThan(digits.indexOf(nine));
  });

  it('keeps diacritics with their letter and falls back to Amiri only for missing characters', () => {
    const runs = splitRuns(ruqaa, '«العهدُ');
    expect(runs.map((r) => r.text).join('')).toBe('«العهدُ');
    expect(runs.every((r) => r.font === ruqaa || !ruqaa.covers(r.text.codePointAt(0)!))).toBe(true);
  });

  it('lays out justified right-to-left lines within the width', () => {
    const text = quran('hafs')
      .filter((a) => a[0] === 2 && a[1] <= 5)
      .map((a) => a[4])
      .join(' ');
    const l = layoutText(hafs, [{ key: 'p', text }], { size: 24, width: 420, lineHeight: 2, justify: true, lastAlign: 'center' });
    expect(l.lines.length).toBeGreaterThan(3);
    for (const line of l.lines.slice(0, -1)) {
      const first = line.words[0]!;
      const last = line.words[line.words.length - 1]!;
      expect(first.x + first.word.width * first.size).toBeCloseTo(420, 3); // first word at the right edge
      expect(last.x).toBeCloseTo(0, 3); // justified to the left edge
    }
    expect(l.height).toBeCloseTo(l.lines.length * 48, 5);
  });

  it('never starts a line with an ayah number', () => {
    const text = quran('hafs')
      .filter((a) => a[0] === 2 && a[1] <= 20)
      .map((a) => a[4])
      .join(' ');
    for (const width of [300, 360, 420, 500]) {
      const l = layoutText(hafs, [{ key: 'p', text }], { size: 24, width, lineHeight: 2, justify: true });
      for (const line of l.lines) expect(/^[٠-٩]+$/.test(line.words[0]!.word.glyphs.length ? '' : 'x')).toBe(false);
      const firstWords = l.lines.map((line) => line.words[0]!.word);
      expect(firstWords.every((w) => !w.ltr)).toBe(true);
    }
  });

  it('has a glyph for every word of both riwayat, the adhkar and the hadith', () => {
    expect(missing(hafs, quran('hafs').map((a) => a[4]))).toEqual([]);
    expect(missing(warsh, quran('warsh').map((a) => a[4]))).toEqual([]);
    const dhikr = (adhkar as { chapters: { items: { text: string }[] }[] }).chapters.flatMap((c) => c.items.map((i) => i.text));
    expect(missing(amiri, dhikr)).toEqual([]);
    expect(missing(ruqaa, [AHD_HADITH.intro, `«${AHD_HADITH.text}»`, AHD_HADITH.reference])).toEqual([]);
  }, 60_000);
});
