'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { captureInstallPrompt } from '@/lib/install';
import { flush, OUTBOX_EVENT, pending } from '@/lib/outbox';

/**
 * App-shell plumbing for offline use (M8): registers the service worker, sends
 * queued writes when the connection returns, and says so calmly while offline.
 */
export function Pwa() {
  const t = useTranslations('shell');
  const [online, setOnline] = useState(true);
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    captureInstallPrompt();
    // Development uses fresh builds on every change; caching them would only get in the way.
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
    }
    setOnline(navigator.onLine);
    pending().then(
      (p) => setWaiting(p.length),
      () => undefined,
    );
    void flush().catch(() => undefined);

    const goOnline = () => {
      setOnline(true);
      void flush().catch(() => undefined);
    };
    const goOffline = () => setOnline(false);
    const onOutbox = (e: Event) => setWaiting((e as CustomEvent<{ count: number }>).detail.count);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener(OUTBOX_EVENT, onOutbox);
    // Covers flaky connections where the 'online' event never fires.
    const timer = setInterval(() => {
      if (navigator.onLine) void flush().catch(() => undefined);
    }, 30_000);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener(OUTBOX_EVENT, onOutbox);
      clearInterval(timer);
    };
  }, []);

  if (online && waiting === 0) return null;
  return (
    <p
      role="status"
      className="mb-4 rounded-lg bg-surface px-4 py-2 text-sm text-muted ring-1 ring-border"
    >
      {online ? t('syncing') : t('offline')}
    </p>
  );
}
