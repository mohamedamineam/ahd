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

type HB = typeof import('harfbuzzjs');

export type ShapingFontId = 'hafs' | 'warsh' | 'amiri' | 'ruqaa';

const FILES: Record<ShapingFontId, string> = {
  hafs: 'quran/fonts/hafs.18.ttf',
  warsh: 'quran/fonts/warsh.10.ttf',
  amiri: 'fonts/Amiri-Regular.ttf',
  ruqaa: 'fonts/ArefRuqaa-Regular.ttf',
};
const FALLBACK: Partial<Record<ShapingFontId, ShapingFontId>> = { hafs: 'amiri', warsh: 'amiri', ruqaa: 'amiri' };

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
      w = shapeWord(this, text);
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
    hb.shape(this.font, buf);
    const infos = buf.getGlyphInfos();
    const pos = buf.getGlyphPositions();
    const glyphs: PlacedGlyph[] = [];
    let pen = 0;
    for (let i = 0; i < infos.length; i++) {
      const p = pos[i]!;
      glyphs.push({ font: this, gid: infos[i]!.codepoint, x: (pen + p.xOffset) / this.upem, y: p.yOffset / this.upem });
      pen += p.xAdvance;
    }
    return { glyphs, width: pen / this.upem };
  }
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

export function shapingFontUrl(id: ShapingFontId): string {
  return `${import.meta.env.BASE_URL}${FILES[id]}`;
}

/** Create a font from raw sfnt data (also used by the tests, which read the files from disk). */
export async function createShapingFont(id: ShapingFontId, data: ArrayBuffer | Uint8Array, fallback: ShapingFont | null): Promise<ShapingFont> {
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
    defs.appendChild(path);
    defined.add(id);
  }
  return `#${id}`;
}
