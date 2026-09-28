/**
 * Palettes in OKLCH. Every role keeps the lightness of the design brief's "Sage & Linen" tokens, so
 * contrast stays within WCAG AA for every preset and for custom hues; chroma is clamped (≤ 0.06 for
 * user-chosen primary/accent) so the UI always stays low-saturation.
 */

export type ThemeMode = 'light' | 'dark';
export type PaletteId = 'sage-linen' | 'olive-parchment' | 'mint-stone' | 'slate-sand' | 'cedar-wheat' | 'custom';

export const PALETTE_IDS: PaletteId[] = ['sage-linen', 'olive-parchment', 'mint-stone', 'slate-sand', 'cedar-wheat', 'custom'];

export interface PaletteSpec {
  /** hue of the primary family (sage) */
  primaryHue: number;
  /** hue of the warm neutral / accent family (linen, sand) */
  accentHue: number;
  /** 0..1 multiplier applied to the default chroma of each role (custom palettes) */
  chromaScale?: number;
}

export const PRESETS: Record<Exclude<PaletteId, 'custom'>, PaletteSpec> = {
  'sage-linen': { primaryHue: 150, accentHue: 88 },
  'olive-parchment': { primaryHue: 118, accentHue: 84 },
  'mint-stone': { primaryHue: 172, accentHue: 95, chromaScale: 0.85 },
  'slate-sand': { primaryHue: 238, accentHue: 80 },
  'cedar-wheat': { primaryHue: 48, accentHue: 86 },
};

type Family = 'p' | 'a' | 'fixed';
interface Role {
  l: number;
  c: number;
  family: Family;
  h?: number; // fixed hue (semantic colours)
}

// Lightness/chroma measured from the brief's hex values (see docs/DESIGN_PLAN.md).
const LIGHT: Record<string, Role> = {
  bg: { l: 0.929, c: 0.0169, family: 'a' },
  surface: { l: 0.961, c: 0.0111, family: 'a' },
  'surface-raised': { l: 0.978, c: 0.007, family: 'a' },
  'surface-sunk': { l: 0.895, c: 0.0241, family: 'a' },
  line: { l: 0.844, c: 0.0289, family: 'a' },
  'line-soft': { l: 0.885, c: 0.022, family: 'a' },
  ink: { l: 0.298, c: 0.0174, family: 'p' },
  'ink-muted': { l: 0.5, c: 0.0167, family: 'p' },
  'ink-faint': { l: 0.62, c: 0.014, family: 'p' },
  sage: { l: 0.606, c: 0.0452, family: 'p' },
  'sage-strong': { l: 0.488, c: 0.0424, family: 'p' },
  'sage-soft': { l: 0.907, c: 0.0165, family: 'p' },
  sand: { l: 0.734, c: 0.0571, family: 'a' },
  'sand-soft': { l: 0.9, c: 0.03, family: 'a' },
  'focus-ring': { l: 0.606, c: 0.0452, family: 'p' },
  'on-sage': { l: 0.97, c: 0.008, family: 'a' },
};

const DARK: Record<string, Role> = {
  bg: { l: 0.206, c: 0.012, family: 'p' },
  surface: { l: 0.242, c: 0.0149, family: 'p' },
  'surface-raised': { l: 0.27, c: 0.016, family: 'p' },
  'surface-sunk': { l: 0.185, c: 0.0099, family: 'p' },
  line: { l: 0.321, c: 0.0172, family: 'p' },
  'line-soft': { l: 0.285, c: 0.016, family: 'p' },
  ink: { l: 0.91, c: 0.0183, family: 'a' },
  'ink-muted': { l: 0.719, c: 0.0169, family: 'p' },
  'ink-faint': { l: 0.6, c: 0.015, family: 'p' },
  sage: { l: 0.708, c: 0.0436, family: 'p' },
  'sage-strong': { l: 0.814, c: 0.0313, family: 'p' },
  'sage-soft': { l: 0.294, c: 0.0218, family: 'p' },
  sand: { l: 0.796, c: 0.0518, family: 'a' },
  'sand-soft': { l: 0.285, c: 0.02, family: 'a' },
  'focus-ring': { l: 0.708, c: 0.0436, family: 'p' },
  'on-sage': { l: 0.2, c: 0.012, family: 'p' },
};

// ---------------------------------------------------------------- OKLCH → sRGB

function oklabToLinearSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb: number[]) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

function linToSrgb8(v: number): number {
  const c = Math.min(1, Math.max(0, v));
  const s = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(s * 255);
}

/** OKLCH → #rrggbb, reducing chroma until the colour fits in sRGB. */
export function oklchToHex(l: number, c: number, h: number): string {
  let chroma = c;
  let rgb = oklabToLinearSrgb(l, chroma * Math.cos((h * Math.PI) / 180), chroma * Math.sin((h * Math.PI) / 180));
  for (let i = 0; i < 24 && !inGamut(rgb); i++) {
    chroma *= 0.9;
    rgb = oklabToLinearSrgb(l, chroma * Math.cos((h * Math.PI) / 180), chroma * Math.sin((h * Math.PI) / 180));
  }
  return '#' + rgb.map((v) => linToSrgb8(v).toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------- contrast (WCAG 2.x)

function relLuminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

export function contrast(a: string, b: string): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ---------------------------------------------------------------- palette generation

export const CUSTOM_MAX_CHROMA = 0.06;

export function generateTokens(spec: PaletteSpec, mode: ThemeMode): Record<string, string> {
  const roles = mode === 'light' ? LIGHT : DARK;
  const scale = spec.chromaScale ?? 1;
  const out: Record<string, string> = {};
  for (const [name, r] of Object.entries(roles)) {
    const hue = r.family === 'p' ? spec.primaryHue : r.family === 'a' ? spec.accentHue : (r.h ?? 0);
    const chroma = Math.min(r.c * scale, CUSTOM_MAX_CHROMA);
    out[name] = oklchToHex(r.l, chroma, hue);
  }
  return out;
}

/** Exact brief values for the default palette (kept verbatim; generation is only for other palettes). */
const SAGE_LINEN_EXACT: Record<ThemeMode, Record<string, string>> = {
  light: {
    bg: '#ece7db',
    surface: '#f5f2ea',
    'surface-sunk': '#e3dccb',
    line: '#d4cbb7',
    ink: '#26302a',
    'ink-muted': '#5d665e',
    sage: '#6f8a74',
    'sage-strong': '#4e6754',
    'sage-soft': '#dce3d8',
    sand: '#b9a780',
    'focus-ring': '#6f8a74',
  },
  dark: {
    bg: '#131915',
    surface: '#1a221d',
    'surface-sunk': '#0f1411',
    line: '#2c3630',
    ink: '#e6e1d4',
    'ink-muted': '#9fa79d',
    sage: '#8ea993',
    'sage-strong': '#b5c8b7',
    'sage-soft': '#22302a',
    sand: '#cbbb97',
    'focus-ring': '#8ea993',
  },
};

export function paletteTokens(id: PaletteId, mode: ThemeMode, custom?: PaletteSpec): Record<string, string> {
  if (id === 'custom') {
    const spec = custom ?? PRESETS['sage-linen'];
    return generateTokens({ ...spec, chromaScale: Math.min(spec.chromaScale ?? 1, CUSTOM_MAX_CHROMA / 0.0452) }, mode);
  }
  const generated = generateTokens(PRESETS[id], mode);
  return id === 'sage-linen' ? { ...generated, ...SAGE_LINEN_EXACT[mode] } : generated;
}

export interface ContrastReport {
  body: number; // ink on bg
  muted: number; // ink-muted on surface
  primaryUi: number; // sage vs surface (UI components, 3:1)
  primaryText: number; // sage-strong on surface (text, 4.5:1)
  ok: boolean;
}

export function contrastReport(tokens: Record<string, string>): ContrastReport {
  const body = contrast(tokens.ink!, tokens.bg!);
  const muted = contrast(tokens['ink-muted']!, tokens.surface!);
  const primaryUi = contrast(tokens.sage!, tokens.surface!);
  const primaryText = contrast(tokens['sage-strong']!, tokens.surface!);
  return { body, muted, primaryUi, primaryText, ok: body >= 4.5 && muted >= 4.5 && primaryUi >= 3 && primaryText >= 4.5 };
}

/** Swatch colours for the palette picker (primary, accent, background). */
export function paletteSwatch(id: PaletteId, mode: ThemeMode, custom?: PaletteSpec): [string, string, string] {
  const t = paletteTokens(id, mode, custom);
  return [t.sage!, t.sand!, t.bg!];
}

/** Apply tokens as CSS custom properties on <html>. Default palette uses the stylesheet values. */
export function applyPalette(id: PaletteId, mode: ThemeMode, custom?: PaletteSpec, root = document.documentElement) {
  const keys = Object.keys(LIGHT);
  if (id === 'sage-linen') {
    for (const k of keys) root.style.removeProperty(`--${k}`);
    return;
  }
  const tokens = paletteTokens(id, mode, custom);
  for (const [k, v] of Object.entries(tokens)) root.style.setProperty(`--${k}`, v);
}
