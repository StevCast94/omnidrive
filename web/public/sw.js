// OmniDrive Service Worker v1
// Minimal SW: cache de assets + push notifications
// NO usa vite-plugin-pwa — evitamos el CSP que bloqueaba eval()

const CACHE = 'omnidrive-v1';
const ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: precache assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate: limpiar caches viejos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch: serve from cache, fallback to network
self.addEventListener('fetch', (e) => {
  // Solo interceptar requests same-origin
  if (e.request.url.startsWith(self.location.origin)) {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request))
    );
  }
});

// Push notifications
self.addEventListener('push', (e) => {
  let payload = {};
  try {
    payload = e.data?.json() ?? { title: 'OmniDrive', body: 'Nueva notificación' };
  } catch {
    payload = { title: 'OmniDrive', body: e.data?.text() ?? 'Nueva notificación' };
  }

  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data || {},
    vibrate: [200, 100, 200],
  };

  e.waitUntil(self.registration.showNotification(payload.title || 'OmniDrive', options));
});

// Click en notificación
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(clients.openWindow(url));
});
