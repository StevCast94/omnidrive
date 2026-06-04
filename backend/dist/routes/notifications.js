"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const asyncHandler_1 = require("../middleware/asyncHandler");
exports.notificationsRouter = (0, express_1.Router)();
// GET /api/notifications
exports.notificationsRouter.get('/', auth_1.authenticate, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const notifs = await prisma_1.prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
    const unreadCount = await prisma_1.prisma.notification.count({
        where: { userId: req.user.id, read: false },
    });
    return res.json({ data: notifs, unreadCount, error: null });
}));
// PUT /api/notifications/:id/read
exports.notificationsRouter.put('/:id/read', auth_1.authenticate, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const notif = await prisma_1.prisma.notification.updateMany({
        where: { id: req.params.id, userId: req.user.id },
        data: { read: true },
    });
    return res.json({ data: { updated: notif.count }, error: null });
}));
//# sourceMappingURL=notifications.js.map