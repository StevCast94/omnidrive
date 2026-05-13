// OmniDrive Service Worker v2
// No cachea el HTML — solo assets con hash + static files
// SOLUCIÓN: cada deploy de Vercel actualiza los hashes y el SW no interfiere

const CACHE = 'omnidrive-v2';
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/assets/'
];

// Install: solo precachear archivos estáticos (sin HTML)
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate: claims clients + limpia caches viejos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch: cache solo assets con hash (JS/CSS) e imágenes, NUNCA el HTML
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Solo same-origin
  if (url.origin !== self.location.origin) return;

  // HTML requests — siempre a la red, nunca cache
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Assets con hash (JS/CSS) e imágenes — cache first
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname === '/favicon.svg' || url.pathname === '/manifest.json') {
    e.respondWith(
      caches.open(CACHE).then((cache) => {
        return fetch(e.request).then((response) => {
          cache.put(e.request, response.clone());
          return response;
        }).catch(() => caches.match(e.request));
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

// Click en notificación
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(clients.openWindow(url));
});
