/**
 * IndexedDB wrapper for offline session recording.
 *
 * Stores three object stores:
 *   - sessions: cached session data (exercises, metadata) for offline access
 *   - syncQueue: pending write operations to sync when online
 *   - meta: app metadata (last sync timestamp, etc.)
 *
 * Uses a minimal promise-based API without external dependencies.
 */

const DB_NAME = 'trainmind-offline';
const DB_VERSION = 1;

// ─── Types ──────────────────────────────────────────────

export interface CachedSession {
  id: string;
  data: unknown; // Full session payload (exercises, athlete, etc.)
  cachedAt: number;
}

export type SyncOp =
  | { type: 'session_log'; sessionId: string; payload: unknown; method: 'POST' | 'PATCH' }
  | { type: 'wellness'; payload: unknown }
  | { type: 'metric'; payload: unknown };

export interface SyncQueueEntry {
  id?: number; // auto-increment
  op: SyncOp;
  createdAt: number;
  retries: number;
  lastError?: string;
  lastAttemptAt?: number;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

// ─── DB Instance ────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available'));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        const store = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
  });
  return dbPromise;
}

// ─── Helpers ────────────────────────────────────────────

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const res = fn(store);
    if (res instanceof Promise) {
      res.then(resolve, reject);
      return;
    }
    res.onsuccess = () => resolve(res.result);
    res.onerror = () => reject(res.error);
  });
}

// ─── Sessions Cache ─────────────────────────────────────

export async function cacheSession(id: string, data: unknown): Promise<void> {
  await withStore('sessions', 'readwrite', (store) =>
    store.put({ id, data, cachedAt: Date.now() } as CachedSession),
  );
}

export async function getCachedSession(id: string): Promise<CachedSession | undefined> {
  return withStore('sessions', 'readonly', (store) => store.get(id) as IDBRequest<CachedSession | undefined>);
}

export async function getAllCachedSessions(): Promise<CachedSession[]> {
  return withStore('sessions', 'readonly', (store) => store.getAll() as IDBRequest<CachedSession[]>);
}

export async function deleteCachedSession(id: string): Promise<void> {
  await withStore('sessions', 'readwrite', (store) => store.delete(id));
}

// ─── Sync Queue ─────────────────────────────────────────

export async function enqueueOp(op: SyncOp): Promise<number> {
  const entry: SyncQueueEntry = { op, createdAt: Date.now(), retries: 0 };
  return withStore('syncQueue', 'readwrite', (store) =>
    store.add(entry) as IDBRequest<IDBValidKey>,
  ) as Promise<number>;
}

export async function getPendingOps(): Promise<SyncQueueEntry[]> {
  return withStore('syncQueue', 'readonly', (store) => store.getAll() as IDBRequest<SyncQueueEntry[]>);
}

export async function deleteQueueEntry(id: number): Promise<void> {
  await withStore('syncQueue', 'readwrite', (store) => store.delete(id));
}

export async function updateQueueEntry(entry: SyncQueueEntry): Promise<void> {
  await withStore('syncQueue', 'readwrite', (store) => store.put(entry));
}

export async function getQueueSize(): Promise<number> {
  return withStore('syncQueue', 'readonly', (store) => store.count() as IDBRequest<number>);
}

// ─── Meta ───────────────────────────────────────────────

export async function setMeta(key: string, value: unknown): Promise<void> {
  await withStore('meta', 'readwrite', (store) => store.put({ key, value } as MetaEntry));
}

export async function getMeta<T = unknown>(key: string): Promise<T | undefined> {
  const res = await withStore('meta', 'readonly', (store) => store.get(key) as IDBRequest<MetaEntry | undefined>);
  return res?.value as T | undefined;
}
