"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
exports.notificationsRouter = (0, express_1.Router)();
// GET /api/notifications — últimas 50 notificaciones del usuario
exports.notificationsRouter.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const notifications = await prisma_1.prisma.notification.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        return res.json({ data: notifications, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// PUT /api/notifications/:id/read
exports.notificationsRouter.put('/:id/read', auth_1.authenticate, async (req, res) => {
    try {
        await prisma_1.prisma.notification.updateMany({
            where: { id: req.params.id, userId: req.user.id },
            data: { read: true },
        });
        return res.json({ data: { read: true }, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// PUT /api/notifications/read-all
exports.notificationsRouter.put('/read-all', auth_1.authenticate, async (req, res) => {
    try {
        await prisma_1.prisma.notification.updateMany({
            where: { userId: req.user.id, read: false },
            data: { read: true },
        });
        return res.json({ data: { ok: true }, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
//# sourceMappingURL=notifications.js.map