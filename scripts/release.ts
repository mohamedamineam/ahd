// Starts a release: sets the version everywhere, commits, tags and pushes.
//   node scripts/release.ts 0.2.0
// GitHub then builds the installers into a draft release (workflow "Release"); publish it on the Releases page.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const REPO = 'https://github.com/mohamedamineam/ahd';

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();

function fail(message: string): never {
  console.error(`release: ${message}`);
  process.exit(1);
}

const next = process.argv[2]?.replace(/^v/, '') ?? '';
if (!/^\d+\.\d+\.\d+$/.test(next)) fail('give the new version, for example: node scripts/release.ts 0.2.0');

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const current = pkg.version;
const parts = (v: string) => v.split('.').map(Number);
const newer = (a: string, b: string) => {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};
if (next !== current && !newer(next, current)) fail(`${next} is lower than the current version ${current}`);
if (git('tag', '--list', `v${next}`)) fail(`tag v${next} already exists`);
if (git('status', '--porcelain')) fail('there are uncommitted changes; commit or discard them first');
if (git('branch', '--show-current') !== 'main') fail('switch to the main branch first');

// every file that carries the version
function edit(file: string, change: (text: string) => string) {
  const before = readFileSync(file, 'utf8');
  const after = change(before);
  if (after === before && next !== current) fail(`could not find the version in ${file}`);
  writeFileSync(file, after);
}
type Versioned = { version: string; packages?: Record<string, { version?: string }> };
const json = (file: string, change: (data: Versioned) => void) =>
  edit(file, (text) => {
    const data = JSON.parse(text) as Versioned;
    change(data);
    return JSON.stringify(data, null, 2) + '\n';
  });

json('package.json', (d) => (d.version = next));
json('package-lock.json', (d) => {
  d.version = next;
  if (d.packages?.['']) d.packages[''].version = next;
});
json('src-tauri/tauri.conf.json', (d) => (d.version = next));
edit('src-tauri/Cargo.toml', (t) => t.replace(/^version = "[^"]+"/m, `version = "${next}"`));
edit('src-tauri/Cargo.lock', (t) => t.replace(/(name = "ahd"\nversion = )"[^"]+"/, `$1"${next}"`));

if (next !== current) {
  git(
    'add',
    'package.json',
    'package-lock.json',
    'src-tauri/tauri.conf.json',
    'src-tauri/Cargo.toml',
    'src-tauri/Cargo.lock',
  );
  git('commit', '-m', `Version ${next}`);
}
git('tag', '-a', `v${next}`, '-m', `Ahd ${next}`);
execFileSync('git', ['push', '--atomic', 'origin', 'main', `v${next}`], { stdio: 'inherit' });

console.log(`
Release v${next} started. GitHub now builds the installers (about 20–30 minutes):
  ${REPO}/actions
When the "Release" run is green, open the draft, check it, and click "Publish release":
  ${REPO}/releases
The website's download buttons then give the new version.`);
