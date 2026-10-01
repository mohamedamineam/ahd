// Images for announcing the app on X/Twitter (1200×675 at 2×, so 2400×1350): the announcement and a thread of four.
//   node scripts/twitter-screens.mjs   (once, with `npx vite --port 1420` running) → twitterpost/screens
//   node scripts/twitter.mjs           → twitterpost/{en,ar}/1-announcement.png … 5-and-more.png
// The texts for the posts are in twitterpost/captions.md.
import { chromium } from '@playwright/test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = join(import.meta.dirname, '..');
const url = (p) => pathToFileURL(join(root, p)).href;
const screen = (name) => url(`twitterpost/screens/${name}.png`);
const LINK = '3ahd.pages.dev';
const MS = '<svg class="ms" viewBox="0 0 24 24"><path fill="#f25022" d="M2 2h9.5v9.5H2z"/><path fill="#7fba00" d="M12.5 2H22v9.5h-9.5z"/><path fill="#00a4ef" d="M2 12.5h9.5V22H2z"/><path fill="#ffb900" d="M12.5 12.5H22V22h-9.5z"/></svg>';
const ARROW = '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

const T = {
  en: {
    dir: 'ltr', name: '3ahd', other: 'عهد',
    chip: 'Now on the Microsoft Store',
    h1: 'Prayer times, adhan and the Quran, <em>on your computer.</em>',
    sub: 'Free, works offline, no ads, no accounts. For Windows and Linux.',
    alsoStore: 'Also on the Microsoft Store',
    prayer: { kicker: 'Prayer times & adhan', title: 'Times you can trust, an adhan you won’t miss',
      points: ['Any city in the world, offline, with every common calculation method', 'Fine-tune each prayer to the second to match your mosque', 'A separate Fajr adhan, then the dua after the adhan', 'A monthly timetable you can export to PDF or CSV'] },
    quran: { kicker: 'The Quran', title: 'The Quran in Hafs and Warsh',
      points: ['The King Fahd Complex script, page by page', 'Warsh in Eastern or Maghrebi writing', 'Search, bookmarks and your last-read page'] },
    desktop: { kicker: 'On your desktop', title: 'Always in sight, never in the way',
      points: ['A main widget in three styles, light or dark', 'A small widget that can stay above your apps', 'The countdown next to the clock on the taskbar', 'A reminder 10 minutes before each prayer'] },
    more: { kicker: 'And more', title: 'Adhkar, qibla and a library, all private',
      points: ['Morning and evening adhkar from Hisn al-Muslim, with a counter', 'The qibla, and the moments the sun lines up with it', 'Free books, read inside the app'],
      chips: ['Free', 'Works offline', 'No ads', 'No accounts', 'Open source'] },
    clock: ['14:12', '30/09/2026'],
    moreShots: ['qibla-en-dark', 'library-en-light'],
  },
  ar: {
    dir: 'rtl', name: 'عهد', other: '3ahd',
    chip: 'متوفر الآن على متجر مايكروسوفت',
    h1: 'مواقيت الصلاة والأذان والقرآن الكريم، <em>على حاسوبك.</em>',
    sub: 'مجاني، يعمل دون إنترنت، بلا إعلانات ولا حسابات. لويندوز ولينكس.',
    alsoStore: 'وعلى متجر مايكروسوفت',
    prayer: { kicker: 'المواقيت والأذان', title: 'مواقيت تثق بها، وأذان لا يفوتك',
      points: ['لأي مدينة في العالم دون إنترنت، بكل طرق الحساب المعروفة', 'ضبط كل صلاة بالثواني لتطابق مسجدك', 'أذان خاص بالفجر، ثم دعاء ما بعد الأذان', 'جدول شهري يمكنك تصديره بصيغة PDF أو CSV'] },
    quran: { kicker: 'القرآن الكريم', title: 'القرآن الكريم بروايتي حفص وورش',
      points: ['بخط مجمع الملك فهد، صفحة بصفحة', 'ورش بالخط المشرقي أو المغربي', 'البحث والعلامات وحفظ موضع القراءة'] },
    desktop: { kicker: 'على سطح المكتب', title: 'أمام عينيك دائما، دون أن يزعجك',
      points: ['أداة رئيسية بثلاثة أشكال، فاتحة أو داكنة', 'أداة مصغرة تبقى فوق التطبيقات', 'المؤقت بجانب الساعة في شريط المهام', 'تذكير قبل كل صلاة بعشر دقائق'] },
    more: { kicker: 'والمزيد', title: 'الأذكار والقبلة ومكتبة، وخصوصيتك محفوظة',
      points: ['أذكار الصباح والمساء من حصن المسلم، مع عداد', 'اتجاه القبلة، والأوقات التي تكون فيها الشمس على خطها', 'كتب مجانية تقرأ داخل التطبيق'],
      chips: ['مجاني', 'يعمل دون إنترنت', 'بلا إعلانات', 'بلا حسابات', 'مفتوح المصدر'] },
    clock: ['14:12', '30/09/2026'],
    moreShots: ['qibla-ar-dark', 'adhkar-ar-light'],
  },
};

const fonts = [
  ['Changa', 500, 'changa-arabic-500-normal', 'U+0600-06FF, U+FE70-FEFF'], ['Changa', 500, 'changa-latin-500-normal', 'U+0000-024F, U+2000-206F'],
  ['Changa', 600, 'changa-arabic-600-normal', 'U+0600-06FF, U+FE70-FEFF'], ['Changa', 600, 'changa-latin-600-normal', 'U+0000-024F, U+2000-206F'],
  ['Plex', 400, 'ibm-plex-sans-arabic-arabic-400-normal', 'U+0600-06FF, U+FE70-FEFF'], ['Plex', 400, 'ibm-plex-sans-latin-400-normal', 'U+0000-024F, U+2000-206F'],
  ['Plex', 500, 'ibm-plex-sans-arabic-arabic-500-normal', 'U+0600-06FF, U+FE70-FEFF'], ['Plex', 500, 'ibm-plex-sans-latin-500-normal', 'U+0000-024F, U+2000-206F'],
  ['Plex', 600, 'ibm-plex-sans-arabic-arabic-600-normal', 'U+0600-06FF, U+FE70-FEFF'], ['Plex', 600, 'ibm-plex-sans-latin-600-normal', 'U+0000-024F, U+2000-206F'],
].map(([f, w, file, range]) => `@font-face { font-family: ${f}; font-weight: ${w}; src: url(${url(`website/public/assets/fonts/${file}.woff2`)}); unicode-range: ${range}; }`).join('\n');

const star = (color) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="84" height="84" viewBox="0 0 96 96"><g fill="none" stroke="${color}" stroke-width="1.3"><path d="M48 8 58 38 88 48 58 58 48 88 38 58 8 48 38 38Z"/><rect x="26" y="26" width="44" height="44" transform="rotate(45 48 48)"/></g></svg>`)}")`;

const css = (t) => `${fonts}
:root { --cream: #f4efe4; --cream-2: #e9e1cf; --ink: #1b2a22; --muted: #56655b; --dark: #141d18; --dark-2: #1e2c25; --sage: #3f7255; --gold: #c9a35e; --gold-2: #e2c48a; --s: ${t.dir === 'rtl' ? -1 : 1}; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1200px; height: 675px; overflow: hidden; }
body { position: relative; font-family: Plex, sans-serif; color: var(--ink); background: var(--cream); }
body.dark { color: #f1ebdd; background: radial-gradient(700px 500px at ${t.dir === 'rtl' ? '85%' : '15%'} 0%, #26402f 0%, transparent 70%), linear-gradient(160deg, #1b2a22, #121a16); }
.pattern { position: absolute; inset: 0; background-image: ${star('#1b2a22')}; opacity: .05; }
body.dark .pattern, .panel.dark .pattern { background-image: ${star('#f3ecdd')}; opacity: .06; }
.panel { position: absolute; top: 28px; bottom: 28px; inset-inline-end: 28px; width: 560px; border-radius: 30px; overflow: hidden; }
.panel.dark { background: radial-gradient(520px 420px at 50% 40%, rgba(201,163,94,.20), transparent 70%), linear-gradient(160deg, #22382c, #131b17); box-shadow: 0 30px 70px -30px rgba(20,29,24,.7); }
.panel.light { background: radial-gradient(520px 420px at 50% 40%, rgba(201,163,94,.22), transparent 70%), linear-gradient(160deg, #f6f1e6, #e7dfcc); box-shadow: 0 30px 70px -20px rgba(0,0,0,.6); }
.panel.light .pattern { opacity: .06; }
.win { position: absolute; border-radius: 12px; overflow: hidden; box-shadow: 0 28px 60px -18px rgba(0,0,0,.55), 0 0 0 1px rgba(0,0,0,.10); }
.win img, img.widget { display: block; width: 100%; }
img.widget { position: absolute; filter: drop-shadow(0 18px 30px rgba(0,0,0,.35)); }
.copy { position: absolute; top: 0; bottom: 0; inset-inline-start: 64px; width: 455px; display: flex; flex-direction: column; justify-content: center; }
.brand { display: flex; align-items: center; gap: 14px; }
.brand img { height: 58px; }
.brand b { font: 600 40px/1 Changa, sans-serif; }
.brand span { display: block; font: 500 19px/1 Changa, sans-serif; color: var(--gold); margin-top: 6px; }
.chip { align-self: flex-start; display: inline-flex; align-items: center; gap: 9px; padding: 7px 14px; border-radius: 999px; font: 500 15px/1.2 Plex, sans-serif; background: rgba(63,114,85,.10); border: 1px solid rgba(63,114,85,.25); color: #2c523d; }
.chip .ms { width: 15px; height: 15px; }
h1 { font: 600 40px/1.2 Changa, sans-serif; letter-spacing: -.005em; margin-top: 26px; text-wrap: balance; }
h1 em { font-style: normal; background: linear-gradient(100deg, #2c5a40, #b08a45); -webkit-background-clip: text; background-clip: text; color: transparent; }
.sub { margin-top: 18px; font-size: 18px; line-height: 1.6; color: var(--muted); max-width: 440px; }
.cta { margin-top: 30px; display: flex; flex-direction: column; align-items: flex-start; gap: 14px; }
.link { display: inline-flex; align-items: center; gap: 12px; padding: 15px 26px; border-radius: 16px; background: linear-gradient(135deg, #2f5a43, #1d3a2c); color: #f6f1e6; font: 600 25px/1 Changa, sans-serif; box-shadow: 0 16px 34px -14px rgba(29,58,44,.9); }
.link .arrow { width: 24px; height: 24px; color: var(--gold-2); transform: scaleX(var(--s)); }
.also { display: inline-flex; align-items: center; gap: 8px; font: 500 15px/1.3 Plex, sans-serif; color: var(--muted); }
.also .ms { width: 18px; height: 18px; }
/* thread */
.num { display: inline-flex; align-items: center; gap: 10px; font: 600 15px/1 Plex, sans-serif; color: var(--gold); letter-spacing: .04em; text-transform: uppercase; }
.num i { font-style: normal; padding: 6px 10px; border-radius: 999px; background: rgba(201,163,94,.16); color: #9a7536; letter-spacing: 0; }
body.dark .num i { color: var(--gold-2); }
h2 { font: 600 36px/1.22 Changa, sans-serif; margin-top: 18px; text-wrap: balance; }
ul { list-style: none; margin-top: 24px; display: grid; gap: 13px; }
li { display: flex; gap: 12px; align-items: baseline; font-size: 17px; line-height: 1.5; color: var(--muted); }
body.dark li { color: #c9d3c8; }
li::before { content: ''; flex: none; width: 9px; height: 9px; border-radius: 50%; background: var(--gold); box-shadow: 0 0 0 4px rgba(201,163,94,.18); transform: translateY(-2px); }
.foot { position: absolute; bottom: 30px; inset-inline-start: 64px; display: flex; align-items: center; gap: 10px; font: 600 16px/1 Changa, sans-serif; }
.foot img { height: 26px; }
.foot span { font: 500 15px/1 Plex, sans-serif; color: var(--muted); }
.foot i { font-style: normal; color: var(--muted); }
body.dark .foot span, body.dark .foot i { color: #aebbb0; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 26px; }
.chips b { font: 500 13.5px/1 Plex, sans-serif; padding: 8px 12px; border-radius: 999px; border: 1px solid rgba(243,236,221,.22); color: #f1ebdd; background: rgba(243,236,221,.06); }
/* desktop scene */
.desk { position: absolute; inset: 0; background: radial-gradient(420px 320px at 70% 25%, rgba(226,196,138,.35), transparent 70%), radial-gradient(500px 400px at 20% 90%, rgba(63,114,85,.55), transparent 70%), linear-gradient(160deg, #2f4a3b, #18241e); }
.taskbar { position: absolute; left: 0; right: 0; bottom: 0; height: 46px; padding-left: 16px; background: rgba(20,26,23,.82); backdrop-filter: blur(10px); border-top: 1px solid rgba(255,255,255,.08); display: flex; align-items: center; gap: 10px; direction: ltr; }
.taskbar i { width: 26px; height: 26px; border-radius: 7px; background: rgba(255,255,255,.14); }
.taskbar i:first-child { background: linear-gradient(135deg, #4aa3df, #2b6cb0); }
.taskbar img { position: absolute; right: 100px; top: 8px; height: 30px; }
.taskbar .clock { position: absolute; right: 16px; top: 8px; text-align: right; font: 500 11px/1.35 Plex, sans-serif; color: #e8e8e8; }
`;

const page = (t, body, cls = '') => `<!doctype html><html dir="${t.dir}" lang="${t.dir === 'rtl' ? 'ar' : 'en'}"><head><meta charset="utf-8"><style>${css(t)}</style></head><body class="${cls}"><div class="pattern"></div>${body}</body></html>`;
const logo = (dark) => `<img src="${url(`website/public/assets/img/${dark ? 'logo-dark' : 'logo'}.svg`)}" alt="">`;
// a window placed from the end edge (mirrored for Arabic), with a slight tilt
const win = (shot, { top, end, width, tilt = 0, z = 1 }) =>
  `<div class="win" style="top:${top}px; inset-inline-end:${end}px; width:${width}px; z-index:${z}; transform: rotate(calc(var(--s) * ${tilt}deg))"><img src="${screen(shot)}"></div>`;
const foot = (t, dark) => `<div class="foot">${logo(dark)}<b>${t.name}</b><i>·</i><span dir="ltr">${LINK}</span></div>`;
const thread = (t, part, n, dark) => `
  <section class="copy" style="justify-content:flex-start; padding-top:78px">
    <div class="num"><i>${n}/4</i>${part.kicker}</div>
    <h2>${part.title}</h2>
    <ul>${part.points.map((p) => `<li>${p}</li>`).join('')}</ul>
    ${part.chips ? `<div class="chips">${part.chips.map((c) => `<b>${c}</b>`).join('')}</div>` : ''}
  </section>${foot(t, dark)}`;

const L = (t) => t.dir === 'rtl' ? 'ar' : 'en';
const IMAGES = {
  '1-announcement': (t) => page(t, `
    <div class="panel dark"><div class="pattern"></div></div>
    ${win(`quran-${L(t)}-dark`, { top: 58, end: 56, width: 470, tilt: 2, z: 1 })}
    ${win(`home-${L(t)}-light`, { top: 292, end: 170, width: 450, tilt: -2, z: 2 })}
    <img class="widget" src="${screen(`mini-${L(t)}-dark`)}" style="width:210px; bottom:44px; inset-inline-end:40px; z-index:3">
    <section class="copy">
      <div class="brand">${logo(false)}<div><b>${t.name}</b><span>${t.other}</span></div></div>
      <h1>${t.h1}</h1>
      <p class="sub">${t.sub}</p>
      <div class="cta"><div class="link"><span dir="ltr">${LINK}</span>${ARROW}</div><div class="also">${MS}${t.alsoStore}</div></div>
    </section>`),
  '2-prayer-times': (t) => page(t, `
    <div class="panel dark"><div class="pattern"></div></div>
    ${win(`home-${L(t)}-dark`, { top: 58, end: 56, width: 470, tilt: 0, z: 1 })}
    ${win(`timetable-${L(t)}-light`, { top: 300, end: 170, width: 440, tilt: -2.5, z: 2 })}
    ${thread(t, t.prayer, 1, false)}`),
  '3-quran': (t) => page(t, `
    <div class="panel light"><div class="pattern"></div></div>
    ${win(`quran-${L(t)}-dark`, { top: 58, end: 56, width: 470, tilt: 0, z: 1 })}
    ${win(`quran-warsh-${L(t)}-light`, { top: 300, end: 170, width: 440, tilt: -2.5, z: 2 })}
    ${thread(t, t.quran, 2, true)}`, 'dark'),
  '4-desktop': (t) => page(t, `
    <div class="panel" style="width:600px"><div class="desk"></div>
      <img class="widget" src="${screen(`widget-wide-${L(t)}-light`)}" style="width:440px; top:32px; inset-inline-end:40px">
      <img class="widget" src="${screen(`widget-panel-${L(t)}-dark`)}" style="width:210px; top:200px; inset-inline-start:40px">
      <img class="widget" src="${screen(`mini-${L(t)}-light`)}" style="width:240px; top:250px; inset-inline-end:48px">
      <div class="taskbar"><i></i><i></i><i></i><i></i><i></i><img src="${screen(`pill-${L(t)}-dark`)}"><div class="clock">${t.clock[0]}<br>${t.clock[1]}</div></div>
    </div>
    ${thread(t, t.desktop, 3, false)}`),
  '5-and-more': (t) => page(t, `
    <div class="panel light"><div class="pattern"></div></div>
    ${win(t.moreShots[0], { top: 58, end: 56, width: 470, tilt: 0, z: 1 })}
    ${win(t.moreShots[1], { top: 300, end: 170, width: 440, tilt: -2.5, z: 2 })}
    ${thread(t, t.more, 4, true)}`, 'dark'),
};

const only = process.argv[2];
const dir = mkdtempSync(join(tmpdir(), 'ahd-twitter-'));
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 2 });
for (const lang of ['en', 'ar']) {
  mkdirSync(join(root, 'twitterpost', lang), { recursive: true });
  for (const [name, make] of Object.entries(IMAGES)) {
    if (only && !name.startsWith(only)) continue;
    const file = join(dir, `${lang}-${name}.html`);
    writeFileSync(file, make(T[lang]));
    await tab.goto(pathToFileURL(file).href, { waitUntil: 'load' });
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(200);
    const out = join(root, 'twitterpost', lang, `${name}.png`);
    await tab.screenshot({ path: out });
    console.log('saved', out);
  }
}
await browser.close();
