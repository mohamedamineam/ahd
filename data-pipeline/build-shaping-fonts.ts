// Complete TrueType fonts for text shaped with HarfBuzz (src/features/shaping): the adhkar and duas (Amiri)
// and the covenant hadith (Aref Ruqaa). The CSS fonts from @fontsource are split into unicode-range subsets
// and WOFF2, which HarfBuzz cannot use, so the full Google Fonts releases are fetched here.
// Files are pinned to a google/fonts commit and verified against data-pipeline/checksums.json.
//   node data-pipeline/build-shaping-fonts.ts            verify / fetch
//   node data-pipeline/build-shaping-fonts.ts --update   accept new checksums (after reviewing an upstream change)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const out = join(root, 'public/fonts');
const UA = { 'User-Agent': '3ahd-data-pipeline/0.1 (https://github.com/mohamedamineam/ahd)' };

const FONTS = [
  { file: 'Amiri-Regular.ttf', commit: 'fffdadf0f0c9cc1ec8b407063424a8bfbee05611', path: 'ofl/amiri/Amiri-Regular.ttf' },
  { file: 'ArefRuqaa-Regular.ttf', commit: '47401edc4eeeb709bd28e357868278170ff9ac1b', path: 'ofl/arefruqaa/ArefRuqaa-Regular.ttf' },
];

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const checksFile = join(root, 'data-pipeline/checksums.json');
const checks = JSON.parse(readFileSync(checksFile, 'utf8')) as Record<string, unknown> & { shapingFonts?: Record<string, string> };
const known = checks.shapingFonts ?? {};
const update = process.argv.includes('--update');

mkdirSync(out, { recursive: true });
for (const f of FONTS) {
  const url = `https://raw.githubusercontent.com/google/fonts/${f.commit}/${f.path}`;
  const dest = join(out, f.file);
  let data = existsSync(dest) ? new Uint8Array(readFileSync(dest)) : null;
  if (!data || (known[f.file] && sha(data) !== known[f.file])) {
    const res = await fetch(url, { headers: UA });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    data = new Uint8Array(await res.arrayBuffer());
  }
  const sum = sha(data);
  if (known[f.file] && known[f.file] !== sum && !update) throw new Error(`${f.file}: checksum changed (${sum}); review and re-run with --update`);
  known[f.file] = sum;
  writeFileSync(dest, data);
  console.log(`${f.file}  ${(data.length / 1024).toFixed(0)} KB  ${sum}`);
}
writeFileSync(checksFile, JSON.stringify({ ...checks, shapingFonts: known }, null, 2) + '\n');
