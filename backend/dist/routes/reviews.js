"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewsRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const asyncHandler_1 = require("../middleware/asyncHandler");
exports.reviewsRouter = (0, express_1.Router)();
// POST /api/reviews
exports.reviewsRouter.post('/', auth_1.authenticate, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { bookingId, rating, comment, categories } = req.body;
    if (!bookingId || rating === undefined || rating === null) {
        return res.status(400).json({ data: null, error: 'bookingId y rating son requeridos' });
    }
    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
        return res.status(400).json({ data: null, error: 'rating debe ser un entero entre 1 y 5' });
    }
    // Cargar la reserva con su vehículo para validar autoría y estado en el servidor
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id: bookingId },
        include: { vehicle: { select: { id: true, ownerId: true } } },
    });
    if (!booking)
        return res.status(404).json({ data: null, error: 'Reserva no encontrada' });
    const isTenant = booking.tenantId === req.user.id;
    const isOwner = booking.vehicle.ownerId === req.user.id;
    if (!isTenant && !isOwner) {
        return res.status(403).json({ data: null, error: 'No participaste en esta reserva' });
    }
    if (booking.status !== 'completed') {
        return res.status(400).json({ data: null, error: 'Solo puedes calificar reservas completadas' });
    }
    const existing = await prisma_1.prisma.review.findUnique({ where: { bookingId } });
    if (existing) {
        return res.status(409).json({ data: null, error: 'Ya calificaste esta reserva' });
    }
    // Derivar destino del servidor (nunca confiar en el cliente):
    // - el inquilino califica al dueño + el vehículo
    // - el dueño califica al inquilino
    const targetId = isTenant ? booking.vehicle.ownerId : booking.tenantId;
    const vehicleId = isTenant ? booking.vehicle.id : null;
    // Crear la reseña
    const review = await prisma_1.prisma.review.create({
        data: { bookingId, authorId: req.user.id, targetId, vehicleId, rating: numRating, comment, categories },
    });
    // Recalcular y persistir rating del usuario (target)
    const userAvg = await prisma_1.prisma.review.aggregate({
        where: { targetId },
        _avg: { rating: true },
    });
    await prisma_1.prisma.user.update({
        where: { id: targetId },
        data: { rating: Math.round((userAvg._avg.rating ?? 0) * 10) / 10 },
    });
    // Recalcular y persistir rating del vehículo
    if (vehicleId) {
        const vehicleAvg = await prisma_1.prisma.review.aggregate({
            where: { vehicleId },
            _avg: { rating: true },
        });
        await prisma_1.prisma.vehicle.update({
            where: { id: vehicleId },
            data: { rating: Math.round((vehicleAvg._avg.rating ?? 0) * 10) / 10 },
        });
    }
    return res.json({
        data: {
            review,
            newUserRating: userAvg._avg.rating ? Math.round(userAvg._avg.rating * 10) / 10 : null,
        },
        error: null,
    });
}));
// GET /api/reviews/:userId
exports.reviewsRouter.get('/:userId', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const reviews = await prisma_1.prisma.review.findMany({
        where: { targetId: req.params.userId },
        include: {
            author: { select: { id: true, name: true, lastName: true, avatarUrl: true } },
            booking: { select: { startAt: true, endAt: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
    return res.json({ data: reviews, error: null });
}));
//# sourceMappingURL=reviews.js.map