// ===== web/src/hooks/usePush.ts =====
import { useState, useEffect } from 'react';
import { initPush, subscribeToPush } from '@/lib/push';
import { useAuthStore } from '@/lib/store';

export function usePush() {
  const { user } = useAuthStore();
  const [permission, setPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!user) return;
    initPush().then(() => {
      setPermission('Notification' in window ? Notification.permission : 'denied');
      setSubscribed(Notification.permission === 'granted');
    });
  }, [user?.id]);

  const request = async () => {
    const sub = await subscribeToPush();
    const perm = 'Notification' in window ? Notification.permission : 'denied';
    setPermission(perm);
    setSubscribed(!!sub);
    return !!sub;
  };

  return { permission, subscribed, request };
}


// ===== web/src/hooks/useNotifications.ts =====
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: string;
}

export function useNotifications() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  const fetch = useCallback(async () => {
    if (!user) return;
    try {
      const { data: res } = await api.get('/notifications');
      setNotifications(res.data ?? []);
      setUnread((res.data ?? []).filter((n: Notification) => !n.read).length);
    } catch {}
  }, [user?.id]);

  const markRead = async (id: string) => {
    await api.put(`/notifications/${id}/read`).catch(() => {});
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));
    setUnread(u => Math.max(0, u - 1));
  };

  const markAllRead = async () => {
    await api.put('/notifications/read-all').catch(() => {});
    setNotifications(ns => ns.map(n => ({ ...n, read: true })));
    setUnread(0);
  };

  // Poll every 30s for new notifications
  useEffect(() => {
    fetch();
    const t = setInterval(fetch, 30_000);
    return () => clearInterval(t);
  }, [fetch]);

  return { notifications, unread, markRead, markAllRead, refetch: fetch };
}
