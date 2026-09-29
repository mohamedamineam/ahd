// Builds src/content/adhkar/adhkar.json from Hisn al-Muslim (brief §15.1).
//  - Primary (shipped): github.com/asellam/HisnElMuslim hisn.json — MIT, typed from the printed book
//    (Dar as-Sijillat edition) and diffed by its author against an online copy.
//  - Cross-check (not shipped): hisnmuslim.com API, one JSON per chapter.
// Texts are copied verbatim. Differences between the two copies (whitespace-normalised only) are written to
// docs/ADHKAR_REVIEW.md for the owner to review.
//   node data-pipeline/build-adhkar.ts
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const cache = join(root, 'data-pipeline/cache/adhkar');
mkdirSync(cache, { recursive: true });

const PRIMARY_URL = 'https://raw.githubusercontent.com/asellam/HisnElMuslim/main/hisn.json';
const CROSS_INDEX = 'http://www.hisnmuslim.com/api/ar/husn_ar.json';

async function cached(url: string, file: string): Promise<string> {
  const p = join(cache, file);
  if (!existsSync(p)) {
    const res = await fetch(url, { headers: { 'User-Agent': 'Ahd-data-pipeline/0.1 (https://github.com/ahdapp/ahd)' } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    writeFileSync(p, Buffer.from(await res.arrayBuffer()));
    await new Promise((r) => setTimeout(r, 250));
  }
  return readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const ws = (s: string) => s.replace(/\s+/g, ' ').trim();
// only for matching chapter titles / aligning items — never applied to shipped text
const bare = (s: string) =>
  s
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

interface PrimaryItem {
  Text: string;
  Count: number;
  Reference: string;
}
type Primary = Record<string, { Audio?: string; Adhkar: PrimaryItem[] }>;

const primaryRaw = await cached(PRIMARY_URL, 'hisn.json');
const primary = JSON.parse(primaryRaw) as Primary;

// ---- app categories (brief §15.2) → chapter indexes in the book
const CATEGORY_CHAPTERS: Record<string, { en: string; chapters: string[] }> = {
  morning: { en: 'Morning', chapters: ['أَذْكَارُ الصَّبَاحِ'] },
  evening: { en: 'Evening', chapters: ['أَذْكَارُ المَسَاءِ'] },
  'after-salah': { en: 'After the prayer', chapters: ['الأَذْكَارُ بَعْدَ السَّلَامِ مِنَ الصَّلَاةِ'] },
  sleep: { en: 'Before sleep', chapters: ['أَذْكَارُ النَّوْمِ', 'الدُّعَاءُ إِذَا تَقَلَّبَ لَيْلًا', 'دُعَاءُ الفَزَعِ فِي النَّوْمِ وَمَنْ بُلِيَ بِالوَحْشَةِ'] },
  waking: { en: 'On waking', chapters: ['أَذْكَارُ الِاسْتِيقَاظِ مِنَ النَّوْمِ'] },
  adhan: { en: 'The adhan', chapters: ['أَذْكَارُ الأَذَانِ'] },
  mosque: { en: 'The mosque', chapters: ['دُعَاءُ الذَّهَابِ إِلَى الـمَسْجِدِ', 'دُعَاءُ دُخُولِ الـمَسْجِدِ', 'دُعَاءُ الخُرُوجِ مِنَ الـمَسْجِدِ'] },
  home: { en: 'Leaving and entering home', chapters: ['الذِّكْرُ عِنْدَ الخُرُوجِ مِنَ الـمَنْزِلِ', 'الذِّكْرُ عِنْدَ دُخُولِ الـمَنْزِلِ'] },
  wudu: { en: 'Ablution', chapters: ['الذِّكْرُ قَبْلَ الوُضُوءِ', 'الذِّكْرُ بَعْدَ الفَرَاغِ مِنَ الوُضُوءِ'] },
  istikhara: { en: 'Istikhara', chapters: ['دُعَاءُ صَلَاةِ الاسْتِخَارَةِ'] },
  distress: { en: 'Worry and distress', chapters: ['دُعَاءُ الهَمِّ والحُزْنِ', 'دُعَاءُ الكَرْبِ'] },
  travel: {
    en: 'Travel',
    chapters: ['دُعَاءُ السَّفَرِ', 'دُعَاءُ دُخُولِ القَرْيَةِ أَو البَلْدَةِ', 'دُعَاءُ المُسَافِرِ لِلْمُقِيمِ', 'دُعَاءُ المُقِيمِ لِلْمُسَافِرِ', 'التَّكْبِيرُ وَالتَّسْبِيحُ فِي سَيْرِ السَّفَرِ', 'ذِكْرُ الرُّجُوعِ مِنَ السَّفَرِ'],
  },
  food: {
    en: 'Food and drink',
    chapters: ['الدُّعَاءُ قَبْلَ الطَّعَامِ', 'الدُّعَاءُ عِنْدَ الفَرَاغِ مِنَ الطَّعَامِ', 'دُعَاءُ الضَّيْفِ لِصَاحِبِ الطَّعَامِ', 'الدُّعَاءُ لِمَنْ سَقَاهُ أَوْ إِذَا أَرَادَ ذَلِكَ', 'الدُّعَاءُ عِنْدَ إِفْطَارِ الصَّائِمِ'],
  },
  weather: {
    en: 'Rain and wind',
    chapters: ['دُعَاءُ الرِّيحِ', 'دُعَاءُ الرَّعْدِ', 'مِنْ أَدْعِيَةِ الاسْتِسْقَاءِ', 'الدُّعَاءُ إِذَا نَزَلَ المَطَرُ', 'الذِّكْرُ بَعْدَ نُزُولِ المَطَرِ', 'مِنْ أَدْعِيَةِ الاسْتِصْحَاءِ'],
  },
  riding: { en: 'Riding', chapters: ['دُعَاءُ الرُّكُوبِ'] },
  istighfar: { en: 'Seeking forgiveness', chapters: ['الاسْتِغْفَارُ وَالتَّوْبَةُ'] },
  tasbih: { en: 'Glorification', chapters: ['فَضْلُ التَّسْبِيحِ وَالتَّحْمِيدِ، وَالتَّهْلِيلِ، وَالتَّكْبِيرِ', 'كَيْفَ كَانَ النَّبِيُّ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ يُسَبِّحُ؟'] },
};

interface Item {
  id: string;
  chapter: number;
  text: string;
  count: number;
  reference: string;
}
interface Chapter {
  index: number;
  title: string;
  items: Item[];
}

const chapters: Chapter[] = Object.entries(primary).map(([title, v], index) => ({
  index,
  title,
  items: v.Adhkar.map((a, i) => ({ id: `c${index}-${i}`, chapter: index, text: a.Text, count: Math.max(1, Number(a.Count) || 1), reference: a.Reference })),
}));
const byTitle = new Map(chapters.map((c) => [bare(c.title), c]));

const categories = Object.entries(CATEGORY_CHAPTERS).map(([id, def]) => {
  const chs = def.chapters.map((t) => {
    const c = byTitle.get(bare(t));
    if (!c) throw new Error(`chapter not found in source: ${t}`);
    return c.index;
  });
  return { id, en: def.en, chapters: chs };
});

// the dua after the adhan (shown in the adhan toast) — located in the source, never typed
const adhanChapter = byTitle.get(bare('أَذْكَارُ الأَذَانِ'))!;
const dua = adhanChapter.items.find((i) => bare(i.text).includes('رب هذه الدعوه التامه'));
if (!dua) throw new Error('dua after the adhan not found in the adhan chapter');

// ---- cross-check against hisnmuslim.com
interface CrossChapter {
  ID: number;
  TITLE: string;
  TEXT: string;
}
const index = JSON.parse(await cached(CROSS_INDEX, 'husn_ar.json')) as Record<string, CrossChapter[]>;
const crossChapters = Object.values(index)[0]!;
const report: string[] = [];
let compared = 0;
let identical = 0;
let differing = 0;
let unmatched = 0;
let wording = 0;
for (const ch of chapters) {
  const cross = crossChapters.find((c) => bare(c.TITLE) === bare(ch.title));
  if (!cross) {
    unmatched++;
    report.push(`### ${ch.title}\n\n_No chapter with the same title in the cross-check copy (checked by hand is needed)._\n`);
    continue;
  }
  const raw = JSON.parse(await cached(`http://www.hisnmuslim.com/api/ar/${cross.ID}.json`, `ch-${cross.ID}.json`)) as Record<string, { ARABIC_TEXT: string; REPEAT: number }[]>;
  const crossItems = Object.values(raw)[0] ?? [];
  const lines: string[] = [];
  ch.items.forEach((item, i) => {
    compared++;
    // align by best textual overlap, not only by position
    const candidates = crossItems.map((c, k) => ({ k, c, score: overlap(bare(item.text), bare(c.ARABIC_TEXT)) })).sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!best || best.score < 0.5) {
      differing++;
      lines.push(`- **${item.id}** (item ${i + 1}): no matching item found in the cross-check copy.`);
      return;
    }
    if (ws(best.c.ARABIC_TEXT) === ws(item.text)) {
      identical++;
      return;
    }
    differing++;
    const kind = bare(best.c.ARABIC_TEXT) === bare(item.text) ? 'diacritics or punctuation only' : 'wording';
    if (kind === 'wording') wording++;
    lines.push(`- **${item.id}** (item ${i + 1}) — ${kind}\n  - shipped: ${ws(item.text)}\n  - cross-check: ${ws(best.c.ARABIC_TEXT)}`);
  });
  if (lines.length) report.push(`### ${ch.title}\n\n${lines.join('\n')}\n`);
}

function overlap(a: string, b: string): number {
  const A = new Set(a.split(' '));
  const B = new Set(b.split(' '));
  let common = 0;
  for (const w of A) if (B.has(w)) common++;
  return common / Math.max(1, Math.min(A.size, B.size));
}

const out = {
  $comment:
    'Hisn al-Muslim by Saʿid ibn ʿAli ibn Wahf al-Qahtani. Text verbatim from github.com/asellam/HisnElMuslim (MIT). Do not edit by hand — regenerate with data-pipeline/build-adhkar.ts.',
  source: { name: 'حصن المسلم — سعيد بن علي بن وهف القحطاني', url: 'https://github.com/asellam/HisnElMuslim', license: 'MIT', sha256: sha(primaryRaw) },
  special: { duaAfterAdhan: dua.id },
  categories,
  chapters,
};
const outDir = join(root, 'src/content/adhkar');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'adhkar.json'), JSON.stringify(out));

const doc = `# Adhkar review — Hisn al-Muslim

Generated by \`data-pipeline/build-adhkar.ts\` on ${new Date().toISOString().slice(0, 10)}.

- Shipped text: github.com/asellam/HisnElMuslim (MIT) — sha256 \`${sha(primaryRaw)}\`
- Cross-check: hisnmuslim.com API (not shipped)
- Comparison: after normalising **whitespace only**; items aligned by word overlap.

| | Count |
|---|---|
| Items compared | ${compared} |
| Identical | ${identical} |
| Different (listed below) | ${differing} |
| — of which wording (review first) | ${wording} |
| — of which diacritics/punctuation only | ${differing - wording} |
| Chapters without a counterpart | ${unmatched} |

Most differences are in diacritics (tashkeel) and punctuation between the two digital copies. The shipped copy was
typed from the printed book by its author and checked against an online copy. **Owner review needed before release:**
please confirm each "wording" difference against the printed book.

${report.join('\n')}
`;
writeFileSync(join(root, 'docs/ADHKAR_REVIEW.md'), doc);
console.log(`adhkar: ${chapters.length} chapters, ${compared} items — identical ${identical}, different ${differing} (wording ${wording}), unmatched chapters ${unmatched}`);
