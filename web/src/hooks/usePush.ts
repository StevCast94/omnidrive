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
