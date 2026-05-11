import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { holdDeposit, releasePayment, refundPayment, requestWithdrawal } from '../services/wallet';
import { createDepositIntent, confirmDeposit } from '../services/stripe';

export const paymentsRouter = Router();

// GET /api/payments/wallet
paymentsRouter.get('/wallet', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { walletBalance: true },
    });

    const transactions = await prisma.transaction.findMany({
      where: { OR: [{ fromUserId: req.user!.id }, { toUserId: req.user!.id }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.json({ data: { balance: user?.walletBalance, transactions }, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// POST /api/payments/deposit
// Two-step: first call creates intent, second call with paymentIntentId confirms
paymentsRouter.post('/deposit', authenticate, async (req: AuthRequest, res: Response) => {
  const { amount, paymentIntentId } = req.body;

  try {
    if (paymentIntentId) {
      // Step 2: confirm and credit wallet
      const result = await confirmDeposit(paymentIntentId);
      return res.json({ data: result, error: null });
    }

    // Step 1: create intent
    if (!amount || amount <= 0)
      return res.status(400).json({ data: null, error: 'Amount must be positive' });

    const intent = await createDepositIntent(req.user!.id, parseFloat(amount));
    return res.json({ data: { clientSecret: intent.client_secret, paymentIntentId: intent.id }, error: null });
  } catch (e: any) {
    return res.status(500).json({ data: null, error: e.message });
  }
});

// POST /api/payments/withdraw
paymentsRouter.post('/withdraw', authenticate, async (req: AuthRequest, res: Response) => {
  const { amount, bankAccount } = req.body;
  if (!amount || !bankAccount)
    return res.status(400).json({ data: null, error: 'amount and bankAccount required' });

  try {
    await requestWithdrawal(req.user!.id, parseFloat(amount), bankAccount);
    return res.json({ data: { message: 'Withdrawal request submitted', amount }, error: null });
  } catch (e: any) {
    return res.status(400).json({ data: null, error: e.message });
  }
});

// POST /api/payments/hold/:bookingId
paymentsRouter.post('/hold/:bookingId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: (req.params.bookingId as string) } });
    if (!booking) return res.status(404).json({ data: null, error: 'Booking not found' });
    if (booking.tenantId !== req.user!.id)
      return res.status(403).json({ data: null, error: 'Not authorized' });
    if (booking.paymentStatus !== 'pending')
      return res.status(400).json({ data: null, error: 'Deposit already held or processed' });

    await holdDeposit(booking.id, req.user!.id, Number(booking.deposit));
    return res.json({ data: { held: true, amount: booking.deposit }, error: null });
  } catch (e: any) {
    return res.status(400).json({ data: null, error: e.message });
  }
});

// POST /api/payments/release/:bookingId
paymentsRouter.post('/release/:bookingId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: (req.params.bookingId as string) },
      include: { vehicle: true },
    });
    if (!booking) return res.status(404).json({ data: null, error: 'Booking not found' });
    if (booking.vehicle.ownerId !== req.user!.id && req.user!.role !== 'admin')
      return res.status(403).json({ data: null, error: 'Not authorized' });

    await releasePayment(
      booking.id,
      booking.tenantId,
      booking.vehicle.ownerId,
      Number(booking.totalAmount),
      Number(booking.serviceFee)
    );
    return res.json({ data: { released: true }, error: null });
  } catch (e: any) {
    return res.status(400).json({ data: null, error: e.message });
  }
});

// POST /api/payments/refund/:bookingId
paymentsRouter.post('/refund/:bookingId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: (req.params.bookingId as string) },
      include: { vehicle: true },
    });
    if (!booking) return res.status(404).json({ data: null, error: 'Booking not found' });

    const isOwner = booking.vehicle.ownerId === req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ data: null, error: 'Not authorized' });

    const refundAmount = req.body.amount ? parseFloat(req.body.amount) : Number(booking.deposit);
    await refundPayment(booking.id, booking.tenantId, refundAmount);
    return res.json({ data: { refunded: true, amount: refundAmount }, error: null });
  } catch (e: any) {
    return res.status(400).json({ data: null, error: e.message });
  }
});
