// Read the website's feedback messages on your computer (they are never readable from the site itself).
// Uses your Cloudflare login (npx wrangler login, once).
//   node comments.mjs            show the latest 50 messages
//   node comments.mjs --all      show all messages
//   node comments.mjs --csv      also save them to comments.csv (opens in LibreOffice or Excel)
//   node comments.mjs --delete 12   delete message number 12
//   add --local to use the local test database (wrangler pages dev) instead of Cloudflare
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const d1 = (sql) =>
  JSON.parse(execFileSync('npx', ['wrangler', 'd1', 'execute', 'ahd-comments', args.includes('--local') ? '--local' : '--remote', '--json', '--command', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }))[0].results;

const del = args.indexOf('--delete');
if (del !== -1) {
  const id = Number(args[del + 1]);
  if (!Number.isInteger(id) || id <= 0) throw new Error('usage: node comments.mjs --delete <number>');
  d1(`DELETE FROM comments WHERE id = ${id}`);
  console.log(`message ${id} deleted`);
  process.exit(0);
}

const rows = d1(`SELECT id, created_at, kind, name, email, message, lang, country FROM comments ORDER BY id DESC${args.includes('--all') ? '' : ' LIMIT 50'}`);
const KIND = { suggestion: 'اقتراح / suggestion', problem: 'مشكلة / problem', thanks: 'شكر / thanks' };
for (const r of rows.slice().reverse()) {
  console.log(`\n#${r.id}  ${r.created_at} UTC  ${KIND[r.kind] ?? r.kind}  ${[r.name, r.email, r.country].filter(Boolean).join('  ')}`);
  console.log(r.message);
}
console.log(`\n${rows.length} message(s)`);
if (args.includes('--csv')) {
  const cols = ['id', 'created_at', 'kind', 'name', 'email', 'country', 'lang', 'message'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  writeFileSync('comments.csv', '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n'));
  console.log('saved comments.csv');
}
