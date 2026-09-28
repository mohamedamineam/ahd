// Screenshots of every screen in Arabic/English × light/dark (brief §0.6), using the browser build and
// the mock backend. Usage:
//   npx vite --port 1420 &           (dev server)
//   node scripts/screenshots.mjs [--routes /,/settings] [--langs ar,en] [--themes light,dark]
//                                [--now 2026-09-30T14:12:40+01:00] [--out docs/screenshots] [--window main|widget|panel|pill|toast]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith('--') ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []),
);
const base = args.base ?? 'http://localhost:1420';
const routes = (args.routes ?? '/').split(',');
const langs = (args.langs ?? 'ar,en').split(',');
const themes = (args.themes ?? 'light,dark').split(',');
const now = args.now ?? '2026-09-30T14:12:40+01:00';
const out = args.out ?? 'docs/screenshots';
const windowKind = args.window ?? 'main';
const width = Number(args.width ?? (windowKind === 'main' ? 1120 : windowKind === 'panel' ? 300 : windowKind === 'toast' ? 360 : windowKind === 'pill' ? 170 : 320));
const height = Number(args.height ?? (windowKind === 'main' ? 740 : windowKind === 'panel' ? 420 : windowKind === 'toast' ? 150 : windowKind === 'pill' ? 34 : 360));
const extra = args.settings ? JSON.parse(args.settings) : {};
const onboarded = args.onboarded !== 'false';
const suffix = args.suffix ? `-${args.suffix}` : '';

const setif = {
  id: 'geonames:2481697',
  name: 'Sétif',
  nameAr: 'سطيف',
  admin1: 'Sétif',
  admin1Ar: 'سطيف',
  country: 'DZ',
  lat: 36.19112,
  lon: 5.41373,
  tz: 'Africa/Algiers',
  source: 'geonames',
};

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const lang of langs) {
  for (const theme of themes) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: Number(args.scale ?? 1), colorScheme: theme });
    const settings = {
      onboarding: { done: onboarded, step: 0 },
      general: { language: lang, digits: 'latn', monthStyle: 'maghreb' },
      appearance: { theme },
      location: { current: setif, tz: { kind: 'auto' } },
      calc: { method: 'algeria' },
      ...extra,
    };
    await ctx.addInitScript((s) => {
      localStorage.setItem('sakan:settings', JSON.stringify(s));
    }, settings);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error(`[pageerror] ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && console.error(`[console] ${m.text()}`));
    for (const route of routes) {
      const q = new URLSearchParams({ now });
      if (windowKind !== 'main') q.set('w', windowKind);
      await page.goto(`${base}/?${q}#${route}`);
      await page.waitForTimeout(Number(args.wait ?? 1400));
      const name = `${windowKind === 'main' ? '' : windowKind + '-'}${route.replace(/^\//, '').replace(/\//g, '-') || 'home'}-${lang}-${theme}${suffix}.png`;
      await page.screenshot({ path: join(out, name), fullPage: args.full === 'true' });
      console.log('saved', join(out, name));
    }
    await ctx.close();
  }
}
await browser.close();
