// Generates public/og.png (1200x630) — the social share image.
// Run: node scripts/generate-og.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, '..', 'public', 'og.png');

const FONT = "'Geist Variable','Segoe UI','Helvetica Neue',Arial,sans-serif";

const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="mark" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8e74ff"/>
      <stop offset="1" stop-color="#6a45e8"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="0%" r="80%">
      <stop offset="0" stop-color="#7a5af8" stop-opacity="0.28"/>
      <stop offset="60%" stop-color="#7a5af8" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="1.4" cy="1.4" r="1.4" fill="#ffffff" fill-opacity="0.035"/>
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="#0a0c11"/>
  <rect width="1200" height="630" fill="url(#dots)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="0.5" y="0.5" width="1199" height="629" fill="none" stroke="#242a37" stroke-width="1"/>

  <!-- Brand lockup -->
  <g transform="translate(80 72)">
    <rect x="0" y="0" width="52" height="52" rx="14" fill="url(#mark)"/>
    <g fill="#ffffff" transform="translate(26 26)">
      <rect x="-3.4" y="-15.5" width="6.8" height="31" rx="3.4"/>
      <rect x="-3.4" y="-15.5" width="6.8" height="31" rx="3.4" transform="rotate(60)"/>
      <rect x="-3.4" y="-15.5" width="6.8" height="31" rx="3.4" transform="rotate(120)"/>
    </g>
    <text x="68" y="35" font-family="${FONT}" font-size="30" font-weight="600" fill="#e7eaf1">Password<tspan fill="#7a5af8">ify</tspan></text>
  </g>

  <!-- Headline -->
  <g font-family="${FONT}" fill="#e7eaf1">
    <text x="78" y="300" font-size="82" font-weight="600" letter-spacing="-2">Make every password</text>
    <text x="78" y="392" font-size="82" font-weight="600" letter-spacing="-2" fill="#7a5af8">actually strong.</text>
  </g>

  <!-- Subhead -->
  <text x="80" y="470" font-family="${FONT}" font-size="30" font-weight="400" fill="#98a2b3">Strength analysis · Breach checking · Secure generation · Developer API</text>

  <!-- Footer row -->
  <text x="80" y="560" font-family="'Geist Mono Variable',ui-monospace,monospace" font-size="26" font-weight="500" fill="#7a5af8">passwordify.xyz</text>
  <g transform="translate(980 520)" font-family="'Geist Mono Variable',ui-monospace,monospace">
    <rect x="0" y="0" width="140" height="44" rx="10" fill="none" stroke="#242a37"/>
    <text x="70" y="29" font-size="20" fill="#98a2b3" text-anchor="middle">••••••••</text>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(out);
console.log('Wrote', out);
