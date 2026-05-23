"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingsRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const storage_1 = require("../lib/storage");
const wallet_1 = require("../services/wallet");
const multer_1 = __importDefault(require("multer"));
exports.bookingsRouter = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
// OmniDrive MVP — sin comisiones, sin seguro de plataforma
function calcDuration(startAt, endAt) {
    const ms = endAt.getTime() - startAt.getTime();
    const hours = ms / (1000 * 60 * 60);
    const days = hours / 24;
    return { hours, days };
}
function calcBase(pricePerHour, pricePerDay, hours, days) {
    // Gap administrativo: si ocupó casi un día completo (>= 20h), cuenta como 1 día
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
exports.bookingsRouter.get('/', auth_1.authenticate, async (req, res) => {
    const { role = 'tenant', status } = req.query;
    const where = role === 'owner'
        ? { vehicle: { ownerId: req.user.id } }
        : { tenantId: req.user.id };
    if (status)
        where.status = status;
    try {
        const bookings = await prisma_1.prisma.booking.findMany({
            where,
            include: {
                vehicle: { select: { id: true, brand: true, model: true, year: true, photos: true, plate: true, locationName: true } },
                tenant: { select: { id: true, name: true, lastName: true, driverScore: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return res.json({ data: bookings, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// GET /api/bookings/:id
exports.bookingsRouter.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const booking = await prisma_1.prisma.booking.findUnique({
            where: { id: req.params.id },
            include: {
                vehicle: { include: { owner: { select: { id: true, name: true, lastName: true, phone: true } } } },
                tenant: { select: { id: true, name: true, lastName: true, phone: true, driverScore: true } },
                review: true,
            },
        });
        if (!booking)
            return res.status(404).json({ data: null, error: 'Booking not found' });
        // Only tenant or owner can see
        const isOwner = booking.vehicle.ownerId === req.user.id;
        const isTenant = booking.tenantId === req.user.id;
        if (!isOwner && !isTenant && req.user.role !== 'admin')
            return res.status(403).json({ data: null, error: 'Not authorized' });
        return res.json({ data: booking, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// POST /api/bookings
exports.bookingsRouter.post('/', auth_1.authenticate, async (req, res) => {
    const { vehicleId, startAt, endAt, withDriver, hasInsurance, insuranceDetails, liabilityWaiver } = req.body;
    if (!vehicleId || !startAt || !endAt)
        return res.status(400).json({ data: null, error: 'vehicleId, startAt and endAt are required' });
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (end <= start)
        return res.status(400).json({ data: null, error: 'endAt must be after startAt' });
    try {
        const vehicle = await prisma_1.prisma.vehicle.findUnique({ where: { id: vehicleId } });
        if (!vehicle)
            return res.status(404).json({ data: null, error: 'Vehicle not found' });
        if (vehicle.ownerId === req.user.id)
            return res.status(400).json({ data: null, error: 'You cannot book your own vehicle' });
        // Check availability
        const conflict = await prisma_1.prisma.booking.findFirst({
            where: {
                vehicleId,
                status: { in: ['confirmed', 'active'] },
                AND: [{ startAt: { lt: end } }, { endAt: { gt: start } }],
            },
        });
        if (conflict)
            return res.status(409).json({ data: null, error: 'Vehicle not available for those dates' });
        const { hours, days } = calcDuration(start, end);
        const baseAmount = calcBase(Number(vehicle.pricePerHour), Number(vehicle.pricePerDay), hours, days);
        const driverFee = withDriver && vehicle.withDriver ? Number(vehicle.driverPrice ?? 0) * Math.ceil(days || 1) : 0;
        const totalAmount = baseAmount + driverFee;
        const deposit = Number(vehicle.deposit);
        const booking = await prisma_1.prisma.booking.create({
            data: {
                vehicleId,
                tenantId: req.user.id,
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
        // Notify owner
        await prisma_1.prisma.notification.create({
            data: {
                userId: vehicle.ownerId,
                type: 'booking_request',
                title: '🚗 Nueva solicitud de reserva',
                body: `Alguien quiere rentar tu ${vehicle.brand} ${vehicle.model}`,
                data: { bookingId: booking.id },
            },
        });
        return res.status(201).json({ data: booking, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// PUT /api/bookings/:id/confirm
exports.bookingsRouter.put('/:id/confirm', auth_1.authenticate, async (req, res) => {
    try {
        const booking = await prisma_1.prisma.booking.findUnique({
            where: { id: req.params.id },
            include: { vehicle: true },
        });
        if (!booking)
            return res.status(404).json({ data: null, error: 'Booking not found' });
        if (booking.vehicle.ownerId !== req.user.id)
            return res.status(403).json({ data: null, error: 'Only the owner can confirm' });
        if (booking.status !== 'pending')
            return res.status(400).json({ data: null, error: `Cannot confirm booking in status: ${booking.status}` });
        // Owner liability waiver acceptance if no insurance
        const ownerAccept = req.body.ownerAcceptsWaiver;
        let insuranceDetails = booking.insuranceDetails;
        if (booking.liabilityWaiver) {
            if (!ownerAccept)
                return res.status(400).json({ data: null, error: 'Owner must accept liability waiver for uninsured booking' });
            insuranceDetails = { ...insuranceDetails, ownerAcceptedAt: new Date().toISOString() };
        }
        const updated = await prisma_1.prisma.booking.update({
            where: { id: req.params.id },
            data: { status: 'confirmed', insuranceDetails },
        });
        await prisma_1.prisma.notification.create({
            data: {
                userId: booking.tenantId,
                type: 'booking_confirmed',
                title: '✅ Reserva confirmada',
                body: `Tu reserva del ${booking.vehicle.brand} ${booking.vehicle.model} fue confirmada`,
                data: { bookingId: booking.id },
            },
        });
        return res.json({ data: updated, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// PUT /api/bookings/:id/cancel
exports.bookingsRouter.put('/:id/cancel', auth_1.authenticate, async (req, res) => {
    try {
        const booking = await prisma_1.prisma.booking.findUnique({
            where: { id: req.params.id },
            include: { vehicle: true },
        });
        if (!booking)
            return res.status(404).json({ data: null, error: 'Booking not found' });
        const isOwner = booking.vehicle.ownerId === req.user.id;
        const isTenant = booking.tenantId === req.user.id;
        if (!isOwner && !isTenant)
            return res.status(403).json({ data: null, error: 'Not authorized' });
        if (booking.status === 'active' || booking.status === 'completed')
            return res.status(400).json({ data: null, error: 'Cannot cancel an active or completed booking' });
        const updated = await prisma_1.prisma.booking.update({
            where: { id: req.params.id },
            data: { status: 'cancelled', paymentStatus: booking.paymentStatus === 'held' ? 'refunded' : booking.paymentStatus },
        });
        // Refund if deposit was held
        if (booking.paymentStatus === 'held') {
            await (0, wallet_1.refundPayment)(booking.id, booking.tenantId, Number(booking.deposit));
        }
        return res.json({ data: updated, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// PUT /api/bookings/:id/start
exports.bookingsRouter.put('/:id/start', auth_1.authenticate, async (req, res) => {
    const { pin } = req.body;
    try {
        const booking = await prisma_1.prisma.booking.findUnique({
            where: { id: req.params.id },
            include: { vehicle: true },
        });
        if (!booking)
            return res.status(404).json({ data: null, error: 'Booking not found' });
        if (booking.status !== 'confirmed')
            return res.status(400).json({ data: null, error: 'Booking must be confirmed to start' });
        // Validate PIN (stored in insuranceDetails.pin for simplicity)
        const stored = booking.insuranceDetails?.pin;
        if (stored && pin !== stored)
            return res.status(400).json({ data: null, error: 'Invalid PIN' });
        const updated = await prisma_1.prisma.booking.update({
            where: { id: req.params.id },
            data: { status: 'active', trackingEnabled: true },
        });
        await prisma_1.prisma.notification.create({
            data: {
                userId: booking.vehicle.ownerId,
                type: 'booking_active',
                title: '🚀 Viaje iniciado',
                body: `El arrendatario inició el viaje de tu ${booking.vehicle.brand} ${booking.vehicle.model}`,
                data: { bookingId: booking.id },
            },
        });
        return res.json({ data: updated, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// PUT /api/bookings/:id/photos-before
exports.bookingsRouter.put('/:id/photos-before', auth_1.authenticate, upload.array('photos', 10), async (req, res) => {
    const files = req.files;
    if (!files?.length)
        return res.status(400).json({ data: null, error: 'No photos uploaded' });
    try {
        const urls = await Promise.all(files.map((f, i) => (0, storage_1.uploadToStorage)(`bookings/${req.params.id}/before-${Date.now()}-${i}`, f)));
        const updated = await prisma_1.prisma.booking.update({
            where: { id: req.params.id },
            data: { photosBefore: { push: urls } },
        });
        return res.json({ data: { photosBefore: updated.photosBefore }, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// PUT /api/bookings/:id/photos-after
exports.bookingsRouter.put('/:id/photos-after', auth_1.authenticate, upload.array('photos', 10), async (req, res) => {
    const files = req.files;
    if (!files?.length)
        return res.status(400).json({ data: null, error: 'No photos uploaded' });
    try {
        const urls = await Promise.all(files.map((f, i) => (0, storage_1.uploadToStorage)(`bookings/${req.params.id}/after-${Date.now()}-${i}`, f)));
        const updated = await prisma_1.prisma.booking.update({
            where: { id: req.params.id },
            data: { photosAfter: { push: urls } },
        });
        return res.json({ data: { photosAfter: updated.photosAfter }, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// PUT /api/bookings/:id/end
exports.bookingsRouter.put('/:id/end', auth_1.authenticate, async (req, res) => {
    try {
        const booking = await prisma_1.prisma.booking.findUnique({
            where: { id: req.params.id },
            include: { vehicle: true },
        });
        if (!booking)
            return res.status(404).json({ data: null, error: 'Booking not found' });
        if (booking.vehicle.ownerId !== req.user.id)
            return res.status(403).json({ data: null, error: 'Only the owner can end the booking' });
        if (booking.status !== 'active')
            return res.status(400).json({ data: null, error: 'Booking must be active to end' });
        // Release payment to owner
        await (0, wallet_1.releasePayment)(booking.id, booking.tenantId, booking.vehicle.ownerId, Number(booking.totalAmount), Number(booking.serviceFee));
        const updated = await prisma_1.prisma.booking.update({
            where: { id: req.params.id },
            data: {
                status: 'completed',
                returnedAt: new Date(),
                trackingEnabled: false,
                paymentStatus: 'released',
            },
        });
        // Update vehicle stats
        await prisma_1.prisma.vehicle.update({
            where: { id: booking.vehicleId },
            data: { totalRentals: { increment: 1 } },
        });
        // Update tenant stats
        await prisma_1.prisma.user.update({
            where: { id: booking.tenantId },
            data: { totalTrips: { increment: 1 } },
        });
        // Notify both
        await prisma_1.prisma.notification.createMany({
            data: [
                {
                    userId: booking.tenantId,
                    type: 'booking_completed',
                    title: '🏁 Viaje completado',
                    body: 'Tu viaje ha finalizado. ¡Deja tu reseña!',
                    data: { bookingId: booking.id },
                },
                {
                    userId: booking.vehicle.ownerId,
                    type: 'booking_completed',
                    title: '💰 Pago liberado',
                    body: `El viaje de tu ${booking.vehicle.brand} ${booking.vehicle.model} fue completado y el pago liberado`,
                    data: { bookingId: booking.id },
                },
            ],
        });
        return res.json({ data: updated, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// POST /api/bookings/:id/dispute
exports.bookingsRouter.post('/:id/dispute', auth_1.authenticate, async (req, res) => {
    const { description } = req.body;
    if (!description)
        return res.status(400).json({ data: null, error: 'Description required' });
    try {
        const booking = await prisma_1.prisma.booking.findUnique({
            where: { id: req.params.id },
            include: { vehicle: true },
        });
        if (!booking)
            return res.status(404).json({ data: null, error: 'Booking not found' });
        const isParty = booking.tenantId === req.user.id || booking.vehicle.ownerId === req.user.id;
        if (!isParty)
            return res.status(403).json({ data: null, error: 'Not authorized' });
        const updated = await prisma_1.prisma.booking.update({
            where: { id: req.params.id },
            data: {
                status: 'disputed',
                damageReport: { description, reportedBy: req.user.id, reportedAt: new Date().toISOString() },
            },
        });
        // Notify admins
        const admins = await prisma_1.prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
        await prisma_1.prisma.notification.createMany({
            data: admins.map(a => ({
                userId: a.id,
                type: 'dispute_opened',
                title: '⚠️ Disputa abierta',
                body: `Disputa en reserva ${booking.id.slice(0, 8)}`,
                data: { bookingId: booking.id },
            })),
        });
        return res.json({ data: updated, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
//# sourceMappingURL=bookings.js.map