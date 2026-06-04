"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const asyncHandler_1 = require("../middleware/asyncHandler");
exports.usersRouter = (0, express_1.Router)();
// GET /api/users/:id — perfil público
exports.usersRouter.get('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: req.params.id },
        select: {
            id: true, name: true, lastName: true,
            identityVerified: true, rating: true,
            totalTrips: true,
            subscriptionTier: true, createdAt: true,
        },
    });
    if (!user)
        return res.status(404).json({ data: null, error: 'User not found' });
    return res.json({ data: user, error: null });
}));
// GET /api/users/:id/vehicles
exports.usersRouter.get('/:id/vehicles', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const vehicles = await prisma_1.prisma.vehicle.findMany({
        where: { ownerId: req.params.id, available: true },
        orderBy: { createdAt: 'desc' },
    });
    return res.json({ data: vehicles, error: null });
}));
// GET /api/users/:id/reviews
exports.usersRouter.get('/:id/reviews', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const reviews = await prisma_1.prisma.review.findMany({
        where: { targetId: req.params.id },
        include: {
            author: { select: { id: true, name: true, lastName: true } },
            booking: { select: { startAt: true, endAt: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
    return res.json({ data: reviews, error: null });
}));
//# sourceMappingURL=users.js.map