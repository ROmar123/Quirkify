import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

// Purple "Q" on gradient background SVG
const svgIcon = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#F472B6"/>
      <stop offset="100%" style="stop-color:#A855F7"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#g)"/>
  <text
    x="50%" y="54%"
    dominant-baseline="middle"
    text-anchor="middle"
    font-family="Georgia, serif"
    font-weight="900"
    font-size="${size * 0.58}"
    fill="white"
    letter-spacing="-2"
  >Q</text>
</svg>
`;

const sizes = [192, 512];
for (const size of sizes) {
  const svg = Buffer.from(svgIcon(size));
  const out = path.join(outDir, `icon-${size}.png`);
  await sharp(svg).png().toFile(out);
  console.log(`Generated ${out}`);
}
console.log('Icons generated.');
