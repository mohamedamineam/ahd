// Builds the offline Quran data for both riwayat (brief §14):
//   public/quran/hafs.json, public/quran/warsh.json, public/quran/fonts/*.ttf
// The TrueType fonts are shipped exactly as published (the KFGQPC licence forbids modifying them); TrueType because
// the Quran is shaped with HarfBuzz (src/features/shaping), which reads sfnt fonts only.
// Text and fonts: King Fahd Glorious Qur'an Printing Complex (KFGQPC) Unicode Uthmanic data — Hafs v18, Warsh v10
// — the text and its font come from the same release, so glyphs match. Downloaded from the developer mirror
// github.com/thetruetruth/quran-data-kfgqpc because the official site (qurancomplex.gov.sa/techquran/dev) was
// unreachable at build time; checksums are recorded so the files can be verified against the official download.
// Surah revelation place: Tanzil metadata (tanzil.net, CC BY 3.0).
// Display text is copied VERBATIM. A separate normalised string per ayah is produced for search only.
//   node data-pipeline/build-quran.ts
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const cache = join(root, 'data-pipeline/cache/quran');
mkdirSync(cache, { recursive: true });
const MIRROR = 'https://raw.githubusercontent.com/thetruetruth/quran-data-kfgqpc/main';
const TANZIL_META = 'https://tanzil.net/res/text/metadata/quran-data.xml';

async function fetchCached(url: string, file: string): Promise<string> {
  const p = join(cache, file);
  if (!existsSync(p)) {
    const res = await fetch(url, { headers: { 'User-Agent': 'Ahd-data-pipeline/0.1 (https://github.com/ahdapp/ahd)' } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    writeFileSync(p, Buffer.from(await res.arrayBuffer()));
  }
  return p;
}
const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');

/** Search key only (never displayed): strip tashkeel, Quranic annotation marks, tatweel and ayah numbers. */
export function searchKey(s: string): string {
  return s
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
    .replace(/[٠-٩۰-۹0-9]/g, '')
    .replace(/[\u06DD\u06DE\u00A0]/g, ' ')
    .replace(/[ٱآأإ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^ء-ي ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Raw {
  id: number;
  jozz: number;
  sora?: number;
  sura_no?: number;
  sora_name_en?: string;
  sura_name_en?: string;
  sora_name_ar?: string;
  sura_name_ar?: string;
  page: number | string;
  aya_no: number;
  aya_text: string;
  aya_text_emlaey?: string;
}

// Tanzil metadata: surah type (Meccan/Medinan)
const metaXml = readFileSync(await fetchCached(TANZIL_META, 'tanzil-quran-data.xml'), 'utf8');
const surahType = new Map<number, 'meccan' | 'medinan'>();
for (const m of metaXml.matchAll(/<sura index="(\d+)"[^>]*type="(Meccan|Medinan)"/g)) surahType.set(Number(m[1]), m[2] === 'Meccan' ? 'meccan' : 'medinan');
if (surahType.size !== 114) throw new Error(`Tanzil metadata: expected 114 suras, got ${surahType.size}`);

const checksums: Record<string, string> = {};
const outDir = join(root, 'public/quran');
mkdirSync(join(outDir, 'fonts'), { recursive: true });

for (const r of [
  { id: 'hafs', data: 'hafs/data/hafsData_v18.json', font: 'hafs/font/hafs.18.ttf', expected: 6236, version: 'KFGQPC Hafs Uthmanic Script v18' },
  { id: 'warsh', data: 'warsh/data/warshData_v10.json', font: 'warsh/font/warsh.10.ttf', expected: 6214, version: 'KFGQPC Warsh Uthmanic Script v10' },
] as const) {
  const dataPath = await fetchCached(`${MIRROR}/${r.data}`, r.data.split('/').pop()!);
  const fontPath = await fetchCached(`${MIRROR}/${r.font}`, r.font.split('/').pop()!);
  checksums[r.data] = sha(dataPath);
  checksums[r.font] = sha(fontPath);
  const raw = JSON.parse(readFileSync(dataPath, 'utf8').replace(/^\uFEFF/, '')) as Raw[];
  if (raw.length !== r.expected) throw new Error(`${r.id}: expected ${r.expected} ayat, got ${raw.length}`);

  const surahs: { n: number; ar: string; en: string; ayat: number; type: string; page: number; juz: number }[] = [];
  const ayat: [number, number, number, number, string, string][] = [];
  for (const a of raw) {
    const sura = a.sora ?? a.sura_no!;
    // Warsh marks ayat spanning two pages as "85-86": the ayah belongs to the page it starts on
    const page = Number.parseInt(String(a.page), 10);
    if (!surahs[sura - 1]) {
      surahs[sura - 1] = {
        n: sura,
        ar: (a.sora_name_ar ?? a.sura_name_ar ?? '').trim(),
        en: (a.sora_name_en ?? a.sura_name_en ?? '').trim(),
        ayat: 0,
        type: surahType.get(sura)!,
        page,
        juz: a.jozz,
      };
    }
    surahs[sura - 1]!.ayat++;
    ayat.push([sura, a.aya_no, page, a.jozz, a.aya_text, searchKey(a.aya_text_emlaey ?? a.aya_text)]);
  }
  if (surahs.length !== 114 || surahs.some((s) => !s)) throw new Error(`${r.id}: expected 114 surahs`);
  const pages = new Set(ayat.map((a) => a[2]));
  if (Math.max(...pages) !== 604 || Math.min(...pages) !== 1) throw new Error(`${r.id}: unexpected page range`);

  const fontOut = `fonts/${r.font.split('/').pop()}`;
  copyFileSync(fontPath, join(outDir, fontOut));
  writeFileSync(
    join(outDir, `${r.id}.json`),
    JSON.stringify({
      riwaya: r.id,
      source: {
        name: r.version,
        publisher: 'King Fahd Glorious Qur’an Printing Complex (KFGQPC)',
        official: 'https://qurancomplex.gov.sa/en/techquran/dev/',
        downloadedFrom: `${MIRROR}/${r.data}`,
        sha256: checksums[r.data],
        terms: 'Free to copy, distribute and use, provided it is not attributed to another party. Text reproduced verbatim.',
      },
      font: fontOut,
      pages: 604,
      surahs,
      ayat,
    }),
  );
  console.log(`${r.id}: ${ayat.length} ayat, ${surahs.length} surahs, ${pages.size} pages`);
}

const checksFile = join(root, 'data-pipeline/checksums.json');
const all = existsSync(checksFile) ? JSON.parse(readFileSync(checksFile, 'utf8')) : {};
writeFileSync(checksFile, JSON.stringify({ ...all, kfgqpc: checksums, tanzilMetadata: sha(join(cache, 'tanzil-quran-data.xml')) }, null, 2) + '\n');
