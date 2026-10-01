// Store / social posters (1920×1080): the app on a laptop, with the name, a headline and the main features.
//   npx vite --port 1420 &   (not needed: the poster uses files only)
//   node scripts/poster.mjs                → branding/png/poster-en-1920x1080.png, poster-ar-1920x1080.png
// Screens: docs/screenshots/store-home-{en,ar}-light.png (node scripts/screenshots.mjs, 1200×750 at 1.6).
import { chromium } from '@playwright/test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = join(import.meta.dirname, '..');
const url = (p) => pathToFileURL(join(root, p)).href;
const logo = readFileSync(join(root, 'website/public/assets/img/logo-dark.svg'), 'utf8');

const TEXT = {
  en: {
    dir: 'ltr',
    name: '3ahd',
    other: 'عهد',
    title: 'Prayer times, adhan<br>and the Quran',
    sub: 'A calm companion for your prayers on Windows. Free, private, no ads.',
    features: ['Prayer times to the second', 'The adhan on time', 'Quran · Hafs and Warsh', 'Widgets and taskbar timer'],
    store: 'Free on the Microsoft Store',
    screen: 'docs/screenshots/store-home-en-light.png',
  },
  ar: {
    dir: 'rtl',
    name: 'عهد',
    other: '3ahd',
    title: 'مواقيت الصلاة والأذان<br>والقرآن الكريم',
    sub: 'رفيقك الهادئ لمواقيت الصلاة على ويندوز. مجاني، يحفظ خصوصيتك، بلا إعلانات.',
    features: ['مواقيت دقيقة بالثانية', 'الأذان في وقته', 'القرآن بروايتي حفص وورش', 'أدوات سطح المكتب والمؤقت'],
    store: 'مجانا على متجر مايكروسوفت',
    screen: 'docs/screenshots/store-home-ar-light.png',
  },
};

const html = (t) => `<!doctype html><html dir="${t.dir}"><head><meta charset="utf-8"><style>
@font-face { font-family: Changa; font-weight: 600; src: url(${url('website/public/assets/fonts/changa-arabic-600-normal.woff2')}); unicode-range: U+0600-06FF, U+FE70-FEFF; }
@font-face { font-family: Changa; font-weight: 600; src: url(${url('website/public/assets/fonts/changa-latin-600-normal.woff2')}); unicode-range: U+0000-024F, U+2000-206F; }
@font-face { font-family: Changa; font-weight: 500; src: url(${url('website/public/assets/fonts/changa-arabic-500-normal.woff2')}); unicode-range: U+0600-06FF, U+FE70-FEFF; }
@font-face { font-family: Changa; font-weight: 500; src: url(${url('website/public/assets/fonts/changa-latin-500-normal.woff2')}); unicode-range: U+0000-024F, U+2000-206F; }
@font-face { font-family: Plex; font-weight: 400; src: url(${url('website/public/assets/fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2')}); unicode-range: U+0600-06FF, U+FE70-FEFF; }
@font-face { font-family: Plex; font-weight: 400; src: url(${url('website/public/assets/fonts/ibm-plex-sans-latin-400-normal.woff2')}); unicode-range: U+0000-024F, U+2000-206F; }
@font-face { font-family: Plex; font-weight: 500; src: url(${url('website/public/assets/fonts/ibm-plex-sans-arabic-arabic-500-normal.woff2')}); unicode-range: U+0600-06FF, U+FE70-FEFF; }
@font-face { font-family: Plex; font-weight: 500; src: url(${url('website/public/assets/fonts/ibm-plex-sans-latin-500-normal.woff2')}); unicode-range: U+0000-024F, U+2000-206F; }
* { box-sizing: border-box; margin: 0; }
body { width: 1920px; height: 1080px; overflow: hidden; font-family: Plex, sans-serif; color: #f3ecdd;
  background:
    radial-gradient(900px 700px at ${t.dir === 'rtl' ? '22%' : '78%'} 48%, rgba(201,180,142,.22), transparent 70%),
    radial-gradient(1200px 900px at ${t.dir === 'rtl' ? '90%' : '10%'} 100%, #2c4a3a 0%, transparent 60%),
    linear-gradient(160deg, #1b2a22 0%, #121a16 100%); }
.pattern { position: absolute; inset: 0; opacity: .06; background-image: url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><g fill="none" stroke="#f3ecdd" stroke-width="1.4"><path d="M48 8 58 38 88 48 58 58 48 88 38 58 8 48 38 38Z"/><rect x="26" y="26" width="44" height="44" transform="rotate(45 48 48)"/></g></svg>')}"); }
.copy { position: absolute; top: 0; bottom: 0; ${t.dir === 'rtl' ? 'right' : 'left'}: 110px; width: 690px; display: flex; flex-direction: column; justify-content: center; }
.brand { display: flex; align-items: center; gap: 22px; }
.brand svg { width: 92px; height: 92px; }
.brand b { font: 600 76px/1 Changa, sans-serif; letter-spacing: .01em; }
.brand span { font: 500 34px/1 Changa, sans-serif; color: #c9b48e; margin-top: 10px; }
h1 { margin-top: 46px; font: 600 64px/1.18 Changa, sans-serif; }
.sub { margin-top: 26px; font-size: 27px; line-height: 1.55; color: #c8d3c6; max-width: 640px; }
ul { list-style: none; padding: 0; margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px 22px; }
li { display: flex; align-items: center; gap: 14px; font: 500 24px/1.3 Plex, sans-serif; color: #eae4d6; }
li::before { content: ''; flex: none; width: 12px; height: 12px; border-radius: 50%; background: #c9a35e; box-shadow: 0 0 0 5px rgba(201,163,94,.18); }
.store { margin-top: 52px; display: inline-flex; align-self: flex-start; align-items: center; gap: 16px; padding: 18px 30px; border-radius: 999px;
  background: #f3ecdd; color: #1b2a22; font: 600 26px/1 Changa, sans-serif; box-shadow: 0 14px 40px rgba(0,0,0,.35); }
.store svg { width: 30px; height: 30px; }
.device { position: absolute; top: 190px; ${t.dir === 'rtl' ? 'left' : 'right'}: 90px; width: 960px; perspective: 2600px; }
.lid { position: relative; transform: rotateY(${t.dir === 'rtl' ? '7deg' : '-7deg'}); transform-origin: ${t.dir === 'rtl' ? 'left' : 'right'} center;
  background: linear-gradient(180deg, #2a2f2c, #121513); border-radius: 26px; padding: 22px 22px 30px; box-shadow: 0 50px 120px rgba(0,0,0,.55), inset 0 0 0 2px #3a403c; }
.lid img { display: block; width: 100%; border-radius: 6px; }
.cam { position: absolute; top: 8px; left: 50%; width: 8px; height: 8px; margin-left: -4px; border-radius: 50%; background: #3d4541; }
.base { position: relative; height: 34px; margin: -2px -70px 0; border-radius: 0 0 26px 26px;
  background: linear-gradient(180deg, #d9dcd8 0%, #aeb3ae 55%, #7d837e 100%); box-shadow: 0 30px 60px rgba(0,0,0,.45); }
.base::before { content: ''; position: absolute; top: 0; left: 50%; width: 220px; height: 12px; margin-left: -110px; border-radius: 0 0 14px 14px; background: #9ba19b; }
.shadow { position: absolute; left: -60px; right: -60px; bottom: -70px; height: 60px; background: radial-gradient(closest-side, rgba(0,0,0,.5), transparent); }
</style></head><body><div class="pattern"></div>
<section class="copy">
  <div class="brand">${logo}<div><b>${t.name}</b><br><span>${t.other}</span></div></div>
  <h1>${t.title}</h1>
  <p class="sub">${t.sub}</p>
  <ul>${t.features.map((f) => `<li>${f}</li>`).join('')}</ul>
  <div class="store"><svg viewBox="0 0 24 24"><path fill="#f25022" d="M2 2h9.5v9.5H2z"/><path fill="#7fba00" d="M12.5 2H22v9.5h-9.5z"/><path fill="#00a4ef" d="M2 12.5h9.5V22H2z"/><path fill="#ffb900" d="M12.5 12.5H22V22h-9.5z"/></svg>${t.store}</div>
</section>
<div class="device"><div class="lid"><span class="cam"></span><img src="${url(t.screen)}"></div><div class="base"></div><div class="shadow"></div></div>
</body></html>`;

// loaded from a file, so the page may use the local fonts and screenshots
const dir = mkdtempSync(join(tmpdir(), 'ahd-poster-'));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
for (const [lang, t] of Object.entries(TEXT)) {
  const file = join(dir, `poster-${lang}.html`);
  writeFileSync(file, html(t));
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const out = join(root, `branding/png/poster-${lang}-1920x1080.png`);
  await page.screenshot({ path: out });
  console.log('saved', out);
}
await browser.close();
