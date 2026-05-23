"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackingRouter = void 0;
exports.flushTracking = flushTracking;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
exports.trackingRouter = (0, express_1.Router)();
// In-memory store for live points (flushed to DB on booking end)
// Key: bookingId, Value: array of {lat, lng, ts}
const liveTracking = new Map();
// POST /api/tracking/:bookingId — tenant reporta ubicación
exports.trackingRouter.post('/:bookingId', auth_1.authenticate, async (req, res) => {
    const { lat, lng, timestamp } = req.body;
    if (!lat || !lng)
        return res.status(400).json({ data: null, error: 'lat and lng required' });
    try {
        const booking = await prisma_1.prisma.booking.findUnique({ where: { id: req.params.bookingId } });
        if (!booking)
            return res.status(404).json({ data: null, error: 'Booking not found' });
        if (booking.tenantId !== req.user.id)
            return res.status(403).json({ data: null, error: 'Only the tenant can report location' });
        if (booking.status !== 'active')
            return res.status(400).json({ data: null, error: 'Tracking only available during active bookings' });
        if (!booking.trackingEnabled)
            return res.status(400).json({ data: null, error: 'Tracking not enabled for this booking' });
        const point = { lat: parseFloat(lat), lng: parseFloat(lng), ts: timestamp ?? new Date().toISOString() };
        const points = liveTracking.get(req.params.bookingId) ?? [];
        points.push(point);
        liveTracking.set(req.params.bookingId, points);
        // Persist every 10 points to avoid data loss
        if (points.length % 10 === 0) {
            await prisma_1.prisma.booking.update({
                where: { id: req.params.bookingId },
                data: { trackingData: points },
            });
        }
        // Geofence check (if restrictions defined)
        const vehicle = await prisma_1.prisma.vehicle.findUnique({
            where: { id: booking.vehicleId },
            select: { restrictions: true, ownerId: true },
        });
        const restrictions = vehicle?.restrictions;
        if (restrictions?.maxRadiusKm && vehicle) {
            // Basic geofence: notify owner if too far from start
            // Full implementation would compare vs vehicle.locationLat/Lng
        }
        return res.json({ data: { recorded: true, pointsCount: points.length }, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// GET /api/tracking/:bookingId — owner o tenant ve la ruta
exports.trackingRouter.get('/:bookingId', auth_1.authenticate, async (req, res) => {
    try {
        const booking = await prisma_1.prisma.booking.findUnique({
            where: { id: req.params.bookingId },
            include: { vehicle: { select: { ownerId: true } } },
        });
        if (!booking)
            return res.status(404).json({ data: null, error: 'Booking not found' });
        const isOwner = booking.vehicle.ownerId === req.user.id;
        const isTenant = booking.tenantId === req.user.id;
        if (!isOwner && !isTenant && req.user.role !== 'admin')
            return res.status(403).json({ data: null, error: 'Not authorized' });
        // Live points for active bookings, historic for completed
        const live = liveTracking.get(req.params.bookingId) ?? [];
        const historic = booking.trackingData ?? [];
        // Merge: live takes priority
        const points = booking.status === 'active' ? live : historic;
        return res.json({ data: { points, status: booking.status, count: points.length }, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// Called internally when booking ends to persist and clear live data
async function flushTracking(bookingId) {
    const points = liveTracking.get(bookingId) ?? [];
    if (points.length > 0) {
        await prisma_1.prisma.booking.update({
            where: { id: bookingId },
            data: { trackingData: points, trackingEnabled: false },
        });
    }
    liveTracking.delete(bookingId);
}
//# sourceMappingURL=tracking.js.map