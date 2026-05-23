export declare function holdDeposit(bookingId: string, tenantId: string, amount: number): Promise<void>;
export declare function releasePayment(bookingId: string, tenantId: string, ownerId: string, totalAmount: number, serviceFee: number): Promise<void>;
export declare function refundPayment(bookingId: string, tenantId: string, amount: number): Promise<void>;
export declare function requestWithdrawal(userId: string, amount: number, bankAccount: string): Promise<void>;
//# sourceMappingURL=wallet.d.ts.map