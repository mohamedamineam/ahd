import { describe, expect, it } from 'vitest';
import { contrastReport, oklchToHex, paletteTokens, PALETTE_IDS, type ThemeMode } from './palette';

describe('palettes', () => {
  it('reproduces the brief colours for Sage & Linen', () => {
    expect(paletteTokens('sage-linen', 'light').bg).toBe('#ece7db');
    expect(paletteTokens('sage-linen', 'dark').sage).toBe('#8ea993');
  });

  it('keeps generated colours close to the brief for the sage hue (sanity of the OKLCH conversion)', () => {
    // brief: --sage #6F8A74 = oklch(0.606 0.0452 150.3)
    expect(oklchToHex(0.606, 0.0452, 150.3)).toBe('#6f8a74');
  });

  for (const mode of ['light', 'dark'] as ThemeMode[]) {
    for (const id of PALETTE_IDS.filter((p) => p !== 'custom')) {
      it(`${id} (${mode}) passes WCAG AA`, () => {
        const r = contrastReport(paletteTokens(id, mode));
        expect(r.body).toBeGreaterThanOrEqual(4.5);
        expect(r.muted).toBeGreaterThanOrEqual(4.5);
        expect(r.primaryUi).toBeGreaterThanOrEqual(3);
        expect(r.primaryText).toBeGreaterThanOrEqual(4.5);
      });
    }
    it(`custom hues around the wheel pass WCAG AA (${mode})`, () => {
      for (let h = 0; h < 360; h += 15) {
        const r = contrastReport(paletteTokens('custom', mode, { primaryHue: h, accentHue: (h + 300) % 360, chromaScale: 1.3 }));
        expect(r.ok, `hue ${h}`).toBe(true);
      }
    });
  }
});
