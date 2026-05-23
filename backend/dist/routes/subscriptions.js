"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionsRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
exports.subscriptionsRouter = (0, express_1.Router)();
const PLANS = {
    premium: {
        monthly: { price: 9.99, interval: 'monthly' },
        yearly: { price: 95.99, interval: 'yearly' },
        benefits: [
            'Pagos P2P con wallet interna',
            'Sin comisión en primeras 3 reservas/mes',
            'Soporte prioritario',
            'Tracking GPS incluido',
            'Insignia Premium en perfil',
        ],
    },
    elite: {
        monthly: { price: 19.99, interval: 'monthly' },
        yearly: { price: 191.99, interval: 'yearly' },
        benefits: [
            'Todo lo de Premium',
            'Sin comisión en todas las reservas',
            'Acceso anticipado a vehículos nuevos',
            'Seguro básico incluido en cada reserva',
            'Insignia Elite en perfil',
            'Descuentos en socios OmniDrive',
        ],
    },
};
// GET /api/subscriptions
exports.subscriptionsRouter.get('/', async (_req, res) => {
    return res.json({ data: PLANS, error: null });
});
// POST /api/subscriptions
exports.subscriptionsRouter.post('/', auth_1.authenticate, async (req, res) => {
    const { tier, interval } = req.body;
    if (!tier || !interval)
        return res.status(400).json({ data: null, error: 'tier and interval required' });
    if (!['premium', 'elite'].includes(tier))
        return res.status(400).json({ data: null, error: 'Invalid tier' });
    if (!['monthly', 'yearly'].includes(interval))
        return res.status(400).json({ data: null, error: 'Invalid interval' });
    try {
        const plan = PLANS[tier][interval];
        const user = await prisma_1.prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user)
            return res.status(404).json({ data: null, error: 'User not found' });
        if (Number(user.walletBalance) < plan.price)
            return res.status(400).json({ data: null, error: 'Insufficient wallet balance' });
        const now = new Date();
        const endsAt = new Date(now);
        interval === 'monthly' ? endsAt.setMonth(endsAt.getMonth() + 1) : endsAt.setFullYear(endsAt.getFullYear() + 1);
        const [subscription] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.subscription.upsert({
                where: { userId: req.user.id },
                create: {
                    userId: req.user.id,
                    tier,
                    price: plan.price,
                    interval,
                    startsAt: now,
                    endsAt,
                    status: 'active',
                    benefits: PLANS[tier].benefits,
                },
                update: {
                    tier,
                    price: plan.price,
                    interval,
                    startsAt: now,
                    endsAt,
                    status: 'active',
                    autoRenew: true,
                    benefits: PLANS[tier].benefits,
                },
            }),
            prisma_1.prisma.user.update({
                where: { id: req.user.id },
                data: {
                    walletBalance: { decrement: plan.price },
                    subscriptionTier: tier,
                    subscriptionEnds: endsAt,
                },
            }),
            prisma_1.prisma.transaction.create({
                data: {
                    fromUserId: req.user.id,
                    type: 'subscription',
                    amount: plan.price,
                    status: 'completed',
                    description: `Suscripción ${tier} (${interval})`,
                },
            }),
        ]);
        return res.status(201).json({ data: subscription, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// PUT /api/subscriptions/cancel
exports.subscriptionsRouter.put('/cancel', auth_1.authenticate, async (req, res) => {
    try {
        const sub = await prisma_1.prisma.subscription.findUnique({ where: { userId: req.user.id } });
        if (!sub)
            return res.status(404).json({ data: null, error: 'No active subscription' });
        if (sub.status !== 'active')
            return res.status(400).json({ data: null, error: 'Subscription already cancelled' });
        const updated = await prisma_1.prisma.subscription.update({
            where: { userId: req.user.id },
            data: { autoRenew: false, status: 'cancelled' },
        });
        // Tier reverts to free at endsAt — for MVP just mark it
        await prisma_1.prisma.user.update({
            where: { id: req.user.id },
            data: { subscriptionTier: 'free', subscriptionEnds: null },
        });
        return res.json({ data: { cancelled: true, activeUntil: sub.endsAt }, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
//# sourceMappingURL=subscriptions.js.map