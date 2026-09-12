// ===== web/src/lib/rastreo.ts =====
// Captura de ubicación durante un alquiler, desde el móvil de quien conduce.
//
// Tres cosas que la versión anterior no hacía y que aquí son el objetivo:
//
//  1. `watchPosition` en vez de pedir la posición cada 30 s: el navegador
//     avisa cuando hay una lectura buena, y gasta menos batería que despertar
//     el GPS a intervalos fijos.
//  2. Buffer en localStorage: en carretera la cobertura se cae, y sin buffer
//     ese tramo del recorrido se pierde para siempre.
//  3. Filtro de distancia: un vehículo aparcado no tiene por qué generar un
//     punto cada medio minuto.

import { tracking } from './api';

const CLAVE_BUFFER = 'omnidrive.rastreo.buffer';

/** Metros que hay que moverse para que un punto valga la pena. */
const DISTANCIA_MINIMA_M = 50;
/** Cada cuánto se vacía el buffer contra el servidor. */
const INTERVALO_ENVIO_MS = 20_000;
/** Peor precisión aceptable: por encima, la lectura es ruido. */
const PRECISION_MAXIMA_M = 100;
/** Tope del buffer, para no llenar el almacenamiento si no hay red en horas. */
const MAXIMO_EN_BUFFER = 500;

export interface Punto {
  lat: number;
  lng: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  recordedAt: string;
}

function leerBuffer(): Punto[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_BUFFER) ?? '[]');
  } catch {
    return [];
  }
}

function guardarBuffer(puntos: Punto[]) {
  try {
    // Si se llena, se tiran los más viejos: el recorrido reciente importa más.
    localStorage.setItem(CLAVE_BUFFER, JSON.stringify(puntos.slice(-MAXIMO_EN_BUFFER)));
  } catch {
    /* almacenamiento lleno o bloqueado: se seguirá enviando en vivo */
  }
}

function metrosEntre(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface Rastreador {
  detener: () => void;
  /** Puntos esperando a poder enviarse. */
  pendientes: () => number;
}

/**
 * Empieza a capturar y enviar la ubicación de esta reserva.
 *
 * Devuelve el control para detenerlo. Detenerlo NO borra el buffer: si quedan
 * puntos sin enviar, se mandan en el siguiente intento.
 */
export function iniciarRastreo(
  bookingId: string,
  al?: { onPunto?: (p: Punto) => void; onError?: (e: string) => void }
): Rastreador {
  if (!navigator.geolocation) {
    al?.onError?.('Este dispositivo no puede compartir la ubicación');
    return { detener: () => {}, pendientes: () => 0 };
  }

  let ultimo: Punto | null = null;
  let enviando = false;

  const enviar = async () => {
    if (enviando) return;
    const buffer = leerBuffer();
    if (buffer.length === 0) return;

    enviando = true;
    try {
      await tracking.reportarLote(bookingId, buffer);
      // Sólo se vacía lo que se envió: si mientras tanto entraron puntos
      // nuevos, se conservan.
      const ahora = leerBuffer();
      guardarBuffer(ahora.slice(buffer.length));
    } catch {
      // Sin red: se quedan en el buffer y se reintenta en el siguiente ciclo.
    } finally {
      enviando = false;
    }
  };

  const observador = navigator.geolocation.watchPosition(
    pos => {
      const p: Punto = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        speed: pos.coords.speed,
        heading: pos.coords.heading,
        accuracy: pos.coords.accuracy,
        recordedAt: new Date(pos.timestamp).toISOString(),
      };

      // Una lectura imprecisa mueve el marcador a saltos sin que el vehículo
      // se haya movido: mejor descartarla.
      if (p.accuracy != null && p.accuracy > PRECISION_MAXIMA_M) return;

      // Parado: no se generan puntos.
      if (ultimo && metrosEntre(ultimo, p) < DISTANCIA_MINIMA_M) return;

      ultimo = p;
      guardarBuffer([...leerBuffer(), p]);
      al?.onPunto?.(p);
    },
    err => {
      const mensajes: Record<number, string> = {
        1: 'Necesitamos permiso de ubicación para compartir tu recorrido',
        2: 'No pudimos obtener tu ubicación',
        3: 'La ubicación está tardando demasiado',
      };
      al?.onError?.(mensajes[err.code] ?? 'Error de ubicación');
    },
    { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 }
  );

  const reloj = setInterval(enviar, INTERVALO_ENVIO_MS);
  // Al volver a tener red, vaciar sin esperar al siguiente ciclo.
  window.addEventListener('online', enviar);

  return {
    detener: () => {
      navigator.geolocation.clearWatch(observador);
      clearInterval(reloj);
      window.removeEventListener('online', enviar);
      enviar(); // último intento con lo que quede
    },
    pendientes: () => leerBuffer().length,
  };
}

/**
 * Se suscribe al recorrido en vivo por SSE, con polling de respaldo.
 *
 * Si el flujo se corta —proxy, red móvil, contenedor reiniciado— se pasa a
 * preguntar cada 15 s en vez de dejar el mapa congelado sin avisar.
 */
export function seguirEnVivo(
  bookingId: string,
  onPunto: (p: Punto) => void,
  token: string | null
): () => void {
  let cerrado = false;
  let fuente: EventSource | null = null;
  let sondeo: ReturnType<typeof setInterval> | null = null;

  const empezarSondeo = () => {
    if (sondeo || cerrado) return;
    sondeo = setInterval(async () => {
      try {
        const r = await tracking.get(bookingId);
        const ultimo = r.data.data.ultimo;
        if (ultimo) onPunto(ultimo);
      } catch {
        /* se reintenta al siguiente ciclo */
      }
    }, 15_000);
  };

  // EventSource no admite cabeceras, así que el token va en la query. Es un
  // access token de 15 minutos y viaja por HTTPS.
  const url = `/api/tracking/${bookingId}/vivo${token ? `?token=${encodeURIComponent(token)}` : ''}`;

  try {
    fuente = new EventSource(url);
    fuente.addEventListener('punto', (e: MessageEvent) => {
      try { onPunto(JSON.parse(e.data)); } catch { /* trama incompleta */ }
    });
    fuente.onerror = () => {
      fuente?.close();
      fuente = null;
      empezarSondeo();
    };
  } catch {
    empezarSondeo();
  }

  return () => {
    cerrado = true;
    fuente?.close();
    if (sondeo) clearInterval(sondeo);
  };
}
