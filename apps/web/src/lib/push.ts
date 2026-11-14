import { api, ApiError } from './api';

/** Web Push on this device (docs/04-architecture.md, Module E). */
export type PushState = 'unsupported' | 'ios-install' | 'denied' | 'unavailable' | 'off' | 'on';

const supported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

/** iOS only allows Web Push for sites added to the Home Screen. */
const isIosBrowserTab = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !(
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone
  );

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function pushState(): Promise<PushState> {
  if (!supported()) return isIosBrowserTab() ? 'ios-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const { key } = await api<{ key: string | null }>('/push/vapid-public-key');
  if (!key) return 'unavailable';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Mac/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : 'Linux';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : 'Safari';
  return `${browser} · ${os}`;
}

/** Asks permission, subscribes, and registers the device. Returns the resulting state. */
export async function enablePush(): Promise<PushState> {
  const { key } = await api<{ key: string | null }>('/push/vapid-public-key');
  if (!key) return 'unavailable';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(key),
    }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  try {
    await api('/devices', {
      method: 'POST',
      body: { endpoint: json.endpoint, keys: json.keys, label: deviceLabel() },
    });
  } catch (err) {
    // Linked to another account on this browser: start fresh with a new subscription.
    if (err instanceof ApiError && err.code === 'reminders.device_taken') {
      await sub.unsubscribe();
      const fresh = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(key),
      });
      const f = fresh.toJSON() as typeof json;
      await api('/devices', {
        method: 'POST',
        body: { endpoint: f.endpoint, keys: f.keys, label: deviceLabel() },
      });
    } else throw err;
  }
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api('/devices/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(
      () => undefined,
    );
    await sub.unsubscribe();
  }
  return 'off';
}
