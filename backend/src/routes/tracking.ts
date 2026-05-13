import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

export const trackingRouter = Router();

// In-memory store for live points (flushed to DB on booking end)
// Key: bookingId, Value: array of {lat, lng, ts}
const liveTracking = new Map<string, { lat: number; lng: number; ts: string }[]>();

// POST /api/tracking/:bookingId — tenant reporta ubicación
trackingRouter.post('/:bookingId', authenticate, async (req: AuthRequest, res: Response) => {
  const { lat, lng, timestamp } = req.body;
  if (!lat || !lng) return res.status(400).json({ data: null, error: 'lat and lng required' });

  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.bookingId as string } });
    if (!booking) return res.status(404).json({ data: null, error: 'Booking not found' });
    if (booking.tenantId !== req.user!.id)
      return res.status(403).json({ data: null, error: 'Only the tenant can report location' });
    if (booking.status !== 'active')
      return res.status(400).json({ data: null, error: 'Tracking only available during active bookings' });
    if (!booking.trackingEnabled)
      return res.status(400).json({ data: null, error: 'Tracking not enabled for this booking' });

    const point = { lat: parseFloat(lat), lng: parseFloat(lng), ts: timestamp ?? new Date().toISOString() };
    const points = liveTracking.get(req.params.bookingId as string) ?? [];
    points.push(point);
    liveTracking.set(req.params.bookingId as string, points);

    // Persist every 10 points to avoid data loss
    if (points.length % 10 === 0) {
      await prisma.booking.update({
        where: { id: req.params.bookingId as string },
        data: { trackingData: points },
      });
    }

    // Geofence check (if restrictions defined)
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: booking.vehicleId },
      select: { restrictions: true, ownerId: true },
    });
    const restrictions = vehicle?.restrictions as any;
    if (restrictions?.maxRadiusKm && vehicle) {
      // Basic geofence: notify owner if too far from start
      // Full implementation would compare vs vehicle.locationLat/Lng
    }

    return res.json({ data: { recorded: true, pointsCount: points.length }, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// GET /api/tracking/:bookingId — owner o tenant ve la ruta
trackingRouter.get('/:bookingId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.bookingId as string as string },
      include: { vehicle: { select: { ownerId: true } } },
    });
    if (!booking) return res.status(404).json({ data: null, error: 'Booking not found' });

    const isOwner = booking.vehicle.ownerId === req.user!.id;
    const isTenant = booking.tenantId === req.user!.id;
    if (!isOwner && !isTenant && req.user!.role !== 'admin')
      return res.status(403).json({ data: null, error: 'Not authorized' });

    // Live points for active bookings, historic for completed
    const live = liveTracking.get(req.params.bookingId as string) ?? [];
    const historic = (booking.trackingData as any[]) ?? [];

    // Merge: live takes priority
    const points = booking.status === 'active' ? live : historic;

    return res.json({ data: { points, status: booking.status, count: points.length }, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// Called internally when booking ends to persist and clear live data
export async function flushTracking(bookingId: string) {
  const points = liveTracking.get(bookingId) ?? [];
  if (points.length > 0) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { trackingData: points, trackingEnabled: false },
    });
  }
  liveTracking.delete(bookingId);
}
