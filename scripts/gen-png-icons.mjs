// Optional: regenerate PNG fallbacks from the SVG masters for older Android
// installs that still prefer raster icons in the manifest.
//
//   1. `npm i -D sharp`
//   2. `node scripts/gen-png-icons.mjs`
//
// Reads public/icons/icon.svg and public/icons/maskable.svg, writes:
//   icon-192.png, icon-512.png, maskable-512.png
//
// Skip this step entirely on Chrome 96+ — SVG manifest icons are supported.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ICONS = resolve(ROOT, 'public/icons');

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error('sharp is not installed. Run: npm i -D sharp');
  process.exit(1);
}

async function render(svgPath, outPath, size) {
  const svg = await readFile(svgPath);
  await mkdir(dirname(outPath), { recursive: true });
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(outPath);
  console.log('  ✓', outPath.replace(ROOT + '/', ''));
}

console.log('Rendering PNG icons…');
await render(resolve(ICONS, 'icon.svg'),     resolve(ICONS, 'icon-192.png'),     192);
await render(resolve(ICONS, 'icon.svg'),     resolve(ICONS, 'icon-512.png'),     512);
await render(resolve(ICONS, 'maskable.svg'), resolve(ICONS, 'maskable-512.png'), 512);
console.log('Done.');
