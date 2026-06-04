"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackingRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const asyncHandler_1 = require("../middleware/asyncHandler");
exports.trackingRouter = (0, express_1.Router)();
// POST /api/tracking/:bookingId — tenant reporta ubicación
// Cada punto se persiste inmediatamente a PostgreSQL (no hay almacenamiento en memoria volátil)
exports.trackingRouter.post('/:bookingId', auth_1.authenticate, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { lat, lng, timestamp } = req.body;
    if (!lat || !lng) {
        return res.status(400).json({ data: null, error: 'lat and lng required' });
    }
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id: req.params.bookingId },
        select: { id: true, tenantId: true, status: true, trackingEnabled: true, trackingData: true },
    });
    if (!booking)
        return res.status(404).json({ data: null, error: 'Booking not found' });
    if (booking.tenantId !== req.user.id) {
        return res.status(403).json({ data: null, error: 'Only the tenant can report location' });
    }
    if (booking.status !== 'active') {
        return res.status(400).json({ data: null, error: 'Tracking only available during active bookings' });
    }
    if (!booking.trackingEnabled) {
        return res.status(400).json({ data: null, error: 'Tracking not enabled for this booking' });
    }
    const point = { lat: parseFloat(lat), lng: parseFloat(lng), ts: timestamp ?? new Date().toISOString() };
    const existing = booking.trackingData ?? [];
    existing.push(point);
    // Persist every point to PostgreSQL (safe across container restarts)
    await prisma_1.prisma.booking.update({
        where: { id: req.params.bookingId },
        data: { trackingData: existing },
    });
    return res.json({ data: { recorded: true, pointsCount: existing.length }, error: null });
}));
// GET /api/tracking/:bookingId — owner o tenant ve la ruta
exports.trackingRouter.get('/:bookingId', auth_1.authenticate, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id: req.params.bookingId },
        select: { id: true, status: true, trackingData: true, vehicle: { select: { ownerId: true } } },
    });
    if (!booking)
        return res.status(404).json({ data: null, error: 'Booking not found' });
    const isOwner = booking.vehicle.ownerId === req.user.id;
    const isTenant = booking.tenantId === req.user.id;
    if (!isOwner && !isTenant && req.user.role !== 'admin') {
        return res.status(403).json({ data: null, error: 'Not authorized' });
    }
    const points = booking.trackingData ?? [];
    return res.json({ data: { points, status: booking.status, count: points.length }, error: null });
}));
//# sourceMappingURL=tracking.js.map