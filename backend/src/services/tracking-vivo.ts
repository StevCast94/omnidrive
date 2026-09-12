// ===== services/tracking-vivo.ts =====
// Reparto en vivo de los puntos de rastreo a quien tenga el mapa abierto.
//
// Es memoria del proceso, a propósito: los puntos ya están guardados en
// TrackingPoint, y esto sólo evita que el mapa espere al siguiente sondeo. Si
// el contenedor se reinicia, el cliente reconecta y vuelve a pedir el último
// punto. No hay nada que perder aquí.
//
// Con más de una réplica, un suscriptor conectado a la réplica A no recibe los
// puntos que entran por la B. El cliente cae a polling y sigue funcionando,
// sólo que con menos inmediatez; cuando haya varias réplicas, esto pasa a
// Postgres LISTEN/NOTIFY sin tocar el resto del código.

export interface PuntoVivo {
  lat: number;
  lng: number;
  speed?: number | null;
  heading?: number | null;
  recordedAt: Date;
}

type Oyente = (punto: PuntoVivo) => void;

const oyentes = new Map<string, Set<Oyente>>();

/** Se suscribe a una reserva. Devuelve la función para darse de baja. */
export function suscribir(bookingId: string, oyente: Oyente): () => void {
  let grupo = oyentes.get(bookingId);
  if (!grupo) {
    grupo = new Set();
    oyentes.set(bookingId, grupo);
  }
  grupo.add(oyente);

  return () => {
    grupo!.delete(oyente);
    // Sin oyentes no se deja el Map creciendo con reservas terminadas.
    if (grupo!.size === 0) oyentes.delete(bookingId);
  };
}

export function publicarPunto(bookingId: string, punto: PuntoVivo): void {
  const grupo = oyentes.get(bookingId);
  if (!grupo) return;

  for (const oyente of grupo) {
    try {
      oyente(punto);
    } catch (e) {
      // Un cliente que se desconectó a medias no puede tumbar el envío a los
      // demás ni la petición que trajo el punto.
      console.error('[Tracking] Fallo al enviar a un suscriptor:', e);
    }
  }
}

export function cuantosMirando(bookingId: string): number {
  return oyentes.get(bookingId)?.size ?? 0;
}
