/* Tadhkirah service worker: reminder notifications (M6). Offline caching arrives in M8. */
const CSRF = { 'x-tadhkirah-csrf': '1', 'content-type': 'application/json' };

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

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
    icon: '/icon.svg',
    badge: '/icon.svg',
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
