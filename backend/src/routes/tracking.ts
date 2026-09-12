// ===== routes/tracking.ts =====
// Rastreo GPS durante un alquiler activo.
//
// La versión anterior guardaba cada punto reescribiendo entero un blob JSON en
// Booking.trackingData: dos escrituras simultáneas se pisaban y la columna
// crecía sin índice ni límite. Ahora cada punto es una fila de TrackingPoint.
//
// La ubicación de una persona es dato personal sensible bajo la LOPDP
// ecuatoriana y la Ley 172-13 dominicana. De ahí las reglas de este archivo:
//
//  - Nunca se activa solo: hace falta consentimiento explícito del inquilino.
//  - Sólo mientras la reserva está `active`; se apaga al finalizar.
//  - Lo ven únicamente el inquilino y el dueño de ese vehículo. El admin ve
//    que hay rastreo, no la traza, salvo disputa abierta — y queda auditado.
//  - Se borra a los 90 días.

import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { registrarAuditoria } from '../services/auditoria';
import { suscribir, publicarPunto } from '../services/tracking-vivo';
import { revisarGeocerca } from '../services/geocerca';

export const trackingRouter = Router();

/** Días que se conservan los puntos. */
export const RETENCION_DIAS = 90;

async function cargarReserva(id: string) {
  return prisma.booking.findUnique({
    where: { id },
    select: {
      id: true, tenantId: true, status: true,
      trackingEnabled: true, trackingConsentAt: true,
      vehicle: { select: { id: true, ownerId: true, brand: true, model: true } },
    },
  });
}

type Reserva = NonNullable<Awaited<ReturnType<typeof cargarReserva>>>;

function papel(reserva: Reserva, userId: string, role: string) {
  if (reserva.tenantId === userId) return 'inquilino' as const;
  if (reserva.vehicle.ownerId === userId) return 'dueno' as const;
  if (role === 'admin' || role === 'superadmin') return 'admin' as const;
  return null;
}

// ── POST /api/tracking/:bookingId/consentimiento ──────────────────────
// El inquilino activa o desactiva el rastreo. Nadie más puede hacerlo por él.
trackingRouter.post('/:bookingId/consentimiento', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const reserva = await cargarReserva(req.params.bookingId as string);
  if (!reserva) return res.status(404).json({ data: null, error: 'Reserva no encontrada' });

  if (reserva.tenantId !== req.user!.id) {
    return res.status(403).json({
      data: null,
      error: 'Sólo quien conduce puede decidir si comparte su ubicación.',
    });
  }

  const activar = req.body.activar !== false;

  const actualizada = await prisma.booking.update({
    where: { id: reserva.id },
    data: {
      trackingEnabled: activar,
      trackingConsentAt: activar ? new Date() : null,
    },
    select: { id: true, trackingEnabled: true, trackingConsentAt: true },
  });

  await registrarAuditoria(
    req,
    activar ? 'tracking.consentimiento.dar' : 'tracking.consentimiento.retirar',
    'Booking', reserva.id,
    { trackingEnabled: reserva.trackingEnabled },
    { trackingEnabled: activar }
  );

  return res.json({ data: actualizada, error: null });
}));

// ── POST /api/tracking/:bookingId — envío de puntos, por lotes ────────
trackingRouter.post('/:bookingId', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const reserva = await cargarReserva(req.params.bookingId as string);
  if (!reserva) return res.status(404).json({ data: null, error: 'Reserva no encontrada' });

  if (reserva.tenantId !== req.user!.id) {
    return res.status(403).json({ data: null, error: 'Sólo el inquilino reporta su ubicación' });
  }
  if (reserva.status !== 'active') {
    return res.status(409).json({ data: null, error: 'El rastreo sólo funciona durante un alquiler en curso' });
  }
  if (!reserva.trackingEnabled) {
    return res.status(409).json({ data: null, error: 'El rastreo no está activado para esta reserva', code: 'SIN_CONSENTIMIENTO' });
  }

  // Se aceptan lotes: el móvil acumula puntos sin cobertura y los manda
  // juntos al recuperarla. Un punto suelto también vale.
  const crudos: any[] = Array.isArray(req.body.puntos) ? req.body.puntos : [req.body];

  const puntos = crudos
    .map((p: any) => ({
      bookingId: reserva.id,
      lat: Number(p.lat),
      lng: Number(p.lng),
      speed: p.speed != null ? Number(p.speed) : null,
      heading: p.heading != null ? Number(p.heading) : null,
      accuracy: p.accuracy != null ? Number(p.accuracy) : null,
      // Momento real de la lectura GPS, no el de llegada al servidor: si no,
      // un lote enviado con retraso parecería un salto imposible.
      recordedAt: p.recordedAt ? new Date(p.recordedAt) : new Date(),
    }))
    .filter((p: { lat: number; lng: number; recordedAt: Date }) =>
      Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
      Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 &&
      !Number.isNaN(p.recordedAt.getTime())
    );

  if (puntos.length === 0) {
    return res.status(400).json({ data: null, error: 'Ningún punto válido en el envío' });
  }
  if (puntos.length > 500) {
    return res.status(413).json({ data: null, error: 'Demasiados puntos en un solo envío (máximo 500)' });
  }

  await prisma.trackingPoint.createMany({ data: puntos });

  // El último punto se empuja a quien esté mirando el mapa en vivo.
  const ultimo = puntos.reduce((a: typeof puntos[0], b: typeof puntos[0]) => (a.recordedAt > b.recordedAt ? a : b));
  publicarPunto(reserva.id, ultimo);

  // La geocerca se revisa sin bloquear la respuesta: el móvil no tiene que
  // esperar a que se envíe un push para confirmar que recibimos sus puntos.
  revisarGeocerca(reserva.id, ultimo).catch(e =>
    console.error('[Geocerca] Fallo al revisar la zona:', e)
  );

  return res.json({ data: { recibidos: puntos.length }, error: null });
}));

// ── GET /api/tracking/:bookingId — el recorrido ───────────────────────
trackingRouter.get('/:bookingId', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const reserva = await cargarReserva(req.params.bookingId as string);
  if (!reserva) return res.status(404).json({ data: null, error: 'Reserva no encontrada' });

  const quien = papel(reserva, req.user!.id, req.user!.role);
  if (!quien) return res.status(403).json({ data: null, error: 'No autorizado' });

  // Un admin sólo ve la traza si hay disputa abierta, y queda registrado.
  if (quien === 'admin') {
    if (reserva.status !== 'disputed') {
      return res.status(403).json({
        data: null,
        error: 'La traza de ubicación sólo es accesible con una disputa abierta.',
      });
    }
    await registrarAuditoria(req, 'tracking.traza.ver', 'Booking', reserva.id);
  }

  const puntos = await prisma.trackingPoint.findMany({
    where: { bookingId: reserva.id },
    orderBy: { recordedAt: 'asc' },
    select: { lat: true, lng: true, speed: true, heading: true, recordedAt: true },
  });

  return res.json({
    data: {
      activo: reserva.status === 'active' && reserva.trackingEnabled,
      consentimiento: reserva.trackingConsentAt,
      puntos,
      ultimo: puntos.at(-1) ?? null,
      total: puntos.length,
      retencionDias: RETENCION_DIAS,
    },
    error: null,
  });
}));

// ── GET /api/tracking/:bookingId/vivo — SSE ───────────────────────────
// Server-Sent Events desde el propio Express: cero infraestructura nueva y
// funciona detrás del proxy de Railway. El cliente cae a polling si falla.
trackingRouter.get('/:bookingId/vivo', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const reserva = await cargarReserva(req.params.bookingId as string);
  if (!reserva) return res.status(404).json({ data: null, error: 'Reserva no encontrada' });

  const quien = papel(reserva, req.user!.id, req.user!.role);
  if (quien !== 'inquilino' && quien !== 'dueno') {
    return res.status(403).json({ data: null, error: 'No autorizado' });
  }
  if (reserva.status !== 'active' || !reserva.trackingEnabled) {
    return res.status(409).json({ data: null, error: 'Esta reserva no tiene rastreo activo' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Sin esto, un proxy con buffer se queda el flujo y no llega nada.
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const ultimo = await prisma.trackingPoint.findFirst({
    where: { bookingId: reserva.id },
    orderBy: { recordedAt: 'desc' },
    select: { lat: true, lng: true, speed: true, heading: true, recordedAt: true },
  });
  if (ultimo) res.write(`event: punto\ndata: ${JSON.stringify(ultimo)}\n\n`);

  const cerrar = suscribir(reserva.id, punto => {
    res.write(`event: punto\ndata: ${JSON.stringify(punto)}\n\n`);
  });

  // Latido: mantiene viva la conexión y le dice al cliente que seguimos aquí
  // aunque el vehículo esté parado y no genere puntos.
  const latido = setInterval(() => res.write(': latido\n\n'), 25_000);

  req.on('close', () => {
    clearInterval(latido);
    cerrar();
  });
}));

// ── Geocerca ──────────────────────────────────────────────────────────
// El dueño define una zona y recibe aviso si el vehiculo sale. Es lo que hace
// que alguien acepte entregar su carro a un desconocido — y en RD, a un
// turista que acaba de aterrizar.

trackingRouter.put('/:bookingId/geocerca', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const reserva = await cargarReserva(req.params.bookingId as string);
  if (!reserva) return res.status(404).json({ data: null, error: 'Reserva no encontrada' });

  // La define el DUENO del vehiculo, no el inquilino.
  if (reserva.vehicle.ownerId !== req.user!.id) {
    return res.status(403).json({ data: null, error: 'Sólo el dueño del vehículo define la zona' });
  }

  const { lat, lng, radioKm } = req.body;
  const quitar = req.body.quitar === true;

  if (!quitar) {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) || !Number.isFinite(Number(radioKm))) {
      return res.status(400).json({ data: null, error: 'lat, lng y radioKm son obligatorios' });
    }
    if (Number(radioKm) < 1 || Number(radioKm) > 500) {
      return res.status(400).json({ data: null, error: 'El radio debe estar entre 1 y 500 km' });
    }
  }

  const actual = await prisma.booking.findUnique({
    where: { id: reserva.id },
    select: { damageReport: true, insuranceDetails: true },
  });

  // La geocerca vive en insuranceDetails para no añadir columnas: es
  // configuracion de esta reserva concreta, no del vehiculo.
  const detalles = { ...(actual?.insuranceDetails as object ?? {}) } as any;
  detalles.geocerca = quitar ? null : {
    lat: Number(lat), lng: Number(lng), radioKm: Number(radioKm),
    definidaEn: new Date().toISOString(),
  };

  await prisma.booking.update({
    where: { id: reserva.id },
    data: { insuranceDetails: detalles },
  });

  await registrarAuditoria(req, quitar ? 'tracking.geocerca.quitar' : 'tracking.geocerca.definir',
    'Booking', reserva.id, null, detalles.geocerca);

  return res.json({ data: { geocerca: detalles.geocerca }, error: null });
}));
