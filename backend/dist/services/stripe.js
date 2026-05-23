"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireStripe = requireStripe;
exports.createDepositIntent = createDepositIntent;
exports.confirmDeposit = confirmDeposit;
exports.createConnectAccount = createConnectAccount;
exports.createOnboardingLink = createOnboardingLink;
exports.createBookingPayment = createBookingPayment;
exports.getStripe = getStripe;
const stripe_1 = __importDefault(require("stripe"));
const prisma_1 = require("../lib/prisma");
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = STRIPE_KEY
    ? new stripe_1.default(STRIPE_KEY, { apiVersion: '2024-04-10' })
    : null;
function requireStripe() {
    if (!stripe)
        throw new Error('Stripe no está configurado (STRIPE_SECRET_KEY no definida)');
    return stripe;
}
// Crear un PaymentIntent para depositar a wallet
async function createDepositIntent(userId, amount) {
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
async function confirmDeposit(paymentIntentId) {
    const s = requireStripe();
    const intent = await s.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== 'succeeded')
        throw new Error('Payment not completed');
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
                referenceId: paymentIntentId,
            },
        }),
    ]);
    return { amount, userId };
}
// Crear cuenta Connect para owner (recibir pagos)
async function createConnectAccount(email) {
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
async function createOnboardingLink(accountId, returnUrl) {
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
async function createBookingPayment(amount, ownerStripeAccountId, bookingId, tenantEmail) {
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
function getStripe() {
    return stripe;
}
//# sourceMappingURL=stripe.js.map