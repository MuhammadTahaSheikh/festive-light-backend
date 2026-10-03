/**
 * Postcard overlay art for lighting1–3.
 * Waves, QR frame, and mascots come from client/public/elements.
 * The wordmark is still drawn here (no logo file in that folder).
 * Run: node scripts/generate-postcard-art.js
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'postcard-art');
const ELEMENTS = path.join(ROOT, 'client', 'public', 'elements');

const NAVY = '#1B2E5B';
const ORANGE = '#F29121';

fs.mkdirSync(OUT, { recursive: true });

function svgToPng(svg, file, width, height) {
  return sharp(Buffer.from(svg))
    .ensureAlpha()
    .png()
    .resize(width, height)
    .toFile(path.join(OUT, file));
}

const logoSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="980" height="360" viewBox="0 0 980 360">
  <rect width="980" height="360" fill="#ffffff"/>
  <rect x="40" y="18" width="900" height="230" rx="10" fill="#ffffff" stroke="${NAVY}" stroke-width="8"/>
  <text x="490" y="148" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="108" font-weight="700" fill="${ORANGE}" letter-spacing="6">FESTIVE</text>
  <circle cx="546" cy="58" r="13" fill="${ORANGE}"/>
  <path d="M546 72 v22" stroke="${ORANGE}" stroke-width="7" stroke-linecap="round"/>
  <text x="900" y="48" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="${NAVY}">®</text>
  <text x="490" y="210" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="600" fill="${NAVY}" letter-spacing="14">LIGHTING PROS</text>
  <text x="490" y="310" text-anchor="middle" font-family="Georgia, Times, serif" font-size="28" font-style="italic" fill="#7a8899">Illumineers Creating Wonder®</text>
</svg>`;

const UPLOADED = {
  '1.png': 'back-wave-qr-right.png',
  '2.png': 'back-wave-qr-left.png',
  '3.png': 'front-caption-wave.png',
  'QR.png': 'qr-card.png',
  'FEstivo 1.png': 'mascot.png',
  'FEstivo 2.png': 'mascot-welcome.png',
};

await svgToPng(logoSvg, 'logo-wordmark.png', 980, 360);

for (const [from, to] of Object.entries(UPLOADED)) {
  const src = path.join(ELEMENTS, from);
  if (!fs.existsSync(src)) throw new Error(`Missing postcard element: ${src}`);
  fs.copyFileSync(src, path.join(OUT, to));
}

console.log('Wrote', fs.readdirSync(OUT).join(', '));
