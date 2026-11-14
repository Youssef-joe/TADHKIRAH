import { CSRF_HEADER } from '@tadhkirah/contracts';

/**
 * Offline outbox (WOR-10, REF-8): writes made without a connection are kept in
 * IndexedDB and sent when the connection returns.
 *
 * One entry per resource path, so only the latest write is kept. That matches the
 * API's own rule (idempotent upserts, last write wins). Reflections are sent without
 * their `version`, so an edit made offline is never lost to a version conflict.
 */
export interface OutboxItem {
  path: string;
  method: 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  queuedAt: number;
}

const QUEUEABLE: [RegExp, OutboxItem['method'][]][] = [
  [/^\/worship\/logs\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}$/, ['PUT', 'DELETE']],
  [/^\/worship\/day-flags\/\d{4}-\d{2}-\d{2}$/, ['PUT']],
  [/^\/reflections\/\d{4}-\d{2}-\d{2}$/, ['PUT']],
];

export function isQueueable(method: string, path: string): method is OutboxItem['method'] {
  return QUEUEABLE.some(([re, methods]) => re.test(path) && (methods as string[]).includes(method));
}

const DB_NAME = 'tadhkirah';
const STORE = 'outbox';
export const OUTBOX_EVENT = 'tadhkirah:outbox';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'path' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function announce(count: number) {
  window.dispatchEvent(new CustomEvent(OUTBOX_EVENT, { detail: { count } }));
}

export async function pending(): Promise<OutboxItem[]> {
  if (typeof indexedDB === 'undefined') return [];
  const items = await run('readonly', (s) => s.getAll() as IDBRequest<OutboxItem[]>);
  return items.sort((a, b) => a.queuedAt - b.queuedAt);
}

export async function enqueue(item: Omit<OutboxItem, 'queuedAt'>): Promise<void> {
  await run('readwrite', (s) => s.put({ ...item, queuedAt: Date.now() }));
  announce((await pending()).length);
}

let flushing: Promise<number> | null = null;

/** Sends queued writes in order. Returns how many are still waiting. Safe to call any time. */
export function flush(): Promise<number> {
  flushing ??= (async () => {
    try {
      for (const item of await pending()) {
        const body =
          item.path.startsWith('/reflections/') && item.body
            ? { ...item.body, version: undefined }
            : item.body;
        let res: Response;
        try {
          res = await fetch(`/v1${item.path}`, {
            method: item.method,
            credentials: 'same-origin',
            headers: {
              [CSRF_HEADER]: '1',
              ...(body ? { 'content-type': 'application/json' } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
          });
        } catch {
          break; // still offline
        }
        // Signed out, rate limited or a server problem: keep the write and try later.
        if (res.status === 401 || res.status === 429 || res.status >= 500) break;
        // Sent, or refused for good (e.g. outside the backfill window): either way it leaves the queue.
        await run('readwrite', (s) => s.delete(item.path));
      }
      const left = (await pending()).length;
      announce(left);
      return left;
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

/**
 * Forgets everything kept on this device for the signed-in user: queued writes and
 * cached pages and data. Called on sign-in, sign-out and account deletion.
 */
export async function clearUserData(): Promise<void> {
  try {
    if (typeof indexedDB !== 'undefined') await run('readwrite', (s) => s.clear());
    if (typeof caches !== 'undefined') {
      for (const key of await caches.keys())
        if (!key.startsWith('static-')) await caches.delete(key);
    }
    navigator.serviceWorker?.controller?.postMessage({ type: 'clear-user-data' });
  } catch {
    // Storage may be unavailable (private mode); nothing was kept then.
  }
}
