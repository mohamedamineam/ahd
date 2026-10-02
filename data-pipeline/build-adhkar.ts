// Builds src/content/adhkar/adhkar.json from Hisn al-Muslim (brief §15.1).
//  - Primary (shipped): github.com/asellam/HisnElMuslim hisn.json — MIT, typed from the printed book
//    (Dar as-Sijillat edition) and diffed by its author against an online copy.
//  - Cross-check (not shipped): hisnmuslim.com API, one JSON per chapter.
//  - English (shipped, shown under the Arabic in the English interface): the book's English translation from
//    hisnmuslim.com, the book's own site. Each of its items carries its Arabic text, which is how a translation is
//    matched to an item here; an item without a confident match is shipped without one.
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
const EN_INDEX = 'http://www.hisnmuslim.com/api/en/husn_en.json';

async function cached(url: string, file: string): Promise<string> {
  const p = join(cache, file);
  if (!existsSync(p)) {
    const res = await fetch(url, { headers: { 'User-Agent': '3ahd-data-pipeline/0.1 (https://github.com/mohamedamineam/ahd)' } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    writeFileSync(p, Buffer.from(await res.arrayBuffer()));
    await new Promise((r) => setTimeout(r, 250));
  }
  return readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
}

/** One hisnmuslim.com chapter file, `{ title: items }`. A few of them are not valid JSON (a raw line break, a title
 *  without its closing quote): white space becomes plain spaces, and a broken title is skipped to read the items. */
function chapterItems<T>(text: string): T[] {
  const clean = text.replace(/\s/g, ' '); // raw line breaks and tabs inside strings
  try {
    return Object.values(JSON.parse(clean) as Record<string, T[]>)[0] ?? [];
  } catch {
    return JSON.parse(clean.slice(clean.indexOf('['), clean.lastIndexOf(']') + 1)) as T[];
  }
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
  /** English translation (hisnmuslim.com), when one was matched */
  en?: string;
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

// ---- English translation
interface EnItem {
  ID: number;
  ARABIC_TEXT?: string;
  Text?: string; // one item names its Arabic text this way
  TRANSLATED_TEXT?: string;
}
const enIndexRaw = await cached(EN_INDEX, 'husn_en.json');
const enChapters = Object.values(JSON.parse(enIndexRaw) as Record<string, { ID: number; TITLE: string }[]>)[0]!;
const crossIds = new Set(crossChapters.map((c) => c.ID));
if (enChapters.length !== crossChapters.length || enChapters.some((c) => !crossIds.has(c.ID))) throw new Error('the English and Arabic chapters of hisnmuslim.com no longer share their ids');
const english = new Map<number, { ar: string; en: string }[]>();
const enHash = createHash('sha256').update(enIndexRaw);
for (const c of enChapters) {
  const raw = await cached(`http://www.hisnmuslim.com/api/en/${c.ID}.json`, `en-${c.ID}.json`);
  enHash.update(raw);
  english.set(
    c.ID,
    chapterItems<EnItem>(raw)
      .map((i) => ({ ar: i.ARABIC_TEXT ?? i.Text ?? '', en: tidyTranslation(i.TRANSLATED_TEXT ?? '') }))
      .filter((i) => i.ar && i.en),
  );
}
/**
 * The site's translations lost the line breaks between their parts ("…promise.’al-waseelah: A station in
 * paradise.al-fadeelah: …", ")(shaheed:One who…"): a space goes back where a sentence, a note or a glossary term
 * starts. Only spaces are added, and not inside words such as mu.adhdhin or i.e.
 */
export function tidyTranslation(s: string): string {
  return ws(
    s
      .replace(/([.’)\]])(?=[A-Z‘(])/g, '$1 ')
      .replace(/\)(?=[a-z])/g, ') ')
      .replace(/([.’])(?=[a-z][\w -]{0,30}:)/g, '$1 ')
      .replace(/:(?=[A-Za-z‘(])/g, ': '),
  );
}
const words = (s: string) => new Set(bare(s).split(' ').filter(Boolean));
/** Of the words of our item, the share found in theirs (`ours`), and of theirs, the share found in ours (`theirs`). */
function cover(ourText: string, theirText: string) {
  const a = words(ourText);
  const b = words(theirText);
  let common = 0;
  for (const w of a) if (b.has(w)) common++;
  return { ours: common / Math.max(1, a.size), theirs: common / Math.max(1, b.size), both: common / Math.max(1, a.size, b.size) };
}
// The whole item is in theirs and theirs is not mostly something else (a count, the instructions around it), or both
// largely agree. Rejected by this: pieces of a longer dua (light, 33 × tasbih) and the book's opening line.
const confident = (c: { ours: number; theirs: number }) => (c.ours >= 0.8 && c.theirs >= 0.4) || (c.ours >= 0.6 && c.theirs >= 0.6);
// our chapter → theirs: the same title, else the chapter most of its items match (morning and evening are one
// chapter there, and some titles are spelt differently)
function englishChapter(ch: Chapter): number | null {
  const same = crossChapters.find((c) => bare(c.TITLE) === bare(ch.title));
  if (same) return same.ID;
  const votes = new Map<number, number>();
  for (const item of ch.items) {
    let best: { id: number; score: number } | null = null;
    for (const [id, list] of english) {
      for (const e of list) {
        const c = cover(item.text, e.ar);
        if (confident(c) && (!best || c.both > best.score)) best = { id, score: c.both };
      }
    }
    if (best) votes.set(best.id, (votes.get(best.id) ?? 0) + 1);
  }
  return [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
let translated = 0;
const untranslated: string[] = [];
const itemCount = chapters.reduce((n, c) => n + c.items.length, 0);
for (const ch of chapters) {
  const id = englishChapter(ch);
  const list = id === null ? [] : (english.get(id) ?? []);
  for (const item of ch.items) {
    const best = list.map((e) => ({ e, c: cover(item.text, e.ar) })).sort((a, b) => b.c.both - a.c.both)[0];
    // the evening form of a morning dhikr: only with a translation that gives the evening words (the site has one
    // morning-and-evening chapter, and sometimes only the morning words)
    const eveningWords = /(^| )[وف]?امس(ي|ينا|يت)( |$)/.test(bare(item.text)) && !/evening/i.test(best?.e.en ?? '');
    if (best && confident(best.c) && !eveningWords) {
      item.en = best.e.en;
      translated++;
    } else untranslated.push(`- **${item.id}** — ${ws(item.text).slice(0, 80)}`);
  }
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
  english: { name: 'Fortress of the Muslim (Hisn al-Muslim in English)', url: 'https://www.hisnmuslim.com', sha256: enHash.digest('hex') },
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

## English translation

${translated} of ${itemCount} items have the English translation of hisnmuslim.com (shown under the Arabic in the
English interface). These ${untranslated.length} have none: no item there matches them confidently (parts of a
longer dua, the book's opening line, instructions).

${untranslated.join('\n')}
`;
writeFileSync(join(root, 'docs/ADHKAR_REVIEW.md'), doc);
console.log(`adhkar: ${chapters.length} chapters, ${compared} items — identical ${identical}, different ${differing} (wording ${wording}), unmatched chapters ${unmatched}; English ${translated}/${itemCount}`);
