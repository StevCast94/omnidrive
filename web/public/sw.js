// OmniDrive Service Worker v4
// Solo cachea assets estáticos con hash.
// NO intercepta navegaciones (HTML) ni requests del OAuth callback.
// Evita el error "Failed to convert value to 'Response'" que rompe el login con Google.

const CACHE = 'omnidrive-v4';
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // ── NO interceptar navegaciones ni /auth/ ──
  // Las navegaciones y el callback OAuth deben ir directo a la red.
  if (e.request.mode === 'navigate') return;
  if (url.pathname.startsWith('/auth/')) return;

  // ── Solo cachear assets estáticos ──
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.svg' ||
    url.pathname === '/manifest.json'
  ) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // ── Otros assets (no navegaciones) ──
  if (e.request.destination === 'style' ||
      e.request.destination === 'script' ||
      e.request.destination === 'font' ||
      e.request.destination === 'image') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // ── Todo lo demás (API calls, etc) ──
  // No cachear, solo red
  return;
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
