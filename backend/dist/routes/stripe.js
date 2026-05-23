"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeRouter = void 0;
const express_1 = require("express");
const stripe_1 = require("../services/stripe");
const prisma_1 = require("../lib/prisma");
exports.stripeRouter = (0, express_1.Router)();
// Stripe necesita el body como raw Buffer para verificar la firma
exports.stripeRouter.post('/webhook', 
// IMPORTANTE: en index.ts registrar ANTES de express.json()
// app.use('/api/stripe', stripeRouter)  ← antes del middleware json
async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    try {
        const s = (0, stripe_1.requireStripe)();
        event = s.webhooks.constructEvent(req.body, sig, secret);
    }
    catch (e) {
        console.error('[Stripe] Webhook signature failed:', e.message);
        return res.status(400).send(`Webhook error: ${e.message}`);
    }
    console.log('[Stripe] Event:', event.type);
    switch (event.type) {
        // ── Depósito confirmado ──────────────────────────────
        case 'payment_intent.succeeded': {
            const intent = event.data.object;
            if (intent.metadata?.type === 'wallet_deposit') {
                const { userId } = intent.metadata;
                const amount = intent.amount / 100;
                await prisma_1.prisma.$transaction([
                    prisma_1.prisma.user.update({
                        where: { id: userId },
                        data: { walletBalance: { increment: amount } },
                    }),
                    prisma_1.prisma.transaction.create({
                        data: {
                            toUserId: userId,
                            type: 'deposit',
                            amount,
                            status: 'completed',
                            description: 'Recarga de wallet vía Stripe',
                            referenceId: intent.id,
                        },
                    }),
                ]);
                await prisma_1.prisma.notification.create({
                    data: {
                        userId,
                        type: 'payment_received',
                        title: '💰 Wallet recargada',
                        body: `Se acreditaron $${amount.toFixed(2)} a tu wallet`,
                    },
                });
            }
            if (intent.metadata?.type === 'booking_payment') {
                const { bookingId } = intent.metadata;
                await prisma_1.prisma.booking.update({
                    where: { id: bookingId },
                    data: { paymentStatus: 'held', transactionId: intent.id },
                });
            }
            break;
        }
        // ── Pago fallido ─────────────────────────────────────
        case 'payment_intent.payment_failed': {
            const intent = event.data.object;
            if (intent.metadata?.bookingId) {
                await prisma_1.prisma.booking.update({
                    where: { id: intent.metadata.bookingId },
                    data: { status: 'cancelled', paymentStatus: 'refunded' },
                });
            }
            break;
        }
        // ── Cuenta Connect completada ─────────────────────────
        case 'account.updated': {
            const account = event.data.object;
            // Log that owner has completed onboarding
            console.log('[Stripe Connect] Account updated:', account.id, account.charges_enabled);
            break;
        }
        default:
            console.log('[Stripe] Unhandled event:', event.type);
    }
    res.json({ received: true });
});
//# sourceMappingURL=stripe.js.map