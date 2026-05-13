// OmniDrive Service Worker v3
// No cachea el HTML — siempre fetch de red
// Assets con hash van a cache para offline

const CACHE = 'omnidrive-v3';
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // HTML — siempre red, no cache
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    return;
  }

  // Assets con hash (JS/CSS) e icons — cache first con fallback a red
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname === '/favicon.svg' || url.pathname === '/manifest.json' || url.pathname === '/sw.js') {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        const fetchPromise = fetch(e.request).then((res) => {
          if (res.ok) {
            caches.open(CACHE).then((cache) => cache.put(e.request, res.clone()));
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Otros — red con fallback a cache
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
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

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(clients.openWindow(url));
});
