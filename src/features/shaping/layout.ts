/**
 * Right-to-left paragraph layout for shaped text: greedy line breaking at spaces, justification by widening the
 * spaces (as browsers do for Arabic), hard line breaks, and a different size per segment (e.g. the hadith set
 * larger than its introduction). All output is in CSS pixels.
 */
import type { ShapedWord, ShapingFont } from './engine';

export interface LayoutSegment {
  key: string;
  text: string;
  /** size multiplier for this segment (default 1) */
  scale?: number;
}

export interface LayoutOptions {
  /** font size in px */
  size: number;
  /** available width in px */
  width: number;
  /** line height as a multiple of the font size */
  lineHeight: number;
  justify?: boolean;
  /** alignment of lines that are not justified (the last line, or all lines when justify is off) */
  align?: 'start' | 'center';
  lastAlign?: 'start' | 'center';
  /** extra space between words, in em */
  wordSpacing?: number;
  maxLines?: number;
}

export interface LaidWord {
  word: ShapedWord;
  segment: number;
  /** left edge in px */
  x: number;
  /** font size of this word in px */
  size: number;
}

export interface LaidLine {
  words: LaidWord[];
  top: number;
  baseline: number;
  height: number;
}

export interface Layout {
  lines: LaidLine[];
  width: number;
  height: number;
  /** lines were cut by maxLines */
  truncated: boolean;
  /** width of the longest line before justification */
  natural: number;
}

interface Token {
  word: ShapedWord;
  segment: number;
  size: number;
  /** may not start a line (an ayah number stays with the end of its ayah) */
  glue: boolean;
}
type Item = Token | 'break';

const ONLY_DIGITS = /^[٠-٩۰-۹0-9]+$/u;

function tokenize(font: ShapingFont, segments: LayoutSegment[], size: number): Item[] {
  const items: Item[] = [];
  segments.forEach((seg, si) => {
    const px = size * (seg.scale ?? 1);
    const parts = seg.text.replace(/\r\n?/g, '\n').split(/(\n)/);
    for (const part of parts) {
      if (part === '\n') {
        items.push('break');
        continue;
      }
      for (const w of part.split(' ')) {
        if (!w) continue;
        items.push({ word: font.word(w), segment: si, size: px, glue: ONLY_DIGITS.test(w) && items.length > 0 && items[items.length - 1] !== 'break' });
      }
    }
  });
  return items;
}

export function layoutText(font: ShapingFont, segments: LayoutSegment[], o: LayoutOptions): Layout {
  const space = font.spaceWidth();
  const gapOf = (t: Token) => (space + (o.wordSpacing ?? 0)) * t.size;
  const widthOf = (t: Token) => t.word.width * t.size;
  const natural = (ts: Token[]) => ts.reduce((w, t, i) => w + widthOf(t) + (i ? gapOf(ts[i - 1]!) : 0), 0);

  // 1. break into lines
  const rows: { tokens: Token[]; last: boolean }[] = [];
  let cur: Token[] = [];
  const flush = (last: boolean) => {
    rows.push({ tokens: cur, last });
    cur = [];
  };
  for (const it of tokenize(font, segments, o.size)) {
    if (it === 'break') {
      flush(true);
      continue;
    }
    if (cur.length && natural([...cur, it]) > o.width) {
      if (it.glue && cur.length > 1) {
        // move the word before the number to the next line with it
        const prev = cur.pop()!;
        flush(false);
        cur = [prev, it];
      } else if (it.glue) {
        cur.push(it); // a single word plus its number wider than the line: keep them together anyway
      } else {
        flush(false);
        cur = [it];
      }
    } else cur.push(it);
  }
  if (cur.length || !rows.length) flush(true);

  // 2. place words right to left
  const lines: LaidLine[] = [];
  let top = 0;
  let longest = 0;
  for (const row of rows.slice(0, o.maxLines ?? rows.length)) {
    const ts = row.tokens;
    const maxSize = ts.length ? Math.max(...ts.map((t) => t.size)) : o.size;
    const height = maxSize * o.lineHeight;
    const ascent = font.ascent * maxSize;
    const descent = font.descent * maxSize;
    const baseline = top + (height - ascent - descent) / 2 + ascent;
    const w = natural(ts);
    longest = Math.max(longest, w);
    const justify = o.justify && !row.last && ts.length > 1 && w < o.width;
    const extra = justify ? (o.width - w) / (ts.length - 1) : 0;
    const align = row.last ? (o.lastAlign ?? o.align ?? 'start') : (o.align ?? 'start');
    let right = justify || align === 'start' ? o.width : o.width - (o.width - w) / 2;
    const words: LaidWord[] = ts.map((t) => {
      const x = right - widthOf(t);
      right = x - gapOf(t) - extra;
      return { word: t.word, segment: t.segment, x, size: t.size };
    });
    // consecutive left-to-right words (e.g. "100 000") read left to right: mirror them inside their span
    for (let i = 0; i < words.length; i++) {
      let j = i;
      while (j < words.length && words[j]!.word.ltr) j++;
      if (j - i > 1) {
        const gaps = words.slice(i, j - 1).map((w, k) => w.x - (words[i + k + 1]!.x + widthOf(ts[i + k + 1]!)));
        let x = words[j - 1]!.x;
        for (let k = i; k < j; k++) {
          words[k]!.x = x;
          x += widthOf(ts[k]!) + (gaps[k - i] ?? 0);
        }
      }
      i = Math.max(i, j);
    }
    lines.push({ words, top, baseline, height });
    top += height;
  }
  return { lines, width: o.width, height: top, truncated: rows.length > lines.length, natural: longest };
}
