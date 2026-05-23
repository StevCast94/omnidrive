"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePush = usePush;
exports.useNotifications = useNotifications;
// ===== web/src/hooks/usePush.ts =====
const react_1 = require("react");
const push_1 = require("@/lib/push");
const store_1 = require("@/lib/store");
function usePush() {
    const { user } = (0, store_1.useAuthStore)();
    const [permission, setPermission] = (0, react_1.useState)('Notification' in window ? Notification.permission : 'denied');
    const [subscribed, setSubscribed] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        if (!user)
            return;
        (0, push_1.initPush)().then(() => {
            setPermission('Notification' in window ? Notification.permission : 'denied');
            setSubscribed(Notification.permission === 'granted');
        });
    }, [user?.id]);
    const request = async () => {
        const sub = await (0, push_1.subscribeToPush)();
        const perm = 'Notification' in window ? Notification.permission : 'denied';
        setPermission(perm);
        setSubscribed(!!sub);
        return !!sub;
    };
    return { permission, subscribed, request };
}
// ===== web/src/hooks/useNotifications.ts =====
const react_2 = require("react");
const api_1 = require("@/lib/api");
function useNotifications() {
    const { user } = (0, store_1.useAuthStore)();
    const [notifications, setNotifications] = (0, react_1.useState)([]);
    const [unread, setUnread] = (0, react_1.useState)(0);
    const fetch = (0, react_2.useCallback)(async () => {
        if (!user)
            return;
        try {
            const { data: res } = await api_1.api.get('/notifications');
            setNotifications(res.data ?? []);
            setUnread((res.data ?? []).filter((n) => !n.read).length);
        }
        catch { }
    }, [user?.id]);
    const markRead = async (id) => {
        await api_1.api.put(`/notifications/${id}/read`).catch(() => { });
        setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));
        setUnread(u => Math.max(0, u - 1));
    };
    const markAllRead = async () => {
        await api_1.api.put('/notifications/read-all').catch(() => { });
        setNotifications(ns => ns.map(n => ({ ...n, read: true })));
        setUnread(0);
    };
    // Poll every 30s for new notifications
    (0, react_1.useEffect)(() => {
        fetch();
        const t = setInterval(fetch, 30_000);
        return () => clearInterval(t);
    }, [fetch]);
    return { notifications, unread, markRead, markAllRead, refetch: fetch };
}
//# sourceMappingURL=push.js.map