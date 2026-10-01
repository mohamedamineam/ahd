/**
 * Arabic text shaped with HarfBuzz (WebAssembly) and drawn as SVG glyphs.
 *
 * Why: WebKitGTK 2.52 (the Linux webview) drops the vertical part of GPOS glyph offsets, so harakat, Quranic
 * annotation marks and the dots of fonts that position them as marks are drawn on the baseline, hidden inside the
 * letters (docs/LINUX_DESKTOPS.md). Religious text must never be displayed wrongly, so the Quran, adhkar, duas and
 * the covenant hadith are shaped here — the same shaping engine Chromium uses — on every platform.
 *
 * Words are shaped one at a time (Arabic never joins across a space) and cached per font. Inside a word, runs of
 * digits are shaped left-to-right as the Unicode bidi algorithm does for numbers in right-to-left text, and
 * characters missing from the font fall back to Amiri.
 */
import type { Font as HbFont } from 'harfbuzzjs';
import { easternWarsh } from '@/features/quran/warshEastern';

type HB = typeof import('harfbuzzjs');

/** 'warsh-eastern': the Warsh text in Eastern writing, set in the Hafs font (see easternWarshFont). */
export type ShapingFontId = 'hafs' | 'warsh' | 'warsh-eastern' | 'amiri' | 'ruqaa';
type FileFontId = Exclude<ShapingFontId, 'warsh-eastern'>;

const FILES: Record<FileFontId, string> = {
  hafs: 'quran/fonts/hafs.18.ttf',
  warsh: 'quran/fonts/warsh.10.ttf',
  amiri: 'fonts/Amiri-Regular.ttf',
  ruqaa: 'fonts/ArefRuqaa-Regular.ttf',
};
const FALLBACK: Partial<Record<FileFontId, FileFontId>> = { hafs: 'amiri', warsh: 'amiri', ruqaa: 'amiri' };

/** A font used as another: words are rewritten before shaping, and some marks are drawn from a second font. */
export interface ShapingOptions {
  display?: (word: string) => string;
  marksFrom?: {
    font: ShapingFont;
    /** marks this font places well but draws as another sign: the other font's glyph goes in their place */
    replace: ReadonlySet<number>;
    /**
     * marks this font cannot draw (the other font draws them together with their letter): the letter that carries one
     * is drawn whole, with all its marks, from the other font. Only for letters that join neither neighbour.
     */
    letters: ReadonlySet<number>;
  };
}

/** A glyph placed inside a word, in em units (y up). */
export interface PlacedGlyph {
  font: ShapingFont;
  gid: number;
  x: number;
  y: number;
}

export interface ShapedWord {
  glyphs: PlacedGlyph[];
  /** advance width in em */
  width: number;
  /** the whole word is left-to-right (a number or a Latin word) */
  ltr: boolean;
}

export class ShapingFont {
  private readonly words = new Map<string, ShapedWord>();
  private readonly coverage = new Map<number, boolean>();
  private space: number | null = null;

  constructor(
    readonly id: ShapingFontId,
    readonly hb: HB,
    readonly font: HbFont,
    readonly upem: number,
    /** ascender / descender in em (both positive) */
    readonly ascent: number,
    readonly descent: number,
    readonly fallback: ShapingFont | null,
    readonly options: ShapingOptions = {},
  ) {}

  covers(cp: number): boolean {
    let c = this.coverage.get(cp);
    if (c === undefined) {
      c = this.font.nominalGlyph(cp) !== undefined;
      this.coverage.set(cp, c);
    }
    return c;
  }

  /** Width of U+0020 in em. */
  spaceWidth(): number {
    this.space ??= this.shape(' ', 'R').width;
    return this.space;
  }

  word(text: string): ShapedWord {
    let w = this.words.get(text);
    if (!w) {
      w = shapeWord(this, this.options.display ? this.options.display(text) : text);
      this.words.set(text, w);
    }
    return w;
  }

  /** Shape one directional run with this font; glyphs come back in visual (left-to-right) order. */
  shape(text: string, dir: 'L' | 'R'): { glyphs: PlacedGlyph[]; width: number } {
    const { hb } = this;
    const buf = new hb.Buffer();
    buf.addText(text);
    buf.guessSegmentProperties();
    buf.setDirection(dir === 'L' ? hb.Direction.LTR : hb.Direction.RTL);
    buf.setLanguage('ar');
    const marks = this.options.marksFrom;
    // each glyph keeps the index of its own character (marks are not merged into their letter's cluster)
    if (marks) buf.setClusterLevel(hb.ClusterLevel.CHARACTERS);
    hb.shape(this.font, buf);
    const infos = buf.getGlyphInfos();
    const pos = buf.getGlyphPositions();
    let glyphs: PlacedGlyph[] = [];
    const pens: number[] = [];
    let pen = 0;
    for (let i = 0; i < infos.length; i++) {
      const p = pos[i]!;
      pens.push(pen / this.upem);
      glyphs.push({ font: this, gid: infos[i]!.codepoint, x: (pen + p.xOffset) / this.upem, y: p.yOffset / this.upem });
      pen += p.xAdvance;
    }
    let width = pen / this.upem;
    if (marks) {
      const clusters = infos.map((info) => info.cluster);
      for (let i = 0; i < glyphs.length; i++) {
        if (marks.replace.has(text.codePointAt(clusters[i]!)!)) glyphs[i] = this.markFrom(marks.font, text.codePointAt(clusters[i]!)!, glyphs[i]!);
      }
      for (let c = 0; c < text.length; c++) {
        if (!marks.letters.has(text.codePointAt(c)!)) continue;
        let start = c;
        while (start > 0 && MARK.test(text[start]!)) start--;
        let end = c;
        while (end + 1 < text.length && MARK.test(text[end + 1]!)) end++;
        ({ glyphs, width } = this.letterFrom(marks.font, text.slice(start, end + 1), start, end, clusters, glyphs, pens, width));
        break; // one such letter per run is all the text has
      }
    }
    return { glyphs, width };
  }

  /**
   * Draw one letter with its marks (text[start..end]) from the other font instead of this one: its glyphs are
   * replaced, and the glyphs to its left move by the difference in width.
   */
  private letterFrom(other: ShapingFont, part: string, start: number, end: number, clusters: number[], glyphs: PlacedGlyph[], pens: number[], width: number) {
    const mine = glyphs.map((_, i) => i).filter((i) => clusters[i]! >= start && clusters[i]! <= end);
    if (!mine.length) return { glyphs, width };
    const theirs = other.shape(part, 'R');
    // the letter's place: from the leftmost pen position of its glyphs, as wide as their advances
    const left = Math.min(...mine.map((i) => pens[i]!));
    const right = Math.max(...mine.map((i) => (i + 1 < pens.length ? pens[i + 1]! : width)));
    const delta = theirs.width - (right - left);
    const out: PlacedGlyph[] = [];
    glyphs.forEach((g, i) => {
      if (mine.includes(i)) return;
      // glyphs are in visual order: those right of the letter move with it
      out.push(pens[i]! >= right ? { ...g, x: g.x + delta } : g);
    });
    for (const g of theirs.glyphs) out.push({ ...g, x: g.x + left });
    out.sort((a, b) => a.x - b.x);
    return { glyphs: out, width: width + delta };
  }



  /** The other font's glyph for a mark, centred where this font put its own and resting at the same height. */
  private markFrom(other: ShapingFont, cp: number, g: PlacedGlyph): PlacedGlyph {
    const gid = other.font.nominalGlyph(cp);
    const a = this.font.glyphExtents(g.gid);
    const b = gid === undefined ? undefined : other.font.glyphExtents(gid);
    if (gid === undefined || !a || !b) return g;
    // extents are in font units, y up; height is negative (top = yBearing, bottom = yBearing + height)
    const dx = (a.xBearing + a.width / 2) / this.upem - (b.xBearing + b.width / 2) / other.upem;
    const dy = (a.yBearing + a.height) / this.upem - (b.yBearing + b.height) / other.upem;
    return { font: other, gid, x: g.x + dx, y: g.y + dy };
  }
}

/**
 * Warsh in Eastern writing: the Warsh text, rewritten to its Eastern form (src/features/quran/warshEastern.ts), set in
 * the Hafs font. Two signs are drawn from the Warsh font, so they keep the meaning they have in the Warsh mushaf: the
 * pause sign U+06D6 (the Hafs font draws that character as its own صلى, a different sign), and U+06DF where it is
 * not the wasl dot, with its letter (the Hafs font cannot place it): 134 places in the whole Quran.
 */
export function easternWarshFont(hafs: ShapingFont, warsh: ShapingFont): ShapingFont {
  return new ShapingFont('warsh-eastern', hafs.hb, hafs.font, hafs.upem, hafs.ascent, hafs.descent, hafs.fallback, {
    display: easternWarsh,
    // U+06D6: the Warsh pause sign (the Hafs font draws its صلى). U+06DF where it is not the wasl dot (naql, the eased
    // second hamza): the Hafs font cannot place it and the Warsh font draws it with its letter (an alif or waw that joins
    // neither neighbour), so that letter is drawn as in the Warsh mushaf
    marksFrom: { font: warsh, replace: new Set([0x06d6]), letters: new Set([0x06df]) },
  });
}

const isDigit = (cp: number) => (cp >= 0x30 && cp <= 0x39) || (cp >= 0x660 && cp <= 0x669) || (cp >= 0x6f0 && cp <= 0x6f9);
const isLatin = (cp: number) => (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a);
/** separators that stay inside a number: 11/113, 1.5, 1,000, 10:30, ٣٫٥ */
const NUMBER_SEPARATORS = new Set([0x2f, 0x2e, 0x2c, 0x3a, 0x66b, 0x66c]);
const MARK = /\p{M}/u;
const JOINER = new Set([0x200c, 0x200d]);

interface Run {
  dir: 'L' | 'R';
  font: ShapingFont;
  text: string;
}

/** Split a word into runs of one direction and one font, in logical order. */
export function splitRuns(primary: ShapingFont, text: string): Run[] {
  const cps = Array.from(text, (c) => c.codePointAt(0)!);
  const dirs: ('L' | 'R')[] = cps.map((cp) => (isDigit(cp) || isLatin(cp) ? 'L' : 'R'));
  for (let i = 1; i < cps.length - 1; i++) {
    if (NUMBER_SEPARATORS.has(cps[i]!) && isDigit(cps[i - 1]!) && isDigit(cps[i + 1]!)) dirs[i] = 'L';
  }
  const runs: Run[] = [];
  let prevFont: ShapingFont = primary;
  cps.forEach((cp, i) => {
    const ch = String.fromCodePoint(cp);
    const follows = i > 0 && (MARK.test(ch) || JOINER.has(cp));
    let font = prevFont;
    let dir = dirs[i]!;
    if (follows) dir = runs[runs.length - 1]!.dir;
    else font = !primary.covers(cp) && primary.fallback?.covers(cp) ? primary.fallback : primary;
    prevFont = font;
    const last = runs[runs.length - 1];
    if (last && last.dir === dir && last.font === font) last.text += ch;
    else runs.push({ dir, font, text: ch });
  });
  return runs;
}

function shapeWord(primary: ShapingFont, text: string): ShapedWord {
  const runs = splitRuns(primary, text);
  // base direction is right-to-left: runs are laid out from the right; a group of consecutive left-to-right runs
  // keeps its own order (a number followed by its separator and more digits reads left-to-right)
  const groups: Run[][] = [];
  for (const r of runs) {
    const g = groups[groups.length - 1];
    if (g && g[0]!.dir === 'L' && r.dir === 'L') g.push(r);
    else groups.push([r]);
  }
  const visual = groups.reverse().flat();
  const glyphs: PlacedGlyph[] = [];
  let x = 0;
  for (const r of visual) {
    const s = r.font.shape(r.text, r.dir);
    for (const g of s.glyphs) glyphs.push({ ...g, x: g.x + x });
    x += s.width;
  }
  return { glyphs, width: x, ltr: runs.every((r) => r.dir === 'L') };
}

let hbModule: Promise<HB> | null = null;
const loadHarfBuzz = () => (hbModule ??= import('harfbuzzjs'));

const pending = new Map<ShapingFontId, Promise<ShapingFont>>();
const ready = new Map<ShapingFontId, ShapingFont>();

export function shapingFontUrl(id: FileFontId): string {
  return `${import.meta.env.BASE_URL}${FILES[id]}`;
}

/** Create a font from raw sfnt data (also used by the tests, which read the files from disk). */
export async function createShapingFont(id: FileFontId, data: ArrayBuffer | Uint8Array, fallback: ShapingFont | null): Promise<ShapingFont> {
  const hb = await loadHarfBuzz();
  const face = new hb.Face(new hb.Blob(data));
  const font = new hb.Font(face);
  const e = font.hExtents();
  return new ShapingFont(id, hb, font, face.upem, e.ascender / face.upem, -e.descender / face.upem, fallback);
}

export function loadShapingFont(id: ShapingFontId): Promise<ShapingFont> {
  let p = pending.get(id);
  if (!p) {
    p = (async () => {
      if (id === 'warsh-eastern') {
        const [hafs, warsh] = await Promise.all([loadShapingFont('hafs'), loadShapingFont('warsh')]);
        const f = easternWarshFont(hafs, warsh);
        ready.set(id, f);
        return f;
      }
      const fb = FALLBACK[id];
      const [fallback, data] = await Promise.all([
        fb ? loadShapingFont(fb) : null,
        fetch(shapingFontUrl(id)).then((r) => {
          if (!r.ok) throw new Error(`font ${id}: HTTP ${r.status}`);
          return r.arrayBuffer();
        }),
      ]);
      const f = await createShapingFont(id, data, fallback);
      ready.set(id, f);
      return f;
    })();
    pending.set(id, p);
    p.catch(() => pending.delete(id));
  }
  return p;
}

/** The font if it has already been loaded (lets remounted components render without a blank frame). */
export function loadedShapingFont(id: ShapingFontId): ShapingFont | null {
  return ready.get(id) ?? null;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
let defs: SVGDefsElement | null = null;
const defined = new Set<string>();

/**
 * One <path> per glyph in a hidden sprite, scaled to 1 em; text refers to it with <use>. Each window has its own
 * document, so each has its own sprite.
 */
export function glyphHref(g: PlacedGlyph): string {
  const id = `ahd-g-${g.font.id}-${g.gid}`;
  if (!defined.has(id)) {
    if (!defs) {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
      defs = document.createElementNS(SVG_NS, 'defs');
      svg.appendChild(defs);
      document.body.appendChild(svg);
    }
    const path = document.createElementNS(SVG_NS, 'path');
    path.id = id;
    path.setAttribute('d', g.font.font.glyphToPath(g.gid));
    path.setAttribute('transform', `scale(${1 / g.font.upem})`);
    // the outline drawn around each glyph (ShapedText) keeps the same width on screen at any text size
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    defs.appendChild(path);
    defined.add(id);
  }
  return `#${id}`;
}
