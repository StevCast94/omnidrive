import Stripe from 'stripe';
export declare function requireStripe(): Stripe;
export declare function createDepositIntent(userId: string, amount: number): Promise<Stripe.Response<Stripe.PaymentIntent>>;
export declare function confirmDeposit(paymentIntentId: string): Promise<{
    amount: number;
    userId: string;
}>;
export declare function createConnectAccount(email: string): Promise<Stripe.Response<Stripe.Account>>;
export declare function createOnboardingLink(accountId: string, returnUrl: string): Promise<Stripe.Response<Stripe.AccountLink>>;
export declare function createBookingPayment(amount: number, ownerStripeAccountId: string, bookingId: string, tenantEmail: string): Promise<Stripe.Response<Stripe.PaymentIntent>>;
export declare function getStripe(): Stripe | null;
//# sourceMappingURL=stripe.d.ts.map