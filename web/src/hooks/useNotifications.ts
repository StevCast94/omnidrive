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
    setNotifications(ns => ns.map(n => (n.id === id ? { ...n, read: true } : n)));
    setUnread(u => Math.max(0, u - 1));
  };

  const markAllRead = async () => {
    await api.put('/notifications/read-all').catch(() => {});
    setNotifications(ns => ns.map(n => ({ ...n, read: true })));
    setUnread(0);
  };

  useEffect(() => {
    fetch();
    const t = setInterval(fetch, 30_000);
    return () => clearInterval(t);
  }, [fetch]);

  return { notifications, unread, markRead, markAllRead, refetch: fetch };
}
