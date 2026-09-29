declare module 'magvar' {
  /** Magnetic declination in degrees (WMM2025). */
  export function magvar(lat: number, lon: number, altitudeKm?: number, date?: Date): number;
}
