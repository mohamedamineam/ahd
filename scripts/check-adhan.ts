// Validates assets/adhan/adhan.json against the audio files (brief §20).
//   node scripts/check-adhan.ts            every file has a complete entry (CI)
//   node scripts/check-adhan.ts --release  also requires a confirmed source URL and licence for each file
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIELDS = ['id', 'name_ar', 'name_en', 'muezzin', 'file', 'is_fajr', 'duration_s', 'short_end_s', 'source_url', 'license'] as const;

export function checkAdhan(dir: string, release: boolean): string[] {
  const problems: string[] = [];
  const meta = JSON.parse(readFileSync(join(dir, 'adhan.json'), 'utf8')) as { adhans: Record<string, unknown>[] };
  const audio = readdirSync(dir).filter((f) => /\.(mp3|ogg|flac|wav|m4a)$/i.test(f));
  for (const file of audio) {
    const e = meta.adhans.find((a) => a.file === file);
    if (!e) {
      problems.push(`${file}: no entry in adhan.json`);
      continue;
    }
    for (const f of FIELDS) {
      const v = e[f];
      if (v === undefined || v === null || v === '') problems.push(`${file}: missing ${f}`);
    }
    if (release) {
      for (const f of ['source_url', 'license'] as const) {
        if (String(e[f]).toUpperCase().includes('UNVERIFIED')) problems.push(`${file}: ${f} must be confirmed by the owner before release`);
      }
    }
  }
  for (const e of meta.adhans) if (!audio.includes(String(e.file))) problems.push(`${String(e.file)}: listed but missing`);
  const fajr = meta.adhans.filter((a) => a.is_fajr).length;
  if (fajr < 1) problems.push('no Fajr adhan');
  return problems;
}

if (import.meta.main) {
  const release = process.argv.includes('--release');
  const problems = checkAdhan(join(import.meta.dirname, '../assets/adhan'), release);
  if (problems.length) {
    console.error(problems.map((p) => `✗ ${p}`).join('\n'));
    process.exit(1);
  }
  console.log(`✓ adhan catalogue complete${release ? ' (release)' : ''}`);
}
