/**
 * Capture Chrome Web Store assets from HTML mockups.
 * Screenshots: 1280x800 JPEG (no alpha)
 * Marquee: 1400x560 JPEG (no alpha)
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname; // store-assets/
const outDir = path.join(root, 'out');
const mock = pathToFileURL(path.join(root, 'src', 'mock.html')).href;

const only = process.argv[2];
const shots = [
  { scene: 'overview', file: 'screenshot-01-overview.jpg', w: 1280, h: 800 },
  { scene: 'search', file: 'screenshot-02-search.jpg', w: 1280, h: 800 },
  { scene: 'magic', file: 'screenshot-03-arrange.jpg', w: 1280, h: 800 },
  { scene: 'dark', file: 'screenshot-04-dark.jpg', w: 1280, h: 800 },
  { scene: 'i18n', file: 'screenshot-05-i18n.jpg', w: 1280, h: 800 },
  { scene: 'home', file: 'screenshot-06-home.jpg', w: 1280, h: 800 },
  { scene: 'marquee', file: 'marquee-1400x560.jpg', w: 1400, h: 560 },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  deviceScaleFactor: 1,
});

const selected = only ? shots.filter((shot) => shot.scene === only || shot.file.includes(only)) : shots;
if (!selected.length) {
  console.error('no scene matched', only);
  process.exit(1);
}

for (const shot of selected) {
  await page.setViewportSize({ width: shot.w, height: shot.h });
  await page.goto(`${mock}?scene=${shot.scene}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(120);
  const buf = await page.screenshot({
    type: 'jpeg',
    quality: 92,
    omitBackground: false,
    clip: { x: 0, y: 0, width: shot.w, height: shot.h },
  });
  const dest = path.join(outDir, shot.file);
  await writeFile(dest, buf);
  console.log('wrote', dest, buf.length, 'bytes');
}

await browser.close();
console.log('done →', outDir);
