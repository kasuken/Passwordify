// Generates the raster icons from public/favicon.svg:
//   public/favicon.ico        (16/32/48 px, PNG-encoded ICO)
//   public/apple-touch-icon.png (180x180, full-bleed - iOS applies its own mask)
// Run: node scripts/generate-icons.mjs
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const svg = readFileSync(join(root, 'favicon.svg'));

// Apple touch icons must be opaque; render the mark over a full-bleed gradient.
const fullBleed = Buffer.from(
  readFileSync(join(root, 'favicon.svg'), 'utf8').replace(
    /<rect x="2" y="2" width="60" height="60" rx="16" fill="url\(#g\)"\/>/,
    '<rect x="0" y="0" width="64" height="64" fill="url(#g)"/>'
  )
);
await sharp(fullBleed, { density: 576 }).resize(180, 180).png().toFile(join(root, 'apple-touch-icon.png'));

const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map((s) => sharp(svg, { density: 576 }).resize(s, s).png().toBuffer()));

// ICO container: ICONDIR + ICONDIRENTRY[] + PNG payloads.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);
let offset = 6 + 16 * pngs.length;
const entries = pngs.map((png, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(sizes[i], 0);
  e.writeUInt8(sizes[i], 1);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(png.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += png.length;
  return e;
});
writeFileSync(join(root, 'favicon.ico'), Buffer.concat([header, ...entries, ...pngs]));
console.log('wrote favicon.ico and apple-touch-icon.png');
