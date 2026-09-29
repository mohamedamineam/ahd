// Builds the curated library catalog (brief §17) from the IslamHouse API v3 — only books that really exist there,
// with their official item page and PDF attachment. Content stays unchanged and attributed to IslamHouse.
//   node data-pipeline/build-library-catalog.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const API = 'https://api3.islamhouse.com/v3/paV29H2gm56kvLPy'; // public key published in the official API docs
const UA = { 'User-Agent': 'Ahd-data-pipeline/0.1 (https://github.com/ahdapp/ahd)' };

type Category = 'tafsir' | 'sirah' | 'aqidah' | 'tazkiyah' | 'hadith' | 'fiqh' | 'adhkar';

const WANTED: { author: number; titles: { match: string; category: Category }[] }[] = [
  {
    author: 6948, // ابن تيمية
    titles: [
      { match: 'الواسطية', category: 'aqidah' },
      { match: 'العبودية', category: 'tazkiyah' },
      { match: 'الكلم الطيب', category: 'adhkar' },
      { match: 'رفع الملام', category: 'fiqh' },
      { match: 'أمراض القلوب', category: 'tazkiyah' },
      { match: 'التحفة العراقية', category: 'tazkiyah' },
    ],
  },
  {
    author: 6926, // ابن القيم
    titles: [
      { match: 'الوابل الصيب', category: 'adhkar' },
      { match: 'الفوائد', category: 'tazkiyah' },
      { match: 'الداء والدواء', category: 'tazkiyah' },
      { match: 'الجواب الكافي', category: 'tazkiyah' },
      { match: 'عدة الصابرين', category: 'tazkiyah' },
      { match: 'زاد المعاد', category: 'sirah' },
      { match: 'مدارج السالكين', category: 'tazkiyah' },
      { match: 'طريق الهجرتين', category: 'tazkiyah' },
    ],
  },
  {
    author: 8042, // ابن كثير
    titles: [
      { match: 'تفسير القرآن العظيم', category: 'tafsir' },
      { match: 'قصص الأنبياء', category: 'sirah' },
      { match: 'البداية والنهاية', category: 'sirah' },
    ],
  },
  { author: 7180, titles: [{ match: 'تيسير الكريم الرحمن', category: 'tafsir' }] }, // السعدي
  {
    author: 7354, // النووي
    titles: [
      { match: 'رياض الصالحين', category: 'hadith' },
      { match: 'الأربعون', category: 'hadith' },
      { match: 'الأذكار', category: 'adhkar' },
    ],
  },
  { author: 7261, titles: [{ match: 'حصن المسلم', category: 'adhkar' }] }, // القحطاني
];

// Items referenced directly by the brief (verified below; skipped if missing).
// الرحيق المختوم: islamhouse.com/p/273050 lists its editions; 2382 is the Arabic original.
const DIRECT: { id: number; category: Category }[] = [{ id: 2382, category: 'sirah' }];

interface Attachment {
  size: string;
  extension_type: string;
  url: string;
}
interface Item {
  id: number;
  title: string;
  type: string;
  description: string | null;
  source_language: string;
  prepared_by?: { id: number; title: string; kind?: string }[];
  attachments?: Attachment[];
  api_url: string;
}

const norm = (s: string) => s.replace(/[ً-ٰٟ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await new Promise((r) => setTimeout(r, 200));
  return (await res.json()) as T;
}

function sizeBytes(s: string): number {
  const m = /([\d.]+)\s*(KB|MB|GB)/i.exec(s);
  if (!m) return 0;
  const n = Number(m[1]);
  return Math.round(n * (m[2]!.toUpperCase() === 'KB' ? 1024 : m[2]!.toUpperCase() === 'MB' ? 1024 ** 2 : 1024 ** 3));
}

interface Book {
  id: string;
  islamhouseId: number;
  title: string;
  author: string;
  category: Category;
  language: string;
  description: string;
  format: 'pdf' | 'epub';
  url: string;
  size: number;
  sizeText: string;
  page: string;
}

function toBook(it: Item, category: Category): Book | null {
  const att = (it.attachments ?? []).find((a) => a.extension_type.toUpperCase() === 'PDF') ?? (it.attachments ?? []).find((a) => a.extension_type.toUpperCase() === 'EPUB');
  if (!att || !att.url.startsWith('https://d1.islamhouse.com/')) return null;
  const authors = [...new Set((it.prepared_by ?? []).filter((p) => p.kind !== 'source').map((p) => p.title.trim()))];
  return {
    id: `ih-${it.id}`,
    islamhouseId: it.id,
    title: it.title.trim(),
    author: authors.join('، '),
    category,
    language: it.source_language,
    description: (it.description ?? '').trim(),
    format: att.extension_type.toUpperCase() === 'PDF' ? 'pdf' : 'epub',
    url: att.url,
    size: sizeBytes(att.size),
    sizeText: att.size,
    page: `https://islamhouse.com/ar/books/${it.id}/`,
  };
}

const books = new Map<number, Book>();
for (const w of WANTED) {
  const list = await get<{ data: Item[] }>(`${API}/main/get-author-items/${w.author}/books/ar/ar/1/200/json`);
  for (const t of w.titles) {
    const hit = list.data.find((it) => norm(it.title).includes(norm(t.match)) && it.source_language === 'ar');
    if (!hit) {
      console.log(`  not found on IslamHouse: ${t.match} (author ${w.author})`);
      continue;
    }
    const full = await get<Item>(`${API}/main/get-item/${hit.id}/ar/json`);
    const b = toBook(full, t.category);
    if (b) books.set(hit.id, b);
    else console.log(`  no PDF/EPUB attachment: ${hit.title}`);
  }
}
for (const d of DIRECT) {
  try {
    const it = await get<Item>(`${API}/main/get-item/${d.id}/ar/json`);
    const b = toBook(it, d.category);
    if (b) books.set(d.id, b);
    else console.log(`  item ${d.id}: no Arabic PDF attachment`);
  } catch (e) {
    console.log(`  item ${d.id}: ${String(e)}`);
  }
}

const catalog = {
  version: 1,
  generated: new Date().toISOString().slice(0, 10),
  provider: { name: 'IslamHouse', url: 'https://islamhouse.com', terms: 'Free distribution; content kept unchanged and attributed to IslamHouse.' },
  books: [...books.values()],
};
mkdirSync(join(root, 'src/content/library'), { recursive: true });
writeFileSync(join(root, 'src/content/library/catalog.json'), JSON.stringify(catalog, null, 1) + '\n');
console.log(`catalog: ${catalog.books.length} books`);
for (const b of catalog.books) console.log(`  ${b.category.padEnd(9)} ${b.sizeText.padStart(9)}  ${b.title} — ${b.author}`);
