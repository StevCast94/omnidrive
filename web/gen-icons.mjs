const sharp = require('sharp');
const path = require('path');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#1e1b4b"/>
  <circle cx="256" cy="220" r="80" fill="none" stroke="#818cf8" stroke-width="20"/>
  <rect x="156" y="280" width="200" height="140" rx="20" fill="none" stroke="#818cf8" stroke-width="16"/>
  <circle cx="190" cy="380" r="14" fill="#818cf8"/>
  <circle cx="322" cy="380" r="14" fill="#818cf8"/>
  <path d="M256 180 L256 220 L280 240" fill="none" stroke="#a78bfa" stroke-width="12" stroke-linecap="round"/>
</svg>`;

async function gen() {
  const dir = 'C:\\Users\\Admin\\Desktop\\omnidrive-new\\web\\public\\icons';
  for (const size of [192, 512]) {
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(dir, `icon-${size}.png`));
    console.log(`Created icon-${size}.png`);
  }
}

gen().catch(console.error);
