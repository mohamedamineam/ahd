// Merge translation keys into src/i18n/{en,ar}.json (keeps both files in sync).
//   node scripts/i18n-merge.mjs keys.json
// keys.json: { "a.b.c": ["English", "العربية"], "x.count": { "en": { "one": "…", "other": "…" }, "ar": { "zero": "…", … } } }
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', 'src', 'i18n');
const input = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const files = Object.fromEntries(['en', 'ar'].map((l) => [l, JSON.parse(readFileSync(join(dir, `${l}.json`), 'utf8'))]));
const FORMS = ['zero', 'one', 'two', 'few', 'many', 'other'];

function put(obj, path, value) {
  const parts = path.split('.');
  let o = obj;
  for (const p of parts.slice(0, -1)) o = o[p] ??= {};
  o[parts.at(-1)] = value;
}

for (const [key, val] of Object.entries(input)) {
  const pair = Array.isArray(val) ? { en: val[0], ar: val[1] } : val;
  for (const lang of ['en', 'ar']) {
    const v = pair[lang];
    if (v && typeof v === 'object' && Object.keys(v).every((k) => FORMS.includes(k))) {
      for (const [form, text] of Object.entries(v)) put(files[lang], `${key}_${form}`, text);
    } else put(files[lang], key, v);
  }
}
for (const [l, data] of Object.entries(files)) writeFileSync(join(dir, `${l}.json`), JSON.stringify(data, null, 2) + '\n');
console.log(`merged ${Object.keys(input).length} keys`);
