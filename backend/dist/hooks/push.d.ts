export declare function usePush(): {
    permission: any;
    subscribed: any;
    request: () => Promise<boolean>;
};
export interface Notification {
    id: string;
    type: string;
    title: string;
    body?: string;
    data?: Record<string, any>;
    read: boolean;
    createdAt: string;
}
export declare function useNotifications(): {
    notifications: any;
    unread: any;
    markRead: (id: string) => Promise<void>;
    markAllRead: () => Promise<void>;
    refetch: any;
};
//# sourceMappingURL=push.d.ts.map