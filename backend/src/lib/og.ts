// ===== lib/og.ts =====
// Etiquetas de vista previa de enlace, inyectadas en el index.html.
//
// En un SPA las etiquetas son estáticas y no pueden cambiar por país, porque
// el HTML es el mismo para todos. Aquí se inyectan al servir: cada despliegue
// pone su bandera, su nombre y su imagen.
//
// Los rastreadores de WhatsApp y Telegram NO ejecutan JavaScript: lo que no
// esté en el HTML que llega, para ellos no existe.

import { readFileSync } from 'fs';
import { CountryConfig } from '../config/country';

export interface DatosOG {
  titulo: string;
  descripcion: string;
  url: string;
  imagen: string;
}

export function datosDelPais(pais: CountryConfig): DatosOG {
  const base = pais.siteUrl.replace(/\/+$/, '');
  return {
    titulo: `OmniDrive ${pais.name}`,
    descripcion:
      `Alquila el vehículo que necesitas de anfitriones verificados en ${pais.name}. ` +
      `Sin trámites eternos, con identidad verificada y precios en ${pais.currency}.`,
    url: base,
    // Absoluta a propósito: una ruta relativa no le sirve a un rastreador.
    imagen: `${base}/og-${pais.code.toLowerCase()}.jpg`,
  };
}

function escapar(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function etiquetas(og: DatosOG, pais: CountryConfig): string {
  return [
    `<title>${escapar(og.titulo)}</title>`,
    `<meta name="description" content="${escapar(og.descripcion)}" />`,
    `<meta property="og:site_name" content="OmniDrive" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="${pais.locale.replace('-', '_')}" />`,
    `<meta property="og:title" content="${escapar(og.titulo)}" />`,
    `<meta property="og:description" content="${escapar(og.descripcion)}" />`,
    `<meta property="og:url" content="${og.url}" />`,
    `<meta property="og:image" content="${og.imagen}" />`,
    `<meta property="og:image:secure_url" content="${og.imagen}" />`,
    // Ancho y alto explícitos: sin ellos WhatsApp a veces no reserva sitio y
    // muestra la tarjeta pequeña aunque la imagen sea válida.
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:type" content="image/jpeg" />`,
    `<meta property="og:image:alt" content="${escapar(og.titulo)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapar(og.titulo)}" />`,
    `<meta name="twitter:description" content="${escapar(og.descripcion)}" />`,
    `<meta name="twitter:image" content="${og.imagen}" />`,
  ].join('\n    ');
}

/**
 * Lee el index.html compilado una sola vez y devuelve la versión con las
 * etiquetas del país ya puestas.
 */
export function prepararIndex(ruta: string, pais: CountryConfig): string {
  const html = readFileSync(ruta, 'utf8');
  const og = datosDelPais(pais);

  // Se quitan las etiquetas de respaldo que trae el HTML compilado, para no
  // dejar dos títulos ni dos og:title compitiendo.
  const limpio = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta[^>]*(property="og:|name="twitter:|name="description")[^>]*>\s*/gi, '');

  return limpio.replace('</head>', `  ${etiquetas(og, pais)}\n  </head>`);
}
