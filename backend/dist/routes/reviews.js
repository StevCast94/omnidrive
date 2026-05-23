"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewsRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
exports.reviewsRouter = (0, express_1.Router)();
// POST /api/reviews
exports.reviewsRouter.post('/', auth_1.authenticate, async (req, res) => {
    const { bookingId, targetId, rating, comment, categories } = req.body;
    if (!bookingId || !targetId || !rating)
        return res.status(400).json({ data: null, error: 'bookingId, targetId and rating required' });
    if (rating < 1 || rating > 5)
        return res.status(400).json({ data: null, error: 'Rating must be between 1 and 5' });
    try {
        const booking = await prisma_1.prisma.booking.findUnique({
            where: { id: bookingId },
            include: { vehicle: true },
        });
        if (!booking)
            return res.status(404).json({ data: null, error: 'Booking not found' });
        if (booking.status !== 'completed')
            return res.status(400).json({ data: null, error: 'Can only review completed bookings' });
        const isTenant = booking.tenantId === req.user.id;
        const isOwner = booking.vehicle.ownerId === req.user.id;
        if (!isTenant && !isOwner)
            return res.status(403).json({ data: null, error: 'Not authorized to review this booking' });
        const existing = await prisma_1.prisma.review.findFirst({
            where: { bookingId, authorId: req.user.id },
        });
        if (existing)
            return res.status(409).json({ data: null, error: 'Already reviewed this booking' });
        const review = await prisma_1.prisma.review.create({
            data: {
                bookingId,
                authorId: req.user.id,
                targetId,
                vehicleId: isOwner ? undefined : booking.vehicleId, // tenant reviews vehicle too
                rating: parseInt(rating),
                comment,
                categories,
            },
        });
        // Update vehicle rating average
        if (isTenant) {
            const agg = await prisma_1.prisma.review.aggregate({
                where: { vehicleId: booking.vehicleId },
                _avg: { rating: true },
                _count: { rating: true },
            });
            await prisma_1.prisma.vehicle.update({
                where: { id: booking.vehicleId },
                data: { rating: agg._avg.rating ?? rating },
            });
        }
        // Notify reviewed user
        await prisma_1.prisma.notification.create({
            data: {
                userId: targetId,
                type: 'review_received',
                title: '⭐ Recibiste una reseña',
                body: `Calificación: ${rating}/5 — "${comment?.slice(0, 60) ?? ''}"`,
                data: { bookingId, reviewId: review.id },
            },
        });
        return res.status(201).json({ data: review, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// GET /api/reviews/:userId
exports.reviewsRouter.get('/:userId', async (req, res) => {
    try {
        const reviews = await prisma_1.prisma.review.findMany({
            where: { targetId: req.params.userId },
            include: {
                author: { select: { id: true, name: true, lastName: true } },
                vehicle: { select: { id: true, brand: true, model: true, year: true } },
                booking: { select: { startAt: true, endAt: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        const avg = reviews.length
            ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
            : 0;
        return res.json({ data: { reviews, averageRating: Math.round(avg * 10) / 10, total: reviews.length }, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
//# sourceMappingURL=reviews.js.map