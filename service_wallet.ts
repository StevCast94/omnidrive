import { prisma } from '../lib/prisma';

// Retener depósito del tenant (mover de wallet a "held")
export async function holdDeposit(bookingId: string, tenantId: string, amount: number) {
  const user = await prisma.user.findUnique({ where: { id: tenantId } });
  if (!user) throw new Error('Tenant not found');
  if (Number(user.walletBalance) < amount) throw new Error('Insufficient wallet balance');

  await prisma.$transaction([
    prisma.user.update({
      where: { id: tenantId },
      data: { walletBalance: { decrement: amount } },
    }),
    prisma.transaction.create({
      data: {
        fromUserId: tenantId,
        bookingId,
        type: 'deposit',
        amount,
        status: 'completed',
        description: `Depósito retenido para reserva ${bookingId.slice(0, 8)}`,
      },
    }),
    prisma.booking.update({
      where: { id: bookingId },
      data: { paymentStatus: 'held' },
    }),
  ]);
}

// Liberar pago al owner (menos comisión de plataforma)
export async function releasePayment(
  bookingId: string,
  tenantId: string,
  ownerId: string,
  totalAmount: number,
  serviceFee: number
) {
  const ownerAmount = totalAmount - serviceFee;

  await prisma.$transaction([
    // Descontar del tenant
    prisma.user.update({
      where: { id: tenantId },
      data: { walletBalance: { decrement: totalAmount } },
    }),
    // Acreditar al owner
    prisma.user.update({
      where: { id: ownerId },
      data: { walletBalance: { increment: ownerAmount } },
    }),
    // Registro de pago al owner
    prisma.transaction.create({
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
    prisma.transaction.create({
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
export async function refundPayment(bookingId: string, tenantId: string, amount: number) {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: tenantId },
      data: { walletBalance: { increment: amount } },
    }),
    prisma.transaction.create({
      data: {
        toUserId: tenantId,
        bookingId,
        type: 'refund',
        amount,
        status: 'completed',
        description: `Reembolso por cancelación de reserva ${bookingId.slice(0, 8)}`,
      },
    }),
    prisma.booking.update({
      where: { id: bookingId },
      data: { paymentStatus: 'refunded' },
    }),
  ]);
}

// Retirar a cuenta bancaria (registro de solicitud)
export async function requestWithdrawal(userId: string, amount: number, bankAccount: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  if (Number(user.walletBalance) < amount) throw new Error('Insufficient balance');

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { walletBalance: { decrement: amount } },
    }),
    prisma.transaction.create({
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
