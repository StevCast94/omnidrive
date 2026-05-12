import { useState, useEffect } from 'react';

type Permission = 'default' | 'granted' | 'denied';

/**
 * Hook para registro de ServiceWorker + Push Notifications
 * El SW se registra automáticamente al cargar la app.
 * La suscripción push se pide bajo demanda (no automática).
 */
export function usePush() {
  const [swReady, setSwReady] = useState(false);
  const [permission, setPermission] = useState<Permission>(
    () => (typeof Notification !== 'undefined' ? Notification.permission as Permission : 'denied')
  );
  const [subscribed, setSubscribed] = useState(
    () => !!localStorage.getItem('push_subscribed')
  );
  const [swReg, setSwReg] = useState<ServiceWorkerRegistration | null>(null);

  // Registrar SW al montar
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        setSwReg(reg);
        setSwReady(true);
        // Check if already subscribed
        reg.pushManager.getSubscription().then(sub => {
          if (sub) {
            localStorage.setItem('push_subscribed', 'true');
            setSubscribed(true);
          }
        });
      })
      .catch(() => {
        // SW registration failed — app works without it
      });
  }, []);

  /** Solicitar permisos y suscribirse a push */
  const request = async () => {
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as Permission);
      if (perm !== 'granted') return;

      if (!swReg) {
        console.warn('SW not ready yet');
        return;
      }

      // Subscribe to push (VAPID public key needed from backend)
      const sub = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          // VAPID public key — configurar cuando esté disponible en Railway
          localStorage.getItem('vapid_public_key') || ''
        ),
      });

      // Send subscription to backend
      const token = localStorage.getItem('sb_token');
      if (token && sub) {
        fetch('https://omnidrive-production.up.railway.app/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        }).catch(() => {});
      }

      localStorage.setItem('push_subscribed', 'true');
      setSubscribed(true);
    } catch {
      // permission denied or error
    }
  };

  return { swReady, permission, subscribed, request };
}

// Helper: convert base64 to Uint8Array (needed for applicationServerKey)
function urlBase64ToUint8Array(base64String: string) {
  if (!base64String) return new Uint8Array(0);
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0));
}
