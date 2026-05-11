import { api } from './api';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

// Convert base64 VAPID key to Uint8Array
function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from(Array.from(raw).map(c => c.charCodeAt(0)));
}

// ── Register service worker ───────────────────────────────────
export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[SW] Registered:', reg.scope);
    return reg;
  } catch (e) {
    console.error('[SW] Registration failed:', e);
    return null;
  }
}

// ── Request push permission + subscribe ──────────────────────
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!('Notification' in window) || !('PushManager' in window)) {
    console.warn('[Push] Not supported');
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('[Push] Permission denied');
    return null;
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  // Send subscription to backend
  try {
    await api.post('/push/subscribe', {
      endpoint: sub.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')!))),
        auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')!))),
      },
    });
    console.log('[Push] Subscribed and registered with server');
  } catch (e) {
    console.error('[Push] Failed to register subscription:', e);
  }

  return sub;
}

// ── Unsubscribe ───────────────────────────────────────────────
export async function unsubscribeFromPush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await sub.unsubscribe();
    await api.delete('/push/subscribe').catch(() => {});
  }
}

// ── Show local notification (fallback / in-app) ───────────────
export function showLocalNotification(title: string, body: string, data?: any) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icons/icon-192.png', data });
  }
}

// ── Init: register SW + auto-subscribe if already granted ────
export async function initPush() {
  const reg = await registerSW();
  if (!reg) return;

  if (Notification.permission === 'granted') {
    await subscribeToPush();
  }
}
