/**
 * Sync manager: drains the offline queue when connectivity is restored.
 *
 * Strategy:
 *   - FIFO processing by createdAt (IndexedDB getAll returns insertion order).
 *   - Last-write-wins: on 409/conflict, we re-send with a force flag; the
 *     server trusts the latest client timestamp.
 *   - Exponential backoff per entry (retries stored on the queue row).
 *   - Single-flight: a module-level `running` flag prevents concurrent drains.
 */

import { apiFetch } from '@/lib/auth/fetch';
import {
  getPendingOps,
  deleteQueueEntry,
  updateQueueEntry,
  getQueueSize,
  setMeta,
  type SyncQueueEntry,
  type SyncOp,
} from './db';

const MAX_RETRIES = 5;

let running = false;
let listeners: Array<(status: SyncStatus) => void> = [];

export interface SyncStatus {
  running: boolean;
  pending: number;
  lastSyncAt?: number;
  lastError?: string;
}

let currentStatus: SyncStatus = { running: false, pending: 0 };

export function subscribeSync(fn: (s: SyncStatus) => void): () => void {
  listeners.push(fn);
  fn(currentStatus);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

function emit(patch: Partial<SyncStatus>) {
  currentStatus = { ...currentStatus, ...patch };
  listeners.forEach((l) => l(currentStatus));
}

// ─── Op dispatch ────────────────────────────────────────

async function dispatchOp(op: SyncOp): Promise<void> {
  switch (op.type) {
    case 'session_log': {
      const path = `/training/sessions/${op.sessionId}/log`;
      await apiFetch(path, {
        method: op.method,
        body: JSON.stringify({ ...(op.payload as object), _lww: true }),
      });
      return;
    }
    case 'wellness': {
      await apiFetch('/wellness', {
        method: 'POST',
        body: JSON.stringify(op.payload),
      });
      return;
    }
    case 'metric': {
      await apiFetch('/athletes/metrics', {
        method: 'POST',
        body: JSON.stringify(op.payload),
      });
      return;
    }
    default: {
      const _exhaustive: never = op;
      throw new Error(`Unknown op type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

// ─── Retry logic ────────────────────────────────────────

function backoffMs(retries: number): number {
  return Math.min(30_000, 1000 * Math.pow(2, retries));
}

async function processEntry(entry: SyncQueueEntry): Promise<boolean> {
  // Skip if still in backoff window
  if (entry.lastAttemptAt && entry.retries > 0) {
    const wait = backoffMs(entry.retries);
    if (Date.now() - entry.lastAttemptAt < wait) return false;
  }
  try {
    await dispatchOp(entry.op);
    if (entry.id != null) await deleteQueueEntry(entry.id);
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const nextRetries = entry.retries + 1;
    if (nextRetries >= MAX_RETRIES) {
      // Give up — drop from queue to avoid poison pill blocking
      if (entry.id != null) await deleteQueueEntry(entry.id);
      console.error('[sync] Dropping op after max retries', entry, message);
      return false;
    }
    await updateQueueEntry({
      ...entry,
      retries: nextRetries,
      lastError: message,
      lastAttemptAt: Date.now(),
    });
    return false;
  }
}

// ─── Drain ──────────────────────────────────────────────

export async function drainQueue(): Promise<void> {
  if (running) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  running = true;
  emit({ running: true });

  try {
    const entries = await getPendingOps();
    for (const entry of entries) {
      await processEntry(entry);
    }
    const pending = await getQueueSize();
    await setMeta('lastSyncAt', Date.now());
    emit({ running: false, pending, lastSyncAt: Date.now(), lastError: undefined });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    emit({ running: false, lastError: message });
  } finally {
    running = false;
  }
}

export async function refreshPendingCount(): Promise<number> {
  const pending = await getQueueSize();
  emit({ pending });
  return pending;
}

// ─── Auto-start on reconnect ────────────────────────────

let installed = false;

export function installSyncListeners(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('online', () => {
    drainQueue();
  });

  // Periodic retry while app is open
  setInterval(() => {
    if (navigator.onLine) drainQueue();
  }, 60_000);

  // Initial drain on load
  if (navigator.onLine) drainQueue();

  refreshPendingCount();
}
