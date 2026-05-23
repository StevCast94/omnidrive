"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentsRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const wallet_1 = require("../services/wallet");
const stripe_1 = require("../services/stripe");
exports.paymentsRouter = (0, express_1.Router)();
// GET /api/payments/wallet
exports.paymentsRouter.get('/wallet', auth_1.authenticate, async (req, res) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.id },
            select: { walletBalance: true },
        });
        const transactions = await prisma_1.prisma.transaction.findMany({
            where: { OR: [{ fromUserId: req.user.id }, { toUserId: req.user.id }] },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        return res.json({ data: { balance: user?.walletBalance, transactions }, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// POST /api/payments/deposit
// Two-step: first call creates intent, second call with paymentIntentId confirms
exports.paymentsRouter.post('/deposit', auth_1.authenticate, async (req, res) => {
    const { amount, paymentIntentId } = req.body;
    try {
        if (paymentIntentId) {
            // Step 2: confirm and credit wallet
            const result = await (0, stripe_1.confirmDeposit)(paymentIntentId);
            return res.json({ data: result, error: null });
        }
        // Step 1: create intent
        if (!amount || amount <= 0)
            return res.status(400).json({ data: null, error: 'Amount must be positive' });
        const intent = await (0, stripe_1.createDepositIntent)(req.user.id, parseFloat(amount));
        return res.json({ data: { clientSecret: intent.client_secret, paymentIntentId: intent.id }, error: null });
    }
    catch (e) {
        return res.status(500).json({ data: null, error: e.message });
    }
});
// POST /api/payments/withdraw
exports.paymentsRouter.post('/withdraw', auth_1.authenticate, async (req, res) => {
    const { amount, bankAccount } = req.body;
    if (!amount || !bankAccount)
        return res.status(400).json({ data: null, error: 'amount and bankAccount required' });
    try {
        await (0, wallet_1.requestWithdrawal)(req.user.id, parseFloat(amount), bankAccount);
        return res.json({ data: { message: 'Withdrawal request submitted', amount }, error: null });
    }
    catch (e) {
        return res.status(400).json({ data: null, error: e.message });
    }
});
// POST /api/payments/hold/:bookingId
exports.paymentsRouter.post('/hold/:bookingId', auth_1.authenticate, async (req, res) => {
    try {
        const booking = await prisma_1.prisma.booking.findUnique({ where: { id: req.params.bookingId } });
        if (!booking)
            return res.status(404).json({ data: null, error: 'Booking not found' });
        if (booking.tenantId !== req.user.id)
            return res.status(403).json({ data: null, error: 'Not authorized' });
        if (booking.paymentStatus !== 'pending')
            return res.status(400).json({ data: null, error: 'Deposit already held or processed' });
        await (0, wallet_1.holdDeposit)(booking.id, req.user.id, Number(booking.deposit));
        return res.json({ data: { held: true, amount: booking.deposit }, error: null });
    }
    catch (e) {
        return res.status(400).json({ data: null, error: e.message });
    }
});
// POST /api/payments/release/:bookingId
exports.paymentsRouter.post('/release/:bookingId', auth_1.authenticate, async (req, res) => {
    try {
        const booking = await prisma_1.prisma.booking.findUnique({
            where: { id: req.params.bookingId },
            include: { vehicle: true },
        });
        if (!booking)
            return res.status(404).json({ data: null, error: 'Booking not found' });
        if (booking.vehicle.ownerId !== req.user.id && req.user.role !== 'admin')
            return res.status(403).json({ data: null, error: 'Not authorized' });
        await (0, wallet_1.releasePayment)(booking.id, booking.tenantId, booking.vehicle.ownerId, Number(booking.totalAmount), Number(booking.serviceFee));
        return res.json({ data: { released: true }, error: null });
    }
    catch (e) {
        return res.status(400).json({ data: null, error: e.message });
    }
});
// POST /api/payments/refund/:bookingId
exports.paymentsRouter.post('/refund/:bookingId', auth_1.authenticate, async (req, res) => {
    try {
        const booking = await prisma_1.prisma.booking.findUnique({
            where: { id: req.params.bookingId },
            include: { vehicle: true },
        });
        if (!booking)
            return res.status(404).json({ data: null, error: 'Booking not found' });
        const isOwner = booking.vehicle.ownerId === req.user.id;
        const isAdmin = req.user.role === 'admin';
        if (!isOwner && !isAdmin)
            return res.status(403).json({ data: null, error: 'Not authorized' });
        const refundAmount = req.body.amount ? parseFloat(req.body.amount) : Number(booking.deposit);
        await (0, wallet_1.refundPayment)(booking.id, booking.tenantId, refundAmount);
        return res.json({ data: { refunded: true, amount: refundAmount }, error: null });
    }
    catch (e) {
        return res.status(400).json({ data: null, error: e.message });
    }
});
//# sourceMappingURL=payments.js.map