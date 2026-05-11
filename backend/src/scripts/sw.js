// ============================================================
// OmniDrive Service Worker — Push + Cache + Offline
// ============================================================

const CACHE = 'omnidrive-v1';
const OFFLINE_URL = '/offline.html';

const PRECACHE = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
];

// ── Install: precache shell ──────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// ── Activate: purge old caches ───────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first for API, cache-first for assets ─────
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin (except API)
  if (request.method !== 'GET') return;

  // API: network-first, no cache
  if (url.pathname.startsWith('/api')) {
    e.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ data: null, error: 'Sin conexión' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503,
        })
      )
    );
    return;
  }

  // Static assets: stale-while-revalidate
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(request);
      const fetchPromise = fetch(request).then(res => {
        if (res.ok) cache.put(request, res.clone());
        return res;
      }).catch(() => null);

      return cached ?? fetchPromise ?? caches.match(OFFLINE_URL);
    })
  );
});

// ── Push: receive and show notification ──────────────────────
self.addEventListener('push', e => {
  let payload = { title: 'OmniDrive', body: 'Nueva notificación', data: {} };
  try { payload = e.data?.json() ?? payload; } catch {}

  const { title, body, data } = payload;

  const icon = '/icons/icon-192.png';
  const badge = '/icons/badge-72.png';

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      data,
      vibrate: [100, 50, 100],
      requireInteraction: false,
      actions: data?.bookingId ? [
        { action: 'open', title: 'Ver reserva' },
        { action: 'dismiss', title: 'Ignorar' },
      ] : [],
    })
  );
});

// ── Notification click ────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();

  if (e.action === 'dismiss') return;

  const { data } = e.notification;
  const targetUrl = data?.bookingId
    ? `/bookings/${data.bookingId}`
    : data?.url ?? '/dashboard';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
      const existing = cls.find(c => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); existing.navigate(targetUrl); }
      else clients.openWindow(targetUrl);
    })
  );
});

// ── Background sync (retry failed tracking posts) ────────────
self.addEventListener('sync', e => {
  if (e.tag === 'sync-tracking') {
    e.waitUntil(syncPendingTracking());
  }
});

async function syncPendingTracking() {
  // In production: read from IndexedDB and retry failed tracking posts
  const cache = await caches.open('tracking-queue');
  const keys = await cache.keys();
  await Promise.all(keys.map(async req => {
    try {
      const res = await fetch(req);
      if (res.ok) await cache.delete(req);
    } catch {}
  }));
}
