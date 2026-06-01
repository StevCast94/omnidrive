import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { holdDeposit, requestWithdrawal } from '../services/wallet';
import { asyncHandler } from '../middleware/asyncHandler';

export const paymentsRouter = Router();

// GET /api/payments/wallet
paymentsRouter.get('/wallet', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { walletBalance: true },
  });
  const transactions = await prisma.transaction.findMany({
    where: { OR: [{ fromUserId: req.user!.id }, { toUserId: req.user!.id }] },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return res.json({ data: { balance: user?.walletBalance ?? 0, transactions }, error: null });
}));

// POST /api/payments/deposit
paymentsRouter.post('/deposit', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ data: null, error: 'Invalid amount' });

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { walletBalance: { increment: amount } },
  });

  await prisma.transaction.create({
    data: {
      toUserId: req.user!.id,
      type: 'deposit',
      amount,
      status: 'completed',
      description: 'Deposito a wallet',
    },
  });

  return res.json({ data: { balance: user.walletBalance }, error: null });
}));

// POST /api/payments/withdraw
paymentsRouter.post('/withdraw', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { amount, bankAccount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ data: null, error: 'Invalid amount' });
  if (!bankAccount) return res.status(400).json({ data: null, error: 'Bank account required' });

  await requestWithdrawal(req.user!.id, amount, bankAccount);
  return res.json({ data: { requested: true }, error: null });
}));

// POST /api/payments/hold/:bookingId
paymentsRouter.post('/hold/:bookingId', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId as string },
  });
  if (!booking) return res.status(404).json({ data: null, error: 'Booking not found' });
  if (booking.tenantId !== req.user!.id) {
    return res.status(403).json({ data: null, error: 'Not authorized' });
  }

  await holdDeposit(booking.id, req.user!.id, Number(booking.deposit));
  return res.json({ data: { held: true }, error: null });
}));

// POST /api/payments/release/:bookingId
paymentsRouter.post('/release/:bookingId', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId as string },
    include: { vehicle: true },
  });
  if (!booking) return res.status(404).json({ data: null, error: 'Booking not found' });

  const isOwner = booking.vehicle.ownerId === req.user!.id;
  if (!isOwner && req.user!.role !== 'admin') {
    return res.status(403).json({ data: null, error: 'Not authorized' });
  }

  const { releasePayment } = await import('../services/wallet');
  await releasePayment(booking.id, booking.tenantId, booking.vehicle.ownerId, Number(booking.totalAmount), Number(booking.serviceFee));
  return res.json({ data: { released: true }, error: null });
}));

// POST /api/payments/refund/:bookingId
paymentsRouter.post('/refund/:bookingId', authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { amount } = req.body;
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId as string },
  });
  if (!booking) return res.status(404).json({ data: null, error: 'Booking not found' });
  if (booking.tenantId !== req.user!.id && req.user!.role !== 'admin') {
    return res.status(403).json({ data: null, error: 'Not authorized' });
  }

  const { refundPayment } = await import('../services/wallet');
  await refundPayment(booking.id, booking.tenantId, amount ?? Number(booking.totalAmount));
  return res.json({ data: { refunded: true }, error: null });
}));
