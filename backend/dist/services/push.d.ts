interface PushPayload {
    title: string;
    body: string;
    data?: Record<string, any>;
}
export declare function storePushSub(userId: string, sub: any): void;
export declare function removePushSub(userId: string): void;
export declare function sendPush(userId: string, payload: PushPayload): Promise<boolean>;
export declare function sendPushMany(userIds: string[], payload: PushPayload): Promise<void>;
export declare function notifyBookingStatus(bookingId: string, status: string, tenantId: string, ownerId: string, vehicleName: string): Promise<void>;
export {};
//# sourceMappingURL=push.d.ts.map