import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireVerified, AuthRequest } from '../middleware/auth';
import { requireLegalAlDia } from '../middleware/legal';
import { uploadToStorage } from '../lib/storage';
import multer from 'multer';
import { asyncHandler } from '../middleware/asyncHandler';
import { calcularDuracion, calcularReserva } from '../services/pricing';
import { getCountry } from '../config/country';
import { calcularDevolucion, POLITICA_CANCELACION } from '../config/legal';
import { retenerPorReserva, liberarPorReserva, reembolsarPorReserva, FondosInsuficientes, EstadoDePagoInvalido } from '../services/wallet';
import { env } from '../config/env';

export const bookingsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const pais = getCountry(env.COUNTRY_CODE);

// POST /api/bookings/cotizar — el desglose SIN crear la reserva.
// Existe para que el frontend no recalcule el precio por su cuenta: cuando hay
// dos formulas, tarde o temprano discrepan y el usuario ve un total y le
// cobran otro.
bookingsRouter.post('/cotizar', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { vehicleId, startAt, endAt, withDriver } = req.body;
  if (!vehicleId || !startAt || !endAt) {
    return res.status(400).json({ data: null, error: 'vehicleId, startAt y endAt son obligatorios' });
  }

  const inicio = new Date(startAt);
  const fin = new Date(endAt);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
    return res.status(400).json({ data: null, error: 'Fechas inválidas' });
  }
  if (fin <= inicio) return res.status(400).json({ data: null, error: 'La devolución debe ser posterior a la entrega' });

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { pricePerHour: true, pricePerDay: true, driverPrice: true, deposit: true, currency: true, withDriver: true },
  });
  if (!vehicle) return res.status(404).json({ data: null, error: 'Vehículo no encontrado' });

  const desglose = calcularReserva(
    vehicle,
    calcularDuracion(inicio, fin),
    { conChofer: Boolean(withDriver) && vehicle.withDriver }
  );

  return res.json({ data: { ...desglose, currency: vehicle.currency }, error: null });
}));

// GET /api/bookings
bookingsRouter.get('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { role = 'tenant', status } = req.query as Record<string, string>;
  const where: any = role === 'owner'
    ? { vehicle: { ownerId: req.user!.id } }
    : { tenantId: req.user!.id };
  if (status) where.status = status;

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      vehicle: { select: { id: true, brand: true, model: true, year: true, photos: true, plate: true, locationName: true } },
      tenant: { select: { id: true, name: true, lastName: true, rating: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ data: bookings, error: null });
}));

// GET /api/bookings/:id
bookingsRouter.get('/:id', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id as string },
    include: {
      vehicle: { include: { owner: { select: { id: true, name: true, lastName: true, phone: true } } } },
      tenant: { select: { id: true, name: true, lastName: true, phone: true, rating: true } },
      review: true,
    },
  });
  if (!booking) return res.status(404).json({ data: null, error: 'Booking not found' });

  const isOwner = booking.vehicle.ownerId === req.user!.id;
  const isTenant = booking.tenantId === req.user!.id;
  if (!isOwner && !isTenant && req.user!.role !== 'admin') {
    return res.status(403).json({ data: null, error: 'Not authorized' });
  }

  return res.json({ data: booking, error: null });
}));

// POST /api/bookings — solo usuarios verificados pueden reservar
bookingsRouter.post('/', authenticate, requireVerified, requireLegalAlDia, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { vehicleId, startAt, endAt, withDriver, hasInsurance, insuranceDetails, liabilityWaiver } = req.body;

  if (!vehicleId || !startAt || !endAt) {
    return res.status(400).json({ data: null, error: 'vehicleId, startAt and endAt are required' });
  }

  const start = new Date(startAt);
  const end = new Date(endAt);
  if (end <= start) return res.status(400).json({ data: null, error: 'endAt must be after startAt' });

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return res.status(404).json({ data: null, error: 'Vehicle not found' });
  if (vehicle.ownerId === req.user!.id) {
    return res.status(400).json({ data: null, error: 'You cannot book your own vehicle' });
  }

  const conflict = await prisma.booking.findFirst({
    where: {
      vehicleId,
      status: { in: ['confirmed', 'active'] },
      AND: [{ startAt: { lt: end } }, { endAt: { gt: start } }],
    },
  });
  if (conflict) return res.status(409).json({ data: null, error: 'Vehicle not available for those dates' });

  // Todo en centavos enteros. El desglose sale de services/pricing.ts, que
  // cobra la mas barata de las dos tarifas del dueno.
  const desglose = calcularReserva(
    {
      pricePerHour: vehicle.pricePerHour,
      pricePerDay: vehicle.pricePerDay,
      driverPrice: vehicle.driverPrice,
      deposit: vehicle.deposit,
    },
    calcularDuracion(start, end),
    { conChofer: Boolean(withDriver) && vehicle.withDriver }
  );

  const booking = await prisma.booking.create({
    data: {
      vehicleId,
      tenantId: req.user!.id,
      startAt: start,
      endAt: end,
      withDriver: Boolean(withDriver) && vehicle.withDriver,
      baseAmount: desglose.baseAmount,
      driverFee: desglose.driverFee,
      insuranceFee: desglose.insuranceFee,
      serviceFee: desglose.serviceFee,
      totalAmount: desglose.totalAmount,
      deposit: desglose.deposit,
      currency: vehicle.currency,
      hasInsurance: false,
      insuranceDetails: {
        type: 'disclaimer_p2p',
        disclaimerAcceptedAt: new Date().toISOString(),
      },
      liabilityWaiver: true,
    },
  });

  await prisma.notification.create({
    data: {
      userId: vehicle.ownerId,
      type: 'booking_request',
      title: 'Nueva solicitud de reserva',
      body: `Alguien quiere rentar tu ${vehicle.brand} ${vehicle.model}`,
      data: { bookingId: booking.id },
    },
  });

  return res.status(201).json({ data: booking, error: null });
}));

// PUT /api/bookings/:id/confirm
bookingsRouter.put('/:id/confirm', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id as string },
    include: { vehicle: true },
  });
  if (!booking) return res.status(404).json({ data: null, error: 'Booking not found' });
  if (booking.vehicle.ownerId !== req.user!.id) {
    return res.status(403).json({ data: null, error: 'Only the owner can confirm' });
  }
  if (booking.status !== 'pending') {
    return res.status(400).json({ data: null, error: `Cannot confirm booking in status: ${booking.status}` });
  }

  let insuranceDetails = booking.insuranceDetails as any;
  if (booking.liabilityWaiver) {
    if (!req.body.ownerAcceptsWaiver) {
      return res.status(400).json({ data: null, error: 'Owner must accept liability waiver' });
    }
    insuranceDetails = { ...insuranceDetails, ownerAcceptedAt: new Date().toISOString() };
  }

  // El dinero se retiene AL CONFIRMAR, antes de que el anfitrión entregue el
  // vehículo. Si el inquilino no tiene fondos, la reserva no se confirma: antes
  // se descubría al finalizar, cuando el coche ya había ido y vuelto.
  try {
    await retenerPorReserva(booking.id);
  } catch (e) {
    if (e instanceof FondosInsuficientes) {
      return res.status(402).json({
        data: { faltan: e.faltan },
        error: 'El inquilino no tiene saldo suficiente para cubrir el alquiler y el depósito.',
        code: 'FONDOS_INSUFICIENTES',
      });
    }
    if (e instanceof EstadoDePagoInvalido) {
      return res.status(409).json({ data: null, error: e.message });
    }
    throw e;
  }

  const updated = await prisma.booking.update({
    where: { id: req.params.id as string },
    data: { status: 'confirmed', insuranceDetails },
  });

  await prisma.notification.create({
    data: {
      userId: booking.tenantId,
      type: 'booking_confirmed',
      title: 'Reserva confirmada',
      body: `Tu reserva del ${booking.vehicle.brand} ${booking.vehicle.model} fue confirmada`,
      data: { bookingId: booking.id },
    },
  });

  return res.json({ data: updated, error: null });
}));

// PUT /api/bookings/:id/cancel
bookingsRouter.put('/:id/cancel', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id as string },
    include: { vehicle: true },
  });
  if (!booking) return res.status(404).json({ data: null, error: 'Booking not found' });

  const isOwner = booking.vehicle.ownerId === req.user!.id;
  const isTenant = booking.tenantId === req.user!.id;
  if (!isOwner && !isTenant) return res.status(403).json({ data: null, error: 'Not authorized' });
  if (booking.status === 'active' || booking.status === 'completed') {
    return res.status(400).json({ data: null, error: 'Cannot cancel an active or completed booking' });
  }

  // Política de cancelación. Antes se devolvía el 100% siempre, sin importar
  // si faltaban dos días o dos horas: el anfitrión que reservaba su fin de
  // semana se quedaba sin alquiler y sin compensación.
  //
  // El depósito se devuelve SIEMPRE entero: es una garantía, y si no hubo
  // alquiler no hay nada que garantizar.
  let devolucion = { porcentajeDevuelto: 100, motivo: 'Cancelación' };

  if (booking.paymentStatus === 'held') {
    const horasHastaElInicio = (booking.startAt.getTime() - Date.now()) / 3_600_000;
    devolucion = calcularDevolucion(horasHastaElInicio, isOwner);

    // Lo que NO se devuelve del alquiler va al anfitrión como compensación.
    const penalizacion = Math.round(booking.totalAmount * (100 - devolucion.porcentajeDevuelto) / 100);

    await reembolsarPorReserva(booking.id, {
      motivo: devolucion.motivo,
      // reembolsarPorReserva reparte desde el total retenido: lo que se queda
      // el anfitrión sale del alquiler, nunca del depósito.
      retenerDelDeposito: 0,
      penalizacionAlAnfitrion: penalizacion,
    });
  }

  const updated = await prisma.booking.update({
    where: { id: req.params.id as string },
    data: { status: 'cancelled' },
  });

  await prisma.notification.create({
    data: {
      userId: isOwner ? booking.tenantId : booking.vehicle.ownerId,
      type: 'booking_cancelled',
      title: 'Reserva cancelada',
      body: `La reserva del ${booking.vehicle.brand} ${booking.vehicle.model} fue cancelada`,
      data: { bookingId: booking.id },
    },
  });

  return res.json({
    data: { ...updated, devolucion },
    error: null,
  });
}));

// GET /api/bookings/:id/politica-cancelacion — qué pasaría si cancelo ahora
bookingsRouter.get('/:id/politica-cancelacion', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id as string },
    select: {
      startAt: true, totalAmount: true, deposit: true, currency: true,
      tenantId: true, paymentStatus: true, vehicle: { select: { ownerId: true } },
    },
  });
  if (!booking) return res.status(404).json({ data: null, error: 'Reserva no encontrada' });

  const esAnfitrion = booking.vehicle.ownerId === req.user!.id;
  if (!esAnfitrion && booking.tenantId !== req.user!.id) {
    return res.status(403).json({ data: null, error: 'No autorizado' });
  }

  const horas = (booking.startAt.getTime() - Date.now()) / 3_600_000;
  const d = calcularDevolucion(horas, esAnfitrion);

  return res.json({
    data: {
      horasHastaElInicio: Math.max(0, Math.round(horas)),
      porcentajeDevuelto: d.porcentajeDevuelto,
      motivo: d.motivo,
      seDevuelveDelAlquiler: Math.round(booking.totalAmount * d.porcentajeDevuelto / 100),
      seDevuelveDelDeposito: booking.deposit,
      currency: booking.currency,
      politica: POLITICA_CANCELACION,
    },
    error: null,
  });
}));

// PUT /api/bookings/:id/start
bookingsRouter.put('/:id/start', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id as string },
    include: { vehicle: true },
  });
  if (!booking) return res.status(404).json({ data: null, error: 'Booking not found' });
  if (booking.vehicle.ownerId !== req.user!.id) {
    return res.status(403).json({ data: null, error: 'Solo el dueno puede iniciar el viaje' });
  }
  if (booking.status !== 'confirmed') {
    return res.status(400).json({ data: null, error: 'Booking must be confirmed to start' });
  }

  const updated = await prisma.booking.update({
    where: { id: req.params.id as string },
    data: { status: 'active', trackingEnabled: true },
  });

  await prisma.notification.create({
    data: {
      userId: booking.tenantId,
      type: 'booking_active',
      title: 'Viaje iniciado',
      body: `El dueño inició el viaje de tu ${booking.vehicle.brand} ${booking.vehicle.model}`,
      data: { bookingId: booking.id },
    },
  });

  return res.json({ data: updated, error: null });
}));

// PUT /api/bookings/:id/photos-before
bookingsRouter.put('/:id/photos-before', authenticate, upload.array('photos', 10), asyncHandler(async (req: AuthRequest, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files?.length) return res.status(400).json({ data: null, error: 'No photos uploaded' });

  const urls = await Promise.all(files.map((f, i) =>
    uploadToStorage(`bookings/${req.params.id as string}/before-${Date.now()}-${i}`, f)
  ));
  const updated = await prisma.booking.update({
    where: { id: req.params.id as string },
    data: { photosBefore: { push: urls } },
  });
  return res.json({ data: { photosBefore: updated.photosBefore }, error: null });
}));

// PUT /api/bookings/:id/photos-after
bookingsRouter.put('/:id/photos-after', authenticate, upload.array('photos', 10), asyncHandler(async (req: AuthRequest, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files?.length) return res.status(400).json({ data: null, error: 'No photos uploaded' });

  const urls = await Promise.all(files.map((f, i) =>
    uploadToStorage(`bookings/${req.params.id as string}/after-${Date.now()}-${i}`, f)
  ));
  const updated = await prisma.booking.update({
    where: { id: req.params.id as string },
    data: { photosAfter: { push: urls } },
  });
  return res.json({ data: { photosAfter: updated.photosAfter }, error: null });
}));

// PUT /api/bookings/:id/end
bookingsRouter.put('/:id/end', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id as string },
    include: { vehicle: true },
  });
  if (!booking) return res.status(404).json({ data: null, error: 'Booking not found' });
  if (booking.vehicle.ownerId !== req.user!.id) {
    return res.status(403).json({ data: null, error: 'Only the owner can end the booking' });
  }
  if (booking.status !== 'active') {
    return res.status(400).json({ data: null, error: 'Booking must be active to end' });
  }

  // El dinero ya estaba retenido desde la confirmación: aquí solo se libera.
  // Ya no puede fallar por saldo, que era el fallo que dejaba la reserva
  // atascada en "active" para siempre.
  try {
    await liberarPorReserva(booking.id);
  } catch (e) {
    if (e instanceof EstadoDePagoInvalido) {
      return res.status(409).json({ data: null, error: e.message });
    }
    throw e;
  }

  const updated = await prisma.booking.update({
    where: { id: req.params.id as string },
    data: {
      status: 'completed',
      returnedAt: new Date(),
      trackingEnabled: false,
    },
  });

  // Los tres contadores se mueven juntos o no se mueve ninguno.
  await prisma.$transaction([
    prisma.vehicle.update({
      where: { id: booking.vehicleId },
      data: { totalRentals: { increment: 1 } },
    }),
    prisma.user.update({
      where: { id: booking.tenantId },
      data: { totalTrips: { increment: 1 } },
    }),
    prisma.user.update({
      where: { id: booking.vehicle.ownerId },
      data: { totalTrips: { increment: 1 } },
    }),
  ]);

  await prisma.notification.createMany({
    data: [
      {
        userId: booking.tenantId,
        type: 'booking_completed',
        title: 'Viaje completado',
        body: 'Tu viaje ha finalizado. Deja tu resena!',
        data: { bookingId: booking.id },
      },
      {
        userId: booking.vehicle.ownerId,
        type: 'booking_completed',
        title: 'Pago liberado',
        body: `El viaje de tu ${booking.vehicle.brand} ${booking.vehicle.model} fue completado y el pago liberado`,
        data: { bookingId: booking.id },
      },
    ],
  });

  return res.json({ data: updated, error: null });
}));

// POST /api/bookings/:id/dispute
bookingsRouter.post('/:id/dispute', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { description } = req.body;
  if (!description) return res.status(400).json({ data: null, error: 'Description required' });

  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id as string },
    include: { vehicle: true },
  });
  if (!booking) return res.status(404).json({ data: null, error: 'Booking not found' });

  const isParty = booking.tenantId === req.user!.id || booking.vehicle.ownerId === req.user!.id;
  if (!isParty) return res.status(403).json({ data: null, error: 'Not authorized' });

  const updated = await prisma.booking.update({
    where: { id: req.params.id as string },
    data: {
      status: 'disputed',
      damageReport: { description, reportedBy: req.user!.id, reportedAt: new Date().toISOString() },
    },
  });

  const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
  await prisma.notification.createMany({
    data: admins.map(a => ({
      userId: a.id,
      type: 'dispute_opened',
      title: 'Disputa abierta',
      body: `Disputa en reserva ${booking.id.slice(0, 8)}`,
      data: { bookingId: booking.id },
    })),
  });

  return res.json({ data: updated, error: null });
}));

