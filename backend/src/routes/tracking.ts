import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

export const trackingRouter = Router();

// POST /api/tracking/:bookingId — tenant reporta ubicación
// Cada punto se persiste inmediatamente a PostgreSQL (no hay almacenamiento en memoria volátil)
trackingRouter.post('/:bookingId', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { lat, lng, timestamp } = req.body;
  if (!lat || !lng) {
    return res.status(400).json({ data: null, error: 'lat and lng required' });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId as string },
    select: { id: true, tenantId: true, status: true, trackingEnabled: true, trackingData: true },
  });
  if (!booking) return res.status(404).json({ data: null, error: 'Booking not found' });
  if (booking.tenantId !== req.user!.id) {
    return res.status(403).json({ data: null, error: 'Only the tenant can report location' });
  }
  if (booking.status !== 'active') {
    return res.status(400).json({ data: null, error: 'Tracking only available during active bookings' });
  }
  if (!booking.trackingEnabled) {
    return res.status(400).json({ data: null, error: 'Tracking not enabled for this booking' });
  }

  const point = { lat: parseFloat(lat), lng: parseFloat(lng), ts: timestamp ?? new Date().toISOString() };
  const existing = (booking.trackingData as any[]) ?? [];
  existing.push(point);

  // Persist every point to PostgreSQL (safe across container restarts)
  await prisma.booking.update({
    where: { id: req.params.bookingId as string },
    data: { trackingData: existing },
  });

  return res.json({ data: { recorded: true, pointsCount: existing.length }, error: null });
}));

// GET /api/tracking/:bookingId — owner o tenant ve la ruta
trackingRouter.get('/:bookingId', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId as string },
    select: { id: true, status: true, trackingData: true, vehicle: { select: { ownerId: true } } },
  });
  if (!booking) return res.status(404).json({ data: null, error: 'Booking not found' });

  const isOwner = booking.vehicle.ownerId === req.user!.id;
  const isTenant = booking.tenantId === req.user!.id;
  if (!isOwner && !isTenant && req.user!.role !== 'admin') {
    return res.status(403).json({ data: null, error: 'Not authorized' });
  }

  const points = (booking.trackingData as any[]) ?? [];
  return res.json({ data: { points, status: booking.status, count: points.length }, error: null });
}));
