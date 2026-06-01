import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { uploadToStorage } from '../lib/storage';
import multer from 'multer';
import { asyncHandler } from '../middleware/asyncHandler';

export const bookingsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function calcDuration(startAt: Date, endAt: Date): { hours: number; days: number } {
  const ms = endAt.getTime() - startAt.getTime();
  const hours = ms / (1000 * 60 * 60);
  const days = hours / 24;
  return { hours, days };
}

function calcBase(pricePerHour: number, pricePerDay: number, hours: number, days: number): number {
  const effectiveDays = days >= 0.84 ? Math.ceil(days || 1) : Math.ceil(hours) / 24;
  if (effectiveDays >= 1) {
    const flooredDays = Math.floor(effectiveDays);
    return flooredDays * pricePerHour * 24 <= flooredDays * pricePerDay
      ? Math.ceil(effectiveDays) * pricePerDay
      : Math.ceil(hours) * pricePerHour;
  }
  return Math.ceil(hours) * pricePerHour;
}

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
      tenant: { select: { id: true, name: true, lastName: true, driverScore: true } },
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
      tenant: { select: { id: true, name: true, lastName: true, phone: true, driverScore: true } },
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

// POST /api/bookings
bookingsRouter.post('/', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
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

  const { hours, days } = calcDuration(start, end);
  const baseAmount = calcBase(Number(vehicle.pricePerHour), Number(vehicle.pricePerDay), hours, days);
  const driverFee = withDriver && vehicle.withDriver ? Number(vehicle.driverPrice ?? 0) * Math.ceil(days || 1) : 0;
  const totalAmount = baseAmount + driverFee;
  const deposit = Number(vehicle.deposit);

  const booking = await prisma.booking.create({
    data: {
      vehicleId,
      tenantId: req.user!.id,
      startAt: start,
      endAt: end,
      withDriver: Boolean(withDriver),
      baseAmount,
      driverFee,
      insuranceFee: 0,
      serviceFee: 0,
      totalAmount,
      deposit,
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

  const updated = await prisma.booking.update({
    where: { id: req.params.id as string },
    data: { status: 'cancelled', paymentStatus: booking.paymentStatus === 'held' ? 'refunded' : booking.paymentStatus },
  });

  if (booking.paymentStatus === 'held') {
    await prisma.transaction.create({
      data: {
        toUserId: booking.tenantId,
        bookingId: booking.id,
        type: 'refund',
        amount: Number(booking.deposit),
        status: 'completed',
        description: 'Reembolso por cancelacion de reserva ' + booking.id.slice(0, 8),
      },
    });
  }

  return res.json({ data: updated, error: null });
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
      userId: booking.vehicle.ownerId,
      type: 'booking_active',
      title: 'Viaje iniciado',
      body: `El arrendatario inicio el viaje de tu ${booking.vehicle.brand} ${booking.vehicle.model}`,
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

  const ownerAmount = Number(booking.totalAmount) - Number(booking.serviceFee);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: booking.tenantId },
      data: { walletBalance: { decrement: Number(booking.totalAmount) } },
    }),
    prisma.user.update({
      where: { id: booking.vehicle.ownerId },
      data: { walletBalance: { increment: ownerAmount } },
    }),
    prisma.transaction.create({
      data: {
        fromUserId: booking.tenantId,
        toUserId: booking.vehicle.ownerId,
        bookingId: booking.id,
        type: 'payment',
        amount: ownerAmount,
        fee: Number(booking.serviceFee),
        status: 'completed',
        description: 'Pago por reserva ' + booking.id.slice(0, 8),
      },
    }),
    prisma.transaction.create({
      data: {
        fromUserId: booking.tenantId,
        bookingId: booking.id,
        type: 'commission',
        amount: Number(booking.serviceFee),
        status: 'completed',
        description: 'Comision plataforma reserva ' + booking.id.slice(0, 8),
      },
    }),
  ]);

  const updated = await prisma.booking.update({
    where: { id: req.params.id as string },
    data: {
      status: 'completed',
      returnedAt: new Date(),
      trackingEnabled: false,
      paymentStatus: 'released',
    },
  });

  await prisma.vehicle.update({
    where: { id: booking.vehicleId },
    data: { totalRentals: { increment: 1 } },
  });

  await prisma.user.update({
    where: { id: booking.tenantId },
    data: { totalTrips: { increment: 1 } },
  });

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
