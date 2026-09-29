// Builds assets/data/cities.sqlite from GeoNames (CC BY 4.0) for offline place search (brief §8.6).
//   node data-pipeline/build-cities.ts
// Sources (cached in data-pipeline/cache/geonames, checksums in data-pipeline/checksums.json):
//   cities1000.zip, alternateNamesV2.zip (Arabic names only), admin1CodesASCII.txt
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { DatabaseSync } from 'node:sqlite';
import { normalize } from './normalize.ts';

const root = join(import.meta.dirname, '..');
const cache = join(root, 'data-pipeline/cache/geonames');
mkdirSync(cache, { recursive: true });
const BASE = 'https://download.geonames.org/export/dump/';

async function download(file: string) {
  const p = join(cache, file);
  if (existsSync(p)) return p;
  console.log('downloading', file);
  const res = await fetch(BASE + file, { headers: { 'User-Agent': 'Ahd-data-pipeline/0.1 (https://github.com/mohamedamineam/ahd)' } });
  if (!res.ok) throw new Error(`${res.status} ${file}`);
  writeFileSync(p, Buffer.from(await res.arrayBuffer()));
  return p;
}

function sha256(path: string) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function unzip(zip: string, member: string) {
  const out = join(cache, member);
  if (!existsSync(out)) execFileSync('unzip', ['-o', '-q', zip, member, '-d', cache]);
  return out;
}

async function* lines(path: string) {
  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const l of rl) yield l;
}

const citiesZip = await download('cities1000.zip');
const altZip = await download('alternateNamesV2.zip');
const admin1Path = await download('admin1CodesASCII.txt');
const checksums = { 'cities1000.zip': sha256(citiesZip), 'alternateNamesV2.zip': sha256(altZip), 'admin1CodesASCII.txt': sha256(admin1Path) };

interface City {
  id: number;
  name: string;
  ascii: string;
  alternates: string[];
  lat: number;
  lon: number;
  country: string;
  admin1Code: string;
  population: number;
  elevation: number | null;
  tz: string;
}

const cities: City[] = [];
for await (const l of lines(unzip(citiesZip, 'cities1000.txt'))) {
  const c = l.split('\t');
  if (c.length < 19) continue;
  const elev = c[15] ? Number(c[15]) : c[16] && c[16] !== '-9999' ? Number(c[16]) : null;
  cities.push({
    id: Number(c[0]),
    name: c[1]!,
    ascii: c[2]!,
    alternates: (c[3] ?? '').split(',').filter((a) => a && /^[\p{Script=Latin}\s'’.-]+$/u.test(a) && a.length <= 30),
    lat: Number(c[4]),
    lon: Number(c[5]),
    country: c[8]!,
    admin1Code: `${c[8]}.${c[10]}`,
    population: Number(c[14]) || 0,
    elevation: Number.isFinite(elev) ? elev : null,
    tz: c[17]!,
  });
}
console.log('cities', cities.length);

const admin1 = new Map<string, { name: string; id: number }>();
for (const l of readFileSync(admin1Path, 'utf8').split('\n')) {
  const c = l.split('\t');
  if (c.length >= 4) admin1.set(c[0]!, { name: c[1]!, id: Number(c[3]) });
}

// Arabic names for cities and admin1 regions
const wanted = new Set<number>([...cities.map((c) => c.id), ...[...admin1.values()].map((a) => a.id)]);
const arabic = new Map<number, { name: string; score: number }>();
for await (const l of lines(unzip(altZip, 'alternateNamesV2.txt'))) {
  // alternateNameId, geonameid, isolanguage, alternate name, isPreferredName, isShortName, isColloquial, isHistoric
  const tab1 = l.indexOf('\t');
  const tab2 = l.indexOf('\t', tab1 + 1);
  const tab3 = l.indexOf('\t', tab2 + 1);
  if (l.slice(tab2 + 1, tab3) !== 'ar') continue;
  const c = l.split('\t');
  const id = Number(c[1]);
  if (!wanted.has(id) || c[6] === '1' || c[7] === '1') continue;
  const score = (c[4] === '1' ? 2 : 0) + (c[5] === '1' ? 1 : 0);
  const prev = arabic.get(id);
  if (!prev || score > prev.score) arabic.set(id, { name: c[3]!, score });
}
console.log('arabic names', arabic.size);

const out = join(root, 'assets/data/cities.sqlite');
mkdirSync(join(root, 'assets/data'), { recursive: true });
if (existsSync(out)) rmSync(out);
const db = new DatabaseSync(out);
db.exec(`
PRAGMA journal_mode = OFF;
PRAGMA page_size = 4096;
CREATE TABLE places (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL, name_ar TEXT,
  admin1 TEXT, admin1_ar TEXT,
  country TEXT NOT NULL,
  lat REAL NOT NULL, lon REAL NOT NULL,
  elevation INTEGER, tz TEXT NOT NULL, population INTEGER NOT NULL
);
CREATE VIRTUAL TABLE places_fts USING fts5(norm, content='', columnsize=0, detail=none, tokenize="unicode61 remove_diacritics 2");
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
`);
const ins = db.prepare('INSERT INTO places VALUES (?,?,?,?,?,?,?,?,?,?,?)');
const fts = db.prepare('INSERT INTO places_fts (rowid, norm) VALUES (?, ?)');
db.exec('BEGIN');
for (const c of cities) {
  const a1 = admin1.get(c.admin1Code);
  const nameAr = arabic.get(c.id)?.name ?? null;
  const a1Ar = a1 ? (arabic.get(a1.id)?.name ?? null) : null;
  ins.run(c.id, c.name, nameAr, a1?.name ?? null, a1Ar, c.country, +c.lat.toFixed(5), +c.lon.toFixed(5), c.elevation, c.tz, c.population);
  const terms = new Set([c.name, c.ascii, nameAr ?? '', ...c.alternates.slice(0, 8)].filter(Boolean).map(normalize));
  fts.run(c.id, [...terms].join(' '));
}
db.exec('COMMIT');
db.exec('CREATE INDEX places_latlon ON places (lat, lon)');
const metaIns = db.prepare('INSERT INTO meta VALUES (?, ?)');
metaIns.run('source', 'GeoNames (https://www.geonames.org/) — CC BY 4.0');
metaIns.run('built', new Date().toISOString());
metaIns.run('checksums', JSON.stringify(checksums));
db.exec("INSERT INTO places_fts(places_fts) VALUES('optimize')");
db.exec('VACUUM');
db.close();

const checksFile = join(root, 'data-pipeline/checksums.json');
const all = existsSync(checksFile) ? JSON.parse(readFileSync(checksFile, 'utf8')) : {};
writeFileSync(checksFile, JSON.stringify({ ...all, geonames: checksums }, null, 2) + '\n');
console.log(`cities.sqlite: ${(statSync(out).size / 1e6).toFixed(1)} MB`);
