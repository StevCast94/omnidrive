import Stripe from 'stripe';
import { prisma } from '../lib/prisma';

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = STRIPE_KEY
  ? new Stripe(STRIPE_KEY, { apiVersion: '2024-04-10' as any })
  : (null as unknown as Stripe);

export function requireStripe(): Stripe {
  if (!stripe) throw new Error('Stripe no está configurado (STRIPE_SECRET_KEY no definida)');
  return stripe;
}

// Crear un PaymentIntent para depositar a wallet
export async function createDepositIntent(userId: string, amount: number) {
  const s = requireStripe();
  const amountCents = Math.round(amount * 100);
  const intent = await s.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    metadata: { userId, type: 'wallet_deposit' },
  });
  return intent;
}

// Confirmar depósito y acreditar a wallet
export async function confirmDeposit(paymentIntentId: string) {
  const s = requireStripe();
  const intent = await s.paymentIntents.retrieve(paymentIntentId);
  if (intent.status !== 'succeeded') throw new Error('Payment not completed');

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
        description: 'Recarga de wallet vía Stripe',
        referenceId: paymentIntentId,
      },
    }),
  ]);

  return { amount, userId };
}

// Crear cuenta Connect para owner (recibir pagos)
export async function createConnectAccount(email: string) {
  const s = requireStripe();
  const account = await s.accounts.create({
    type: 'express',
    country: 'EC',
    email,
    capabilities: { transfers: { requested: true } },
  });
  return account;
}

// Generar link de onboarding para Stripe Connect
export async function createOnboardingLink(accountId: string, returnUrl: string) {
  const s = requireStripe();
  const link = await s.accountLinks.create({
    account: accountId,
    refresh_url: returnUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
  return link;
}

// Pago directo vía Stripe Connect (usuarios sin suscripción)
export async function createBookingPayment(
  amount: number,
  ownerStripeAccountId: string,
  bookingId: string,
  tenantEmail: string
) {
  const s = requireStripe();
  const total = Math.round(amount * 100);
  const platformFee = Math.round(total * 0.15);

  const intent = await s.paymentIntents.create({
    amount: total,
    currency: 'usd',
    application_fee_amount: platformFee,
    transfer_data: { destination: ownerStripeAccountId },
    metadata: { bookingId, tenantEmail, type: 'booking_payment' },
  });

  return intent;
}

// Permitir acceso condicional (devuelve undefined si no está configurado)
export function getStripe(): Stripe | null {
  return stripe;
}
