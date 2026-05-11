/**
 * OmniDrive — Asset Generator
 * Ejecutar: node scripts/generate-assets.mjs
 *
 * Genera todos los PNG/SVG necesarios para PWA, SEO y UI.
 * Requiere: npm install -D sharp
 */

import sharp from 'sharp';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..');
const ICONS = join(ROOT, 'public', 'icons');
const PUB   = join(ROOT, 'public');

// Ensure dirs exist
[ICONS, PUB].forEach(d => { if (!existsSync(d)) mkdirSync(d, { recursive: true }); });

// ── Palette ──────────────────────────────────────────────────
const BG       = '#0f172a';   // slate-950
const CYAN     = '#06b6d4';   // cyan-500
const CYAN_DIM = '#0891b2';   // cyan-600
const WHITE    = '#ffffff';
const SLATE    = '#1e293b';   // slate-800

// ─────────────────────────────────────────────────────────────
// SVG BUILDERS
// ─────────────────────────────────────────────────────────────

/**
 * Steering wheel path — drawn on a square canvas of `size`.
 * Center: (cx, cy). Outer radius: r. Hub radius: hr.
 */
function steeringWheelSvg({ size = 512, cx, cy, r, hr, stroke, strokeW } = {}) {
  cx = cx ?? size / 2;
  cy = cy ?? size / 2;
  r  = r  ?? size * 0.38;
  hr = hr ?? size * 0.08;
  stroke  = stroke  ?? CYAN;
  strokeW = strokeW ?? size * 0.055;

  const sw2 = strokeW / 2;
  const ir  = r - strokeW; // inner edge of rim

  // Three spokes at 90°, 210°, 330° (classic 3-spoke wheel)
  const spokeAngles = [90, 210, 330];
  const spokes = spokeAngles.map(deg => {
    const rad = (deg - 90) * Math.PI / 180;
    const x1  = cx + hr * Math.cos(rad);
    const y1  = cy + hr * Math.sin(rad);
    const x2  = cx + ir * Math.cos(rad);
    const y2  = cy + ir * Math.sin(rad);
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}"
                  x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"
                  stroke="${stroke}" stroke-width="${strokeW.toFixed(2)}"
                  stroke-linecap="round"/>`;
  }).join('\n    ');

  return `
  <!-- Outer rim -->
  <circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}"
          fill="none" stroke="${stroke}" stroke-width="${strokeW.toFixed(2)}"/>
  <!-- Hub -->
  <circle cx="${cx}" cy="${cy}" r="${hr.toFixed(2)}" fill="${stroke}"/>
  <!-- Spokes -->
  ${spokes}`;
}

// ─────────────────────────────────────────────────────────────
// 1. logo.svg  (240 × 48 — horizontal lockup)
// ─────────────────────────────────────────────────────────────
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 240 48" width="240" height="48">
  <!-- Icon mark -->
  <rect width="48" height="48" rx="12" fill="${CYAN}"/>
  ${steeringWheelSvg({ size: 48, r: 18, hr: 4, stroke: BG, strokeW: 3.5 })}
  <!-- Wordmark -->
  <text x="60" y="33"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        font-size="24" font-weight="700" fill="${WHITE}" letter-spacing="-0.5">Omni</text>
  <text x="117" y="33"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        font-size="24" font-weight="700" fill="${CYAN}" letter-spacing="-0.5">Drive</text>
</svg>`;

writeFileSync(join(PUB, 'logo.svg'), logoSvg.trim());
console.log('✓ logo.svg');

// ─────────────────────────────────────────────────────────────
// 2. icon base SVG (used at multiple sizes)
// ─────────────────────────────────────────────────────────────
function iconSvg(size = 512) {
  const r  = size * 0.1;   // corner radius
  const w  = size * 0.38;  // wheel outer radius
  const hw = size * 0.08;  // hub radius
  const sw = size * 0.055; // stroke width
  return `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${r}" fill="${BG}"/>
  <!-- Subtle inner glow -->
  <radialGradient id="g" cx="50%" cy="45%" r="55%">
    <stop offset="0%" stop-color="${CYAN}" stop-opacity="0.15"/>
    <stop offset="100%" stop-color="${BG}" stop-opacity="0"/>
  </radialGradient>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#g)"/>
  <!-- Wheel -->
  ${steeringWheelSvg({ size, r: w, hr: hw, stroke: CYAN, strokeW: sw })}
</svg>`;
}

// ─────────────────────────────────────────────────────────────
// 3. PNG icons via sharp
// ─────────────────────────────────────────────────────────────
const pngIcons = [
  { name: 'icon-72.png',          size: 72  },
  { name: 'icon-96.png',          size: 96  },
  { name: 'icon-128.png',         size: 128 },
  { name: 'icon-144.png',         size: 144 },
  { name: 'icon-192.png',         size: 192 },
  { name: 'icon-512.png',         size: 512 },
  { name: 'badge-72.png',         size: 72  },
  { name: 'favicon.png',          size: 32  },
  { name: 'apple-touch-icon.png', size: 180 },
];

for (const { name, size } of pngIcons) {
  const svg = Buffer.from(iconSvg(size));
  await sharp(svg).png().toFile(join(ICONS, name));
  console.log(`✓ icons/${name}`);
}

// ─────────────────────────────────────────────────────────────
// 4. og-image.png  (1200 × 630)
// ─────────────────────────────────────────────────────────────
const OG_W = 1200, OG_H = 630;
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 ${OG_W} ${OG_H}" width="${OG_W}" height="${OG_H}">
  <!-- BG -->
  <rect width="${OG_W}" height="${OG_H}" fill="${BG}"/>
  <!-- Gradient overlay -->
  <radialGradient id="og" cx="30%" cy="50%" r="60%">
    <stop offset="0%" stop-color="${CYAN}" stop-opacity="0.18"/>
    <stop offset="100%" stop-color="${BG}" stop-opacity="0"/>
  </radialGradient>
  <rect width="${OG_W}" height="${OG_H}" fill="url(#og)"/>
  <!-- Grid dots (subtle) -->
  <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
    <circle cx="2" cy="2" r="1.2" fill="${CYAN}" opacity="0.12"/>
  </pattern>
  <rect width="${OG_W}" height="${OG_H}" fill="url(#dots)"/>
  <!-- Large wheel (decorative, right side) -->
  <g opacity="0.08">
    ${steeringWheelSvg({ size: OG_H, cx: OG_W * 0.82, cy: OG_H * 0.5, r: OG_H * 0.38, hr: OG_H * 0.08, stroke: CYAN, strokeW: OG_H * 0.055 })}
  </g>
  <!-- Icon mark -->
  <rect x="80" y="${OG_H/2 - 52}" width="104" height="104" rx="24" fill="${CYAN}"/>
  ${steeringWheelSvg({ size: 104, cx: 80 + 52, cy: OG_H/2, r: 39, hr: 9, stroke: BG, strokeW: 7.5 })}
  <!-- Wordmark -->
  <text x="204" y="${OG_H/2 - 10}"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif"
        font-size="80" font-weight="800" fill="${WHITE}" letter-spacing="-2">Omni</text>
  <text x="428" y="${OG_H/2 - 10}"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif"
        font-size="80" font-weight="800" fill="${CYAN}" letter-spacing="-2">Drive</text>
  <!-- Tagline -->
  <text x="204" y="${OG_H/2 + 42}"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif"
        font-size="28" font-weight="400" fill="#94a3b8" letter-spacing="0.5">
    Plataforma P2P de renta de vehículos · Ecuador
  </text>
  <!-- Bottom badges -->
  <rect x="204" y="${OG_H - 100}" width="120" height="36" rx="18" fill="${CYAN}" opacity="0.15"/>
  <text x="264" y="${OG_H - 76}" text-anchor="middle"
        font-family="sans-serif" font-size="14" font-weight="600" fill="${CYAN}">Con chofer</text>
  <rect x="340" y="${OG_H - 100}" width="100" height="36" rx="18" fill="${CYAN}" opacity="0.15"/>
  <text x="390" y="${OG_H - 76}" text-anchor="middle"
        font-family="sans-serif" font-size="14" font-weight="600" fill="${CYAN}">GPS Live</text>
  <rect x="456" y="${OG_H - 100}" width="130" height="36" rx="18" fill="${CYAN}" opacity="0.15"/>
  <text x="521" y="${OG_H - 76}" text-anchor="middle"
        font-family="sans-serif" font-size="14" font-weight="600" fill="${CYAN}">Pago P2P</text>
</svg>`;

await sharp(Buffer.from(ogSvg)).png().toFile(join(PUB, 'og-image.png'));
console.log('✓ og-image.png');

// ─────────────────────────────────────────────────────────────
// 5. hero-bg.svg  (decorative — used in Home page hero)
// ─────────────────────────────────────────────────────────────
const heroBgSvg = `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 1440 600" preserveAspectRatio="xMidYMid slice">
  <!-- Radial glow top-left -->
  <radialGradient id="h1" cx="20%" cy="30%" r="50%">
    <stop offset="0%" stop-color="${CYAN}" stop-opacity="0.12"/>
    <stop offset="100%" stop-color="${BG}" stop-opacity="0"/>
  </radialGradient>
  <rect width="1440" height="600" fill="url(#h1)"/>
  <!-- Radial glow bottom-right -->
  <radialGradient id="h2" cx="80%" cy="70%" r="45%">
    <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.10"/>
    <stop offset="100%" stop-color="${BG}" stop-opacity="0"/>
  </radialGradient>
  <rect width="1440" height="600" fill="url(#h2)"/>
  <!-- Grid -->
  <pattern id="grid" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
    <path d="M 60 0 L 0 0 0 60" fill="none" stroke="${CYAN}" stroke-width="0.4" opacity="0.3"/>
  </pattern>
  <rect width="1440" height="600" fill="url(#grid)"/>
  <!-- Decorative wheels -->
  <g opacity="0.04">
    ${steeringWheelSvg({ size: 600, cx: 1200, cy: 300, r: 220, hr: 46, stroke: CYAN, strokeW: 20 })}
    ${steeringWheelSvg({ size: 300, cx: 80,   cy: 520, r: 110, hr: 23, stroke: CYAN, strokeW: 10 })}
  </g>
</svg>`;

writeFileSync(join(PUB, 'hero-bg.svg'), heroBgSvg.trim());
console.log('✓ hero-bg.svg');

// ─────────────────────────────────────────────────────────────
// 6. marker.svg  (map pin — used in Mapbox)
// ─────────────────────────────────────────────────────────────
const markerSvg = `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 40 52" width="40" height="52">
  <!-- Drop shadow -->
  <ellipse cx="20" cy="50" rx="10" ry="3" fill="#000" opacity="0.25"/>
  <!-- Pin body -->
  <path d="M20 0 C9 0 0 9 0 20 C0 34 20 52 20 52 C20 52 40 34 40 20 C40 9 31 0 20 0Z"
        fill="${CYAN}"/>
  <!-- Inner circle -->
  <circle cx="20" cy="20" r="9" fill="${BG}"/>
  <!-- Wheel icon inside -->
  <circle cx="20" cy="20" r="6.5" fill="none" stroke="${CYAN}" stroke-width="2"/>
  <circle cx="20" cy="20" r="2"   fill="${CYAN}"/>
  <line x1="20" y1="13.5" x2="20" y2="18" stroke="${CYAN}" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="25.6" y1="23.2" x2="21.8" y2="21" stroke="${CYAN}" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="14.4" y1="23.2" x2="18.2" y2="21" stroke="${CYAN}" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

writeFileSync(join(PUB, 'marker.svg'), markerSvg.trim());
console.log('✓ marker.svg');

// ─────────────────────────────────────────────────────────────
// 7. empty-state.svg  (used when no results / no bookings)
// ─────────────────────────────────────────────────────────────
const emptyStateSvg = `<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 320 240" width="320" height="240">
  <!-- Road -->
  <ellipse cx="160" cy="210" rx="130" ry="18" fill="${SLATE}" opacity="0.6"/>
  <!-- Dashes -->
  <rect x="138" y="207" width="20" height="5" rx="2.5" fill="${CYAN}" opacity="0.4"/>
  <rect x="166" y="207" width="20" height="5" rx="2.5" fill="${CYAN}" opacity="0.4"/>
  <!-- Car silhouette body -->
  <rect x="72" y="164" width="176" height="46" rx="10" fill="${SLATE}"/>
  <!-- Cabin -->
  <path d="M108 164 L128 130 L192 130 L212 164Z" fill="${SLATE}"/>
  <!-- Windows -->
  <path d="M132 158 L140 136 L178 136 L186 158Z" fill="${BG}" opacity="0.9"/>
  <!-- Wheels -->
  <circle cx="110" cy="213" r="20" fill="${BG}" stroke="${CYAN}" stroke-width="4"/>
  <circle cx="110" cy="213" r="8"  fill="${CYAN}" opacity="0.4"/>
  <circle cx="210" cy="213" r="20" fill="${BG}" stroke="${CYAN}" stroke-width="4"/>
  <circle cx="210" cy="213" r="8"  fill="${CYAN}" opacity="0.4"/>
  <!-- Headlights -->
  <rect x="235" y="174" width="18" height="10" rx="4" fill="${CYAN}" opacity="0.7"/>
  <!-- Steering wheel inside -->
  ${steeringWheelSvg({ size: 32, cx: 160, cy: 155, r: 11, hr: 3, stroke: CYAN, strokeW: 2.2 })}
  <!-- Text -->
  <text x="160" y="50" text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        font-size="18" font-weight="700" fill="${WHITE}">Sin resultados</text>
  <text x="160" y="76" text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        font-size="13" fill="#64748b">Intenta con otros filtros</text>
</svg>`;

writeFileSync(join(PUB, 'empty-state.svg'), emptyStateSvg.trim());
console.log('✓ empty-state.svg');

// ─────────────────────────────────────────────────────────────
// 8. favicon.ico simulation (32×32 PNG named favicon.ico)
// ─────────────────────────────────────────────────────────────
await sharp(Buffer.from(iconSvg(64))).resize(32).png().toFile(join(PUB, 'favicon.ico'));
console.log('✓ favicon.ico');

// ─────────────────────────────────────────────────────────────
// Done
// ─────────────────────────────────────────────────────────────
console.log('\n🎨 Todos los assets generados:');
console.log('   public/logo.svg');
console.log('   public/hero-bg.svg');
console.log('   public/marker.svg');
console.log('   public/empty-state.svg');
console.log('   public/og-image.png');
console.log('   public/favicon.ico');
console.log('   public/icons/icon-{72,96,128,144,192,512}.png');
console.log('   public/icons/apple-touch-icon.png');
console.log('   public/icons/badge-72.png');
console.log('   public/icons/favicon.png');
