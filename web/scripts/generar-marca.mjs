// Genera iconos de la PWA, favicon y las imagenes de vista previa (OG) a
// partir del isotipo oficial. Se ejecuta a mano cuando cambia la marca:
//   node scripts/generar-marca.mjs
//
// La imagen OG sale en JPEG OPACO a proposito: WhatsApp descarta las
// miniaturas PNG con canal alfa, y ese es el motivo por el que una tarjeta
// sale con titulo y descripcion pero sin imagen.

import sharp from 'sharp';
import { mkdir, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const aqui = dirname(fileURLToPath(import.meta.url));
const PUBLICO = join(aqui, '..', 'public');

const CIAN = '#00b1ff';
const FONDO = '#0b1220'; // el mismo azul del sitio, opaco

// Trazados del archivo de marca (viewBox 210.17 x 129.55).
const D = 'M132.57,47.83l-1.48-.28c-3.27-13.51-11.06-25.53-21.33-34.74l-13.18-9.13,53.54-.02c56.68,4.92,76.86,78.1,29.65,111.29-16.98,11.94-29.73,10.72-49.33,10.63-11.44-.06-22.9.09-34.34.01l11.27-7.2c11.57-9.36,20.63-22.23,23.77-36.95h1.44v24h18c18.96,0,35.28-22.77,35.28-40.56,0-18.34-16.2-41.04-35.76-41.04h-17.52v24Z';
const RUEDA = 'M65.65,3.65C31.97,3.65,4.66,30.96,4.66,64.65s27.31,61,61,61,61-27.31,61-61S99.34,3.65,65.65,3.65ZM65.65,105.29c-22.44,0-40.64-18.2-40.64-40.64s18.2-40.64,40.64-40.64,40.64,18.2,40.64,40.64-18.2,40.64-40.64,40.64Z';

const isotipo = (color = CIAN) =>
  `<path fill="${color}" d="${D}"/><path fill="${color}" d="${RUEDA}"/>`;

/** El isotipo centrado en un lienzo cuadrado, con aire alrededor. */
function iconoCuadrado(lado, { fondo = FONDO, margen = 0.16 } = {}) {
  const util = lado * (1 - margen * 2);
  const escala = util / 210.17;
  const x = (lado - 210.17 * escala) / 2;
  const y = (lado - 129.55 * escala) / 2;

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">
      <rect width="${lado}" height="${lado}" rx="${lado * 0.22}" fill="${fondo}"/>
      <g transform="translate(${x} ${y}) scale(${escala})">${isotipo()}</g>
    </svg>`);
}

/** Vista previa para WhatsApp, Telegram y redes: 1200x630. */
function imagenOG(titulo, bajada) {
  const escala = 300 / 210.17;
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <defs>
        <linearGradient id="f" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0b1220"/>
          <stop offset="100%" stop-color="#111c2e"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#f)"/>
      <rect x="0" y="0" width="1200" height="6" fill="${CIAN}"/>

      <g transform="translate(150 165) scale(${escala})">${isotipo()}</g>

      <text x="150" y="450" font-family="Segoe UI, Helvetica, Arial, sans-serif"
            font-size="70" font-weight="700" fill="#ffffff">${titulo}</text>
      <text x="150" y="508" font-family="Segoe UI, Helvetica, Arial, sans-serif"
            font-size="32" fill="#94a3b8">${bajada}</text>
    </svg>`);
}

await mkdir(join(PUBLICO, 'icons'), { recursive: true });

// ── Iconos de la PWA ──────────────────────────────────────────────────
for (const lado of [192, 512]) {
  await sharp(iconoCuadrado(lado)).png().toFile(join(PUBLICO, 'icons', `icon-${lado}.png`));
}

// Icono "maskable": Android recorta un circulo, asi que necesita mas aire.
await sharp(iconoCuadrado(512, { margen: 0.26 }))
  .png()
  .toFile(join(PUBLICO, 'icons', 'icon-512-maskable.png'));

// iOS no admite transparencia ni pone bordes redondeados por su cuenta.
await sharp(iconoCuadrado(180, { margen: 0.18 }))
  .flatten({ background: FONDO })
  .png()
  .toFile(join(PUBLICO, 'apple-touch-icon.png'));

// ── Favicon ───────────────────────────────────────────────────────────
await writeFile(
  join(PUBLICO, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210.17 129.55">${isotipo()}</svg>\n`
);
await sharp(iconoCuadrado(64, { margen: 0.1 })).png().toFile(join(PUBLICO, 'favicon-64.png'));

// ── Vistas previa por pais ────────────────────────────────────────────
const paises = [
  ['og-ec.jpg', 'OmniDrive Ecuador', 'Alquila el vehiculo que necesitas, de anfitriones verificados.'],
  ['og-do.jpg', 'OmniDrive Republica Dominicana', 'Alquila el vehiculo que necesitas, de anfitriones verificados.'],
];

for (const [archivo, titulo, bajada] of paises) {
  await sharp(imagenOG(titulo, bajada))
    // flatten: sin canal alfa, por lo dicho arriba sobre WhatsApp.
    .flatten({ background: FONDO })
    .jpeg({ quality: 86, progressive: true })
    .toFile(join(PUBLICO, archivo));
}

console.log('Marca generada en web/public/');
