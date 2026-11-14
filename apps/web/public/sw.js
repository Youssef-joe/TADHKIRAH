/* Tadhkirah service worker: offline app shell (M8) and reminder notifications (M6). */
const CSRF = { 'x-tadhkirah-csrf': '1', 'content-type': 'application/json' };

// Bump VERSION to drop every old cache on the next visit.
const VERSION = 'v1';
const STATIC = `static-${VERSION}`; // immutable build assets and icons
const PAGES = `pages-${VERSION}`; // app pages the user has opened
const DATA = `data-${VERSION}`; // a few read-only API responses for offline use
const PRECACHE = ['/offline.html', '/icon-192.png', '/icon.svg', '/manifest.webmanifest'];

/**
 * Only these GET endpoints are kept for offline use (Today, worship log, reflection).
 * Auth, export, notifications and everything else always go to the network.
 */
const OFFLINE_API = [
  /^\/v1\/me$/,
  /^\/v1\/worship\/activities$/,
  /^\/v1\/worship\/logs$/,
  /^\/v1\/reflections\/\d{4}-\d{2}-\d{2}$/,
  /^\/v1\/reflections$/,
  /^\/v1\/reflection\/questions$/,
  /^\/v1\/quran\/summary$/,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC, PAGES, DATA]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

/** Sign-out, account deletion and sign-in ask us to forget everything cached for the previous user. */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'clear-user-data') {
    event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(DATA)]));
  }
});

async function networkFirst(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    // Only successful, non-redirected responses: never cache an error or a sign-in redirect.
    if (response.ok && !response.redirected) await cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function page(request) {
  try {
    return await networkFirst(request, PAGES, 5000);
  } catch {
    // Offline and this exact page was never opened: fall back to Today, then the offline page.
    const cache = await caches.open(PAGES);
    for (const path of ['/ar/app/today', '/en/app/today']) {
      const hit = await cache.match(path);
      if (hit) return hit;
    }
    return (await caches.match('/offline.html')) ?? Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.startsWith('/_next/static/') ||
    /^\/(icon|badge|apple-touch-icon)[\w-]*\.(png|svg)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === 'navigate' && /^\/(ar|en)\/app(\/|$)/.test(url.pathname)) {
    event.respondWith(page(request));
  } else if (OFFLINE_API.some((re) => re.test(url.pathname))) {
    event.respondWith(networkFirst(request, DATA, 6000));
  }
});

self.addEventListener('push', (event) => {
  let data;
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : 'Tadhkirah' };
  }
  const options = {
    body: data.body || '',
    tag: data.tag || 'tadhkirah',
    lang: (data.url || '').startsWith('/en') ? 'en' : 'ar',
    dir: (data.url || '').startsWith('/en') ? 'ltr' : 'rtl',
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    data: { url: data.url || '/', scheduledId: data.scheduledId || null },
    actions:
      data.scheduledId && data.snoozeLabel ? [{ action: 'snooze', title: data.snoozeLabel }] : [],
  };
  event.waitUntil(self.registration.showNotification(data.title || 'Tadhkirah', options));
});

function post(path, body) {
  return fetch(`/v1${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: CSRF,
    body: JSON.stringify(body || {}),
  }).catch(() => undefined);
}

self.addEventListener('notificationclick', (event) => {
  const { url, scheduledId } = event.notification.data || {};
  event.notification.close();
  if (event.action === 'snooze' && scheduledId) {
    event.waitUntil(post(`/reminders/${scheduledId}/snooze`, { minutes: 10 }));
    return;
  }
  event.waitUntil(
    (async () => {
      if (scheduledId) await post(`/notifications/${scheduledId}/opened`);
      const target = new URL(url || '/', self.location.origin).href;
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin && 'focus' in w) {
          await w.focus();
          if ('navigate' in w) await w.navigate(target).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

/* The browser rotated the subscription: re-register it with the same session. */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const res = await fetch('/v1/push/vapid-public-key').catch(() => null);
      const { key } = res && res.ok ? await res.json() : {};
      if (!key) return;
      const pad = '='.repeat((4 - (key.length % 4)) % 4);
      const raw = atob((key + pad).replace(/-/g, '+').replace(/_/g, '/'));
      const sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)),
      });
      await post('/devices', sub.toJSON());
    })(),
  );
});
