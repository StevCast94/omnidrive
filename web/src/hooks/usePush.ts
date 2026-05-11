import { useState } from 'react';

type Permission = 'default' | 'granted' | 'denied';

export function usePush() {
  const [permission] = useState<Permission>(
    () => (typeof Notification !== 'undefined' ? Notification.permission as Permission : 'denied')
  );
  const [subscribed] = useState(
    () => !!localStorage.getItem('push_subscribed')
  );

  const request = async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        localStorage.setItem('push_subscribed', 'true');
      }
    } catch { /* silent */ }
  };

  return { permission, subscribed, request };
}
