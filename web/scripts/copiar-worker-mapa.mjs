// ===== web/scripts/copiar-worker-mapa.mjs =====
// MapLibre resuelve su worker en tiempo de ejecucion con
// `new URL('./maplibre-gl-worker.mjs', import.meta.url)`, una cadena
// dinamica que Vite no analiza de forma estatica. El bundler nunca lo
// detecta ni lo copia como asset, asi que MapLibre pide un archivo que no
// existe, recibe el index.html de la ruta comodin (200, pero HTML) y el
// mapa se queda en un recuadro vacio sin ningun error visible.
//
// El nombre debe quedar SIN hash y en /assets/, porque import.meta.url del
// chunk empaquetado (vendor-mapa-*.js) vive ahi: la URL final que MapLibre
// construye es siempre /assets/maplibre-gl-worker.mjs, nunca otra cosa.
//
// Se copia en cada build en vez de commitear una copia estatica: si se
// actualiza maplibre-gl, el worker viaja junto con el resto de la libreria
// sin que nadie tenga que acordarse de repetir el paso a mano.

import { copyFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const aqui = dirname(fileURLToPath(import.meta.url));
const dist = join(aqui, '..', 'node_modules', 'maplibre-gl', 'dist');
const destino = join(aqui, '..', 'public', 'assets');
await mkdir(destino, { recursive: true });

// El worker importa maplibre-gl-shared.mjs con su propio nombre literal: si
// falta cualquiera de los dos, el navegador intenta cargar un modulo que no
// existe, la ruta comodin lo resuelve con el index.html (200, pero HTML) y
// falla con un error de MIME type que no menciona el mapa para nada.
for (const archivo of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  await copyFile(join(dist, archivo), join(destino, archivo));
}

console.log('Worker de MapLibre copiado a public/assets/');
