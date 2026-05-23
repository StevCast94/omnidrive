"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.holdDeposit = holdDeposit;
exports.releasePayment = releasePayment;
exports.refundPayment = refundPayment;
exports.requestWithdrawal = requestWithdrawal;
const prisma_1 = require("../lib/prisma");
// Retener depósito del tenant (mover de wallet a "held")
async function holdDeposit(bookingId, tenantId, amount) {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: tenantId } });
    if (!user)
        throw new Error('Tenant not found');
    if (Number(user.walletBalance) < amount)
        throw new Error('Insufficient wallet balance');
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.user.update({
            where: { id: tenantId },
            data: { walletBalance: { decrement: amount } },
        }),
        prisma_1.prisma.transaction.create({
            data: {
                fromUserId: tenantId,
                bookingId,
                type: 'deposit',
                amount,
                status: 'completed',
                description: `Depósito retenido para reserva ${bookingId.slice(0, 8)}`,
            },
        }),
        prisma_1.prisma.booking.update({
            where: { id: bookingId },
            data: { paymentStatus: 'held' },
        }),
    ]);
}
// Liberar pago al owner (menos comisión de plataforma)
async function releasePayment(bookingId, tenantId, ownerId, totalAmount, serviceFee) {
    const ownerAmount = totalAmount - serviceFee;
    await prisma_1.prisma.$transaction([
        // Descontar del tenant
        prisma_1.prisma.user.update({
            where: { id: tenantId },
            data: { walletBalance: { decrement: totalAmount } },
        }),
        // Acreditar al owner
        prisma_1.prisma.user.update({
            where: { id: ownerId },
            data: { walletBalance: { increment: ownerAmount } },
        }),
        // Registro de pago al owner
        prisma_1.prisma.transaction.create({
            data: {
                fromUserId: tenantId,
                toUserId: ownerId,
                bookingId,
                type: 'payment',
                amount: ownerAmount,
                fee: serviceFee,
                status: 'completed',
                description: `Pago por reserva ${bookingId.slice(0, 8)}`,
            },
        }),
        // Registro de comisión para la plataforma
        prisma_1.prisma.transaction.create({
            data: {
                fromUserId: tenantId,
                bookingId,
                type: 'commission',
                amount: serviceFee,
                status: 'completed',
                description: `Comisión plataforma (15%) reserva ${bookingId.slice(0, 8)}`,
            },
        }),
    ]);
}
// Reembolsar al tenant
async function refundPayment(bookingId, tenantId, amount) {
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.user.update({
            where: { id: tenantId },
            data: { walletBalance: { increment: amount } },
        }),
        prisma_1.prisma.transaction.create({
            data: {
                toUserId: tenantId,
                bookingId,
                type: 'refund',
                amount,
                status: 'completed',
                description: `Reembolso por cancelación de reserva ${bookingId.slice(0, 8)}`,
            },
        }),
        prisma_1.prisma.booking.update({
            where: { id: bookingId },
            data: { paymentStatus: 'refunded' },
        }),
    ]);
}
// Retirar a cuenta bancaria (registro de solicitud)
async function requestWithdrawal(userId, amount, bankAccount) {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new Error('User not found');
    if (Number(user.walletBalance) < amount)
        throw new Error('Insufficient balance');
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.user.update({
            where: { id: userId },
            data: { walletBalance: { decrement: amount } },
        }),
        prisma_1.prisma.transaction.create({
            data: {
                fromUserId: userId,
                type: 'withdrawal',
                amount,
                status: 'pending', // se procesa manualmente o vía Stripe Payout
                description: `Retiro a cuenta ${bankAccount.slice(-4)}`,
                referenceId: bankAccount,
            },
        }),
    ]);
}
//# sourceMappingURL=wallet.js.map