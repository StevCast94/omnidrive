import { Router, Request, Response } from 'express';
import { requireStripe } from '../services/stripe';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../middleware/asyncHandler';

export const stripeRouter = Router();

// Stripe webhook - mounted BEFORE express.json() in index.ts
stripeRouter.post('/webhook', asyncHandler(async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;

  const s = requireStripe();
  const event = s.webhooks.constructEvent(req.body, sig as string, secret);

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object;
      if (intent.metadata?.type === 'wallet_deposit') {
        const { userId } = intent.metadata;
        const amount = intent.amount / 100;
        await prisma.$transaction([
          prisma.user.update({
            where: { id: userId },
            data: { walletBalance: { increment: amount } },
          }),
          prisma.transaction.create({
            data: {
              toUserId: userId,
              type: 'deposit',
              amount,
              status: 'completed',
              description: 'Recarga de wallet via Stripe',
              referenceId: intent.id,
            },
          }),
        ]);
        await prisma.notification.create({
          data: {
            userId,
            type: 'payment_received',
            title: 'Wallet recargada',
            body: `Se acreditaron $${amount.toFixed(2)} a tu wallet`,
          },
        });
      }

      if (intent.metadata?.type === 'booking_payment') {
        const { bookingId } = intent.metadata;
        await prisma.booking.update({
          where: { id: bookingId },
          data: { paymentStatus: 'held', transactionId: intent.id },
        });
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const intent = event.data.object;
      if (intent.metadata?.bookingId) {
        await prisma.booking.update({
          where: { id: intent.metadata.bookingId },
          data: { status: 'cancelled', paymentStatus: 'refunded' },
        });
      }
      break;
    }

    case 'account.updated': {
      const account = event.data.object;
      console.log('[Stripe Connect] Account updated:', account.id, account.charges_enabled);
      break;
    }

    default:
      console.log('[Stripe] Unhandled event:', event.type);
  }

  res.json({ received: true });
}));
