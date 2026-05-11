import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { refundPayment } from '../services/wallet';

export const adminRouter = Router();
adminRouter.use(authenticate, requireAdmin);

// GET /api/admin/users
adminRouter.get('/users', async (req: AuthRequest, res: Response) => {
  const { verified, page = '1', limit = '20', search } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};
  if (verified !== undefined) where.identityVerified = verified === 'true';
  if (search) where.OR = [
    { email: { contains: search, mode: 'insensitive' } },
    { name: { contains: search, mode: 'insensitive' } },
    { documentId: { contains: search } },
  ];

  try {
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, phone: true, name: true, lastName: true,
          documentType: true, documentId: true, identityVerified: true,
          selfieUrl: true, documentFrontUrl: true, documentBackUrl: true,
          walletBalance: true, subscriptionTier: true, driverScore: true,
          totalTrips: true, role: true, createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);
    return res.json({ data: { users, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) }, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// PUT /api/admin/users/:id/verify
adminRouter.put('/users/:id/verify', async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { identityVerified: true, verifiedAt: new Date() },
      select: { id: true, name: true, email: true, identityVerified: true, verifiedAt: true },
    });

    await prisma.notification.create({
      data: {
        userId: req.params.id,
        type: 'identity_verified',
        title: '✅ Identidad verificada',
        body: 'Tu identidad fue verificada. ¡Ya puedes publicar vehículos!',
      },
    });

    return res.json({ data: user, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// GET /api/admin/vehicles
adminRouter.get('/vehicles', async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '20' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  try {
    const [vehicles, total] = await prisma.$transaction([
      prisma.vehicle.findMany({
        skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { owner: { select: { id: true, name: true, email: true } } },
      }),
      prisma.vehicle.count(),
    ]);
    return res.json({ data: { vehicles, total }, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// GET /api/admin/bookings
adminRouter.get('/bookings', async (req: AuthRequest, res: Response) => {
  const { status, page = '1', limit = '20' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};
  if (status) where.status = status;
  try {
    const [bookings, total] = await prisma.$transaction([
      prisma.booking.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          vehicle: { select: { brand: true, model: true, plate: true } },
          tenant: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.booking.count({ where }),
    ]);
    return res.json({ data: { bookings, total }, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// GET /api/admin/transactions
adminRouter.get('/transactions', async (req: AuthRequest, res: Response) => {
  const { type, page = '1', limit = '30' } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};
  if (type) where.type = type;
  try {
    const [transactions, total] = await prisma.$transaction([
      prisma.transaction.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
      prisma.transaction.count({ where }),
    ]);
    return res.json({ data: { transactions, total }, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// GET /api/admin/disputes
adminRouter.get('/disputes', async (_req, res: Response) => {
  try {
    const disputes = await prisma.booking.findMany({
      where: { status: 'disputed' },
      orderBy: { updatedAt: 'desc' },
      include: {
        vehicle: { select: { brand: true, model: true, plate: true, ownerId: true } },
        tenant: { select: { id: true, name: true, email: true } },
      },
    });
    return res.json({ data: disputes, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// PUT /api/admin/disputes/:id/resolve
adminRouter.put('/disputes/:id/resolve', async (req: AuthRequest, res: Response) => {
  const { resolution, refundAmount, faultParty } = req.body;
  if (!resolution) return res.status(400).json({ data: null, error: 'resolution required' });

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { vehicle: true },
    });
    if (!booking) return res.status(404).json({ data: null, error: 'Booking not found' });
    if (booking.status !== 'disputed')
      return res.status(400).json({ data: null, error: 'Booking is not in disputed status' });

    // Refund tenant if fault is owner's, or partial refund
    if (refundAmount && refundAmount > 0) {
      await refundPayment(booking.id, booking.tenantId, parseFloat(refundAmount));
    }

    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data: {
        status: 'completed',
        damageReport: {
          ...(booking.damageReport as object ?? {}),
          resolution,
          faultParty,
          refundAmount,
          resolvedAt: new Date().toISOString(),
          resolvedBy: req.user!.id,
        },
      },
    });

    // Notify both parties
    await prisma.notification.createMany({
      data: [
        {
          userId: booking.tenantId,
          type: 'dispute_resolved',
          title: '⚖️ Disputa resuelta',
          body: `Resolución: ${resolution}`,
          data: { bookingId: booking.id },
        },
        {
          userId: booking.vehicle.ownerId,
          type: 'dispute_resolved',
          title: '⚖️ Disputa resuelta',
          body: `Resolución: ${resolution}`,
          data: { bookingId: booking.id },
        },
      ],
    });

    return res.json({ data: updated, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// GET /api/admin/metrics
adminRouter.get('/metrics', async (_req, res: Response) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      verifiedUsers,
      totalVehicles,
      activeBookings,
      revenueToday,
      revenueMonth,
      disputeCount,
    ] = await prisma.$transaction([
      prisma.user.count(),
      prisma.user.count({ where: { identityVerified: true } }),
      prisma.vehicle.count(),
      prisma.booking.count({ where: { status: 'active' } }),
      prisma.transaction.aggregate({
        where: { type: 'commission', status: 'completed', createdAt: { gte: startOfDay } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'commission', status: 'completed', createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      prisma.booking.count({ where: { status: 'disputed' } }),
    ]);

    // Occupancy: active / total available
    const availableVehicles = await prisma.vehicle.count({ where: { available: true } });
    const occupancyRate = availableVehicles > 0 ? (activeBookings / availableVehicles) * 100 : 0;

    return res.json({
      data: {
        totalUsers,
        verifiedUsers,
        totalVehicles,
        activeBookings,
        openDisputes: disputeCount,
        revenueToday: revenueToday._sum.amount ?? 0,
        revenueMonth: revenueMonth._sum.amount ?? 0,
        occupancyRate: Math.round(occupancyRate * 10) / 10,
      },
      error: null,
    });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});
