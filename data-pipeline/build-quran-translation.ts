// Builds public/quran/en.json: the English translation shown by the Quran reader's English view, one string per
// ayah in the order of public/quran/hafs.json (the Kufan count of the Madinah mushaf, which translations follow).
// Translation: Saheeh International, from tanzil.net (non-commercial use, as 3ahd is). Text copied verbatim apart
// from trailing spaces.
//   node data-pipeline/build-quran-translation.ts
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const cache = join(root, 'data-pipeline/cache/quran');
mkdirSync(cache, { recursive: true });
const URL = 'https://tanzil.net/trans/?transID=en.sahih&type=txt-2';

const file = join(cache, 'en.sahih.txt');
if (!existsSync(file)) {
  const res = await fetch(URL, {
    headers: { 'User-Agent': '3ahd-data-pipeline/0.1 (https://github.com/mohamedamineam/ahd)' },
  });
  if (!res.ok) throw new Error(`${res.status} ${URL}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}
const raw = readFileSync(file, 'utf8');

// "surah|ayah|text" lines, then a comment block
const ayat = new Map<string, string>();
for (const line of raw.split('\n')) {
  const m = /^(\d+)\|(\d+)\|(.*)$/.exec(line);
  if (m) ayat.set(`${m[1]}:${m[2]}`, m[3]!.trimEnd());
}

// the same ayat, in the same order, as the Hafs text
const hafs = JSON.parse(readFileSync(join(root, 'public/quran/hafs.json'), 'utf8')) as {
  ayat: [number, number][];
};
const text = hafs.ayat.map(([s, a]) => {
  const t = ayat.get(`${s}:${a}`);
  if (!t) throw new Error(`no translation for ${s}:${a}`);
  return t;
});
if (ayat.size !== text.length)
  throw new Error(`${ayat.size} ayat in the translation, ${text.length} in the Hafs text`);

const out = {
  $comment: 'Do not edit by hand — regenerate with data-pipeline/build-quran-translation.ts.',
  id: 'en.sahih',
  lang: 'en',
  source: {
    name: 'Saheeh International',
    downloadedFrom: URL,
    sha256: createHash('sha256').update(raw).digest('hex'),
    terms:
      'tanzil.net: translations for non-commercial use. No translation of the Quran can be a hundred percent accurate, nor replace the Quran text.',
  },
  ayat: text,
};
writeFileSync(join(root, 'public/quran/en.json'), JSON.stringify(out));
console.log(`public/quran/en.json: ${text.length} ayat`);
