import { describe, expect, it } from 'vitest';
import { distanceKm, qiblaBearing, rasdAlQibla, sunAlignments, sunPosition, declination, greatCircle } from './qibla';

describe('qibla', () => {
  it('gives the known bearing and distance for Sétif', () => {
    const b = qiblaBearing(36.19112, 5.41373);
    expect(b).toBeGreaterThan(100);
    expect(b).toBeLessThan(112);
    expect(Math.round(distanceKm(36.19112, 5.41373))).toBeGreaterThan(3650);
    expect(Math.round(distanceKm(36.19112, 5.41373))).toBeLessThan(3760);
  });

  it('finds sun alignments that really point along the qibla', () => {
    const lat = 36.19112;
    const lon = 5.41373;
    const b = qiblaBearing(lat, lon);
    const from = Date.parse('2026-09-30T00:00:00Z');
    const list = sunAlignments(lat, lon, from, from + 86_400_000, b);
    expect(list.length).toBeGreaterThan(0);
    for (const s of list) {
      const az = sunPosition(lat, lon, new Date(s.at)).azimuth;
      const target = s.kind === 'facing' ? b : (b + 180) % 360;
      expect(Math.abs(((az - target + 540) % 360) - 180)).toBeLessThan(0.05);
    }
  });

  it('computes Rasd al-Qibla in late May and mid July', () => {
    const r = rasdAlQibla(Date.parse('2026-01-01T00:00:00Z'), 2);
    expect(r.length).toBe(2);
    const [may, july] = r.map((x) => new Date(x.at));
    expect(may!.getUTCMonth()).toBe(4); // May
    expect(may!.getUTCDate()).toBeGreaterThanOrEqual(26);
    expect(july!.getUTCMonth()).toBe(6); // July
    expect(july!.getUTCDate()).toBeGreaterThanOrEqual(14);
    expect(july!.getUTCDate()).toBeLessThanOrEqual(17);
    // at local noon in Makkah ≈ 09:18–09:27 UTC
    expect(may!.getUTCHours()).toBe(9);
  });

  it('returns a WMM2025 declination and a great-circle path', () => {
    const d = declination(36.19, 5.41, new Date('2026-09-30'));
    expect(d).not.toBeNull();
    expect(Math.abs(d!)).toBeLessThan(10);
    const path = greatCircle(51.5, -0.12);
    expect(path.at(-1)![0]).toBeCloseTo(21.4225, 3);
  });
});
