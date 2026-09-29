// Fetches reference prayer times from the Aladhan API once, for the engine tests (brief §23).
// 10 cities × 4 dates (equinoxes/solstices 2026) × each city's default method.
//   node data-pipeline/fetch-aladhan-fixtures.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');

interface City {
  name: string;
  lat: number;
  lon: number;
  tz: string;
  method: string; // our method id
  aladhanMethod: number;
  school: 0 | 1; // 0 standard, 1 hanafi
}

const cities: City[] = [
  { name: 'Setif', lat: 36.19112, lon: 5.41373, tz: 'Africa/Algiers', method: 'algeria', aladhanMethod: 19, school: 0 },
  { name: 'Algiers', lat: 36.73225, lon: 3.08746, tz: 'Africa/Algiers', method: 'algeria', aladhanMethod: 19, school: 0 },
  { name: 'Oran', lat: 35.69906, lon: -0.63588, tz: 'Africa/Algiers', method: 'algeria', aladhanMethod: 19, school: 0 },
  { name: 'Makkah', lat: 21.42664, lon: 39.82563, tz: 'Asia/Riyadh', method: 'umm_al_qura', aladhanMethod: 4, school: 0 },
  { name: 'Cairo', lat: 30.06263, lon: 31.24967, tz: 'Africa/Cairo', method: 'egypt', aladhanMethod: 5, school: 0 },
  { name: 'Istanbul', lat: 41.01384, lon: 28.94966, tz: 'Europe/Istanbul', method: 'turkey', aladhanMethod: 13, school: 1 },
  { name: 'London', lat: 51.50853, lon: -0.12574, tz: 'Europe/London', method: 'moonsighting', aladhanMethod: 15, school: 0 },
  { name: 'Jakarta', lat: -6.21462, lon: 106.84513, tz: 'Asia/Jakarta', method: 'kemenag', aladhanMethod: 20, school: 0 },
  { name: 'Toronto', lat: 43.70011, lon: -79.4163, tz: 'America/Toronto', method: 'moonsighting', aladhanMethod: 15, school: 0 },
  { name: 'Oslo', lat: 59.91273, lon: 10.74609, tz: 'Europe/Oslo', method: 'mwl', aladhanMethod: 3, school: 0 },
];

const dates = ['2026-03-20', '2026-06-21', '2026-09-23', '2026-12-21'];

// Match adhan-js HighLatitudeRule.recommended(): seventh of the night above 48°, else middle of the night.
const latAdj = (lat: number) => (Math.abs(lat) > 48 ? 2 : 1);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const out: unknown[] = [];

for (const c of cities) {
  for (const date of dates) {
    const [y, m, d] = date.split('-');
    const url =
      `https://api.aladhan.com/v1/timings/${d}-${m}-${y}?latitude=${c.lat}&longitude=${c.lon}` +
      `&method=${c.aladhanMethod}&school=${c.school}&latitudeAdjustmentMethod=${latAdj(c.lat)}` +
      `&timezonestring=${encodeURIComponent(c.tz)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Ahd-dev/0.1 (test fixtures)' } });
    if (!res.ok) throw new Error(`${res.status} for ${url}`);
    const json = (await res.json()) as { data: { timings: Record<string, string>; meta: unknown } };
    const t = json.data.timings;
    out.push({
      city: c.name,
      lat: c.lat,
      lon: c.lon,
      tz: c.tz,
      method: c.method,
      asr: c.school ? 'hanafi' : 'standard',
      date,
      aladhan: { method: c.aladhanMethod, latitudeAdjustmentMethod: latAdj(c.lat), url },
      times: {
        fajr: t.Fajr,
        sunrise: t.Sunrise,
        dhuhr: t.Dhuhr,
        asr: t.Asr,
        maghrib: t.Maghrib,
        isha: t.Isha,
      },
    });
    console.log(c.name, date, t.Fajr, t.Sunrise, t.Dhuhr, t.Asr, t.Maghrib, t.Isha);
    await sleep(350);
  }
}

const dir = join(root, 'src/features/prayer/__fixtures__');
mkdirSync(dir, { recursive: true });
writeFileSync(
  join(dir, 'aladhan.json'),
  JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), source: 'https://api.aladhan.com/v1/timings', cases: out }, null, 1),
);
console.log(`wrote ${out.length} cases`);
