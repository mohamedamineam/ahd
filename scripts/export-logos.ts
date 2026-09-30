// PNG exports of the brand for stores, GitHub and anywhere a file upload is needed → branding/png/
//   node scripts/export-logos.ts
// Sources: branding/*.svg (built from the owner's mark by scripts/build-icons.ts). Text uses Noto Kufi Arabic
// (system font on most Linux distributions; set AHD_FONT=/path/to/font.ttf to use another).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const root = join(import.meta.dirname, '..');
const out = join(root, 'branding/png');
mkdirSync(out, { recursive: true });
const svg = (name: string) => readFileSync(join(root, 'branding', name), 'utf8');

const fontFiles = [
  process.env.AHD_FONT,
  '/usr/share/fonts/truetype/noto/NotoKufiArabic-Bold.ttf',
  '/usr/share/fonts/truetype/noto/NotoKufiArabic-Regular.ttf',
  '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
].filter(
  (f): f is string => !!f && existsSync(f),
);

function png(source: string, file: string, width: number) {
  const r = new Resvg(source, { fitTo: { mode: 'width', value: width }, font: { fontFiles, loadSystemFonts: fontFiles.length === 0 } });
  writeFileSync(join(out, file), r.render().asPng());
  console.log(`${file}  ${width}px`);
}

/** The mark's inner SVG (paths + gradient defs), to place inside a larger composition. */
function markInner(name: string): { defs: string; body: string } {
  const s = svg(name);
  const defs = /<defs>([\s\S]*?)<\/defs>/.exec(s)?.[1] ?? '';
  const body = s
    .replace(/<\?xml[^>]*>/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<defs>[\s\S]*?<\/defs>/, '');
  return { defs, body };
}

// 1. transparent logos and app icon tiles
for (const w of [256, 512, 1024]) png(svg('logo.svg'), `logo-${w}.png`, w);
png(svg('logo-dark.svg'), 'logo-for-dark-backgrounds-1024.png', 1024);
png(svg('logo-mono.svg'), 'logo-black-1024.png', 1024);
for (const w of [300, 512, 1024]) png(svg('app-icon.svg'), `app-icon-${w}.png`, w);
png(svg('app-icon-light.svg'), 'app-icon-light-1024.png', 1024);

// 2. compositions with the name (dark sage background, the gold-and-sage mark for dark backgrounds)
const mark = markInner('logo-dark.svg');
const bg = `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#29493A"/><stop offset="1" stop-color="#16271E"/></linearGradient>`;
const place = (x: number, y: number, h: number) => `<g transform="translate(${x} ${y}) scale(${h / 207})">${mark.body}</g>`;

function composition(w: number, h: number, content: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${bg}${mark.defs}</defs><rect width="${w}" height="${h}" fill="url(#bg)"/>${content}</svg>`;
}
const text = (x: number, y: number, size: number, s: string, fill: string, weight = 700, anchor = 'middle') =>
  `<text x="${x}" y="${y}" font-family="${/[a-z]/i.test(s) ? 'Noto Sans' : 'Noto Kufi Arabic'}" font-weight="${weight}" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${s}</text>`;

// Microsoft Store: 1:1 box art (1080×1080) and 2:3 poster art (720×1080)
png(composition(1080, 1080, place(540 - 153 * 1.35, 150, 207 * 2.7) + text(540, 900, 140, 'عهد', '#F3ECDD')), 'store-box-art-1080.png', 1080);
png(
  composition(720, 1080, place(360 - 153 * 1.1, 190, 207 * 2.2) + text(360, 800, 120, 'عهد', '#F3ECDD') + text(360, 880, 40, '3ahd', '#C9B48E', 400)),
  'store-poster-720x1080.png',
  720,
);
// GitHub social preview (Settings → Social preview): 1280×640
png(
  composition(
    1280,
    640,
    place(160, 150, 340) +
      text(1130, 320, 150, 'عهد', '#F3ECDD', 700, 'end') +
      text(1130, 410, 44, 'مواقيت الصلاة والأذان والقرآن', '#C9B48E', 400, 'end') +
      text(1130, 480, 38, '3ahd — prayer times, adhan, Quran', '#9FB8A4', 400, 'end'),
  ),
  'github-social-preview-1280x640.png',
  1280,
);
