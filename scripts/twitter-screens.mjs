// The app screens used by scripts/twitter.mjs, from the browser build (mock backend):
//   npx vite --port 1420 &
//   node scripts/twitter-screens.mjs        → twitterpost/screens/*.png
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const out = join(root, 'twitterpost/screens');
const now = '2026-09-30T14:12:40+01:00';
const setif = { id: 'geonames:2481697', name: 'Sétif', nameAr: 'سطيف', admin1: 'Sétif', admin1Ar: 'سطيف', country: 'DZ', lat: 36.19112, lon: 5.41373, tz: 'Africa/Algiers', source: 'geonames' };

// [file, window, route, lang, theme, width, height, extra settings]
const shots = [];
for (const lang of ['en', 'ar']) {
  for (const theme of ['light', 'dark']) {
    for (const route of ['/', '/quran', '/qibla', '/timetable', '/adhkar', '/library']) shots.push([`${route.slice(1) || 'home'}-${lang}-${theme}`, 'main', route, lang, theme, 1200, 750, {}]);
    shots.push([`quran-warsh-${lang}-${theme}`, 'main', '/quran', lang, theme, 1200, 750, { quran: { riwaya: 'warsh' } }]);
    shots.push([`widget-classic-${lang}-${theme}`, 'widget', '/', lang, theme, 300, 448, { widgets: { main: { style: 'classic', size: 'L' } } }]);
    shots.push([`widget-panel-${lang}-${theme}`, 'widget', '/', lang, theme, 300, 520, { widgets: { main: { style: 'panel' } } }]);
    shots.push([`widget-wide-${lang}-${theme}`, 'widget', '/', lang, theme, 540, 176, { widgets: { main: { style: 'wide' } } }]);
    shots.push([`mini-${lang}-${theme}`, 'mini', '/', lang, theme, 320, 120, {}]);
    shots.push([`pill-${lang}-${theme}`, 'pill', '/', lang, theme, 170, 34, {}]);
  }
}

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const [name, w, route, lang, theme, width, height, extra] of shots) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: theme });
  const settings = {
    onboarding: { done: true, step: 0 },
    general: { language: lang, digits: 'latn', monthStyle: 'maghreb' },
    appearance: { theme },
    location: { current: setif, tz: { kind: 'auto' } },
    calc: { method: 'algeria' },
    ...extra,
  };
  await ctx.addInitScript((s) => localStorage.setItem('ahd:settings', JSON.stringify(s)), settings);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`[${name}] ${e.message}`));
  await page.bringToFront();
  const q = new URLSearchParams({ now });
  if (w !== 'main') q.set('w', w);
  await page.goto(`http://localhost:1420/?${q}#${route}`);
  // a widget gets the prayer times from the main window (BroadcastChannel of the mock backend)
  if (w !== 'main') {
    const main = await ctx.newPage();
    await main.goto(`http://localhost:1420/?now=${encodeURIComponent(now)}#/`);
  }
  await page.waitForTimeout(2200);
  await page.screenshot({ path: join(out, `${name}.png`), omitBackground: w !== 'main' });
  await ctx.close();
}
await browser.close();
console.log(`saved ${shots.length} screens in ${out}`);
