/**
 * Qibla (brief §16): bearing (adhan-js, great circle to the Kaaba), distance, the sun method, Rasd al-Qibla
 * moments (computed with astronomy-engine, never hard-coded) and magnetic declination (WMM2025, magvar).
 */
import { Coordinates, Qibla } from 'adhan';
import * as A from 'astronomy-engine';
import { magvar } from 'magvar';

export const KAABA = { lat: 21.4225, lon: 39.8262 };

export function qiblaBearing(lat: number, lon: number): number {
  return Qibla(new Coordinates(lat, lon));
}

export function distanceKm(lat: number, lon: number): number {
  const R = 6371.0088;
  const r = Math.PI / 180;
  const dLat = (KAABA.lat - lat) * r;
  const dLon = (KAABA.lon - lon) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * r) * Math.cos(KAABA.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function sunPosition(lat: number, lon: number, at: Date) {
  const obs = new A.Observer(lat, lon, 0);
  const eq = A.Equator(A.Body.Sun, at, obs, true, true);
  const hor = A.Horizon(at, obs, eq.ra, eq.dec, 'normal');
  return { azimuth: hor.azimuth, altitude: hor.altitude };
}

const angDiff = (a: number, b: number) => ((a - b + 540) % 360) - 180;

export interface SunAlignment {
  at: number;
  kind: 'facing' | 'behind';
  altitude: number;
}

/** Moments between `from` and `to` when the sun (above the horizon) is exactly toward or away from the qibla. */
export function sunAlignments(lat: number, lon: number, from: number, to: number, bearing: number): SunAlignment[] {
  const out: SunAlignment[] = [];
  for (const [kind, target] of [
    ['facing', bearing],
    ['behind', (bearing + 180) % 360],
  ] as const) {
    const f = (t: number) => angDiff(sunPosition(lat, lon, new Date(t)).azimuth, target);
    const step = 60_000;
    let t0 = from;
    let v0 = f(t0);
    for (let t = from + step; t <= to; t += step) {
      const v = f(t);
      if (Math.sign(v) !== Math.sign(v0) && Math.abs(v - v0) < 90) {
        let a = t - step;
        let b = t;
        let fa = v0;
        for (let i = 0; i < 20; i++) {
          const m = (a + b) / 2;
          const fm = f(m);
          if (Math.sign(fm) === Math.sign(fa)) {
            a = m;
            fa = fm;
          } else b = m;
        }
        const at = Math.round((a + b) / 2);
        const alt = sunPosition(lat, lon, new Date(at)).altitude;
        if (alt > 3) out.push({ at, kind, altitude: alt });
      }
      t0 = t;
      v0 = v;
    }
    void t0;
  }
  return out.sort((x, y) => x.at - y.at);
}

/**
 * Rasd al-Qibla: the moments when the sun passes (almost) straight over the Kaaba; every shadow on the sunlit
 * half of the Earth then points away from the qibla. Found as the days when the sun's altitude at the Kaaba's
 * local noon peaks above 89.5°.
 */
export function rasdAlQibla(fromMs: number, count = 2): { at: number; altitude: number }[] {
  const obs = new A.Observer(KAABA.lat, KAABA.lon, 0);
  const results: { at: number; altitude: number }[] = [];
  let time = A.MakeTime(new Date(fromMs - 86_400_000));
  let prev: { at: number; alt: number } | null = null;
  let prevPrev: { at: number; alt: number } | null = null;
  for (let i = 0; i < 420 && results.length < count; i++) {
    const transit = A.SearchHourAngle(A.Body.Sun, obs, 0, time);
    const alt = transit.hor.altitude;
    const cur = { at: transit.time.date.getTime(), alt };
    if (prev && prevPrev && prev.alt >= prevPrev.alt && prev.alt >= cur.alt && prev.alt > 89.5 && prev.at > fromMs) {
      results.push({ at: prev.at, altitude: prev.alt });
    }
    prevPrev = prev;
    prev = cur;
    time = transit.time.AddDays(0.5);
  }
  return results;
}

/** Magnetic declination in degrees (positive: magnetic north is east of true north). */
export function declination(lat: number, lon: number, at = new Date()): number | null {
  try {
    return magvar(lat, lon, 0, at);
  } catch {
    return null;
  }
}

/** Points along the great circle from (lat, lon) to the Kaaba, for the map line. */
export function greatCircle(lat: number, lon: number, steps = 64): [number, number][] {
  const r = Math.PI / 180;
  const [φ1, λ1, φ2, λ2] = [lat * r, lon * r, KAABA.lat * r, KAABA.lon * r];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2));
  if (d === 0) return [[lat, lon]];
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A1 = Math.sin((1 - f) * d) / Math.sin(d);
    const B1 = Math.sin(f * d) / Math.sin(d);
    const x = A1 * Math.cos(φ1) * Math.cos(λ1) + B1 * Math.cos(φ2) * Math.cos(λ2);
    const y = A1 * Math.cos(φ1) * Math.sin(λ1) + B1 * Math.cos(φ2) * Math.sin(λ2);
    const z = A1 * Math.sin(φ1) + B1 * Math.sin(φ2);
    pts.push([Math.atan2(z, Math.sqrt(x * x + y * y)) / r, Math.atan2(y, x) / r]);
  }
  return pts;
}
