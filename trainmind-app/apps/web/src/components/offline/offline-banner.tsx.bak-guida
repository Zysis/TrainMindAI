'use client';

import { useEffect, useState } from 'react';
import { CloudOff, CloudUpload, Check, Loader2 } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import {
  installSyncListeners,
  subscribeSync,
  drainQueue,
  refreshPendingCount,
  type SyncStatus,
} from '@/lib/offline/sync-manager';

/**
 * Thin status strip shown at the top of the app when offline, or when there
 * are pending operations to sync. Auto-hides when everything is clean.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const [status, setStatus] = useState<SyncStatus>({ running: false, pending: 0 });
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    installSyncListeners();
    const unsub = subscribeSync(setStatus);
    refreshPendingCount();
    return unsub;
  }, []);

  useEffect(() => {
    if (!status.running && status.pending === 0 && status.lastSyncAt) {
      setJustSynced(true);
      const t = setTimeout(() => setJustSynced(false), 2500);
      return () => clearTimeout(t);
    }
  }, [status.running, status.pending, status.lastSyncAt]);

  if (online && status.pending === 0 && !status.running && !justSynced) return null;

  // Offline
  if (!online) {
    return (
      <div className="flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800 border-b border-amber-200">
        <CloudOff className="h-3.5 w-3.5" />
        Modalità offline — le modifiche verranno sincronizzate al ripristino della rete
        {status.pending > 0 && (
          <span className="ml-1 rounded-full bg-amber-200 px-2 py-0.5 text-2xs">
            {status.pending} in coda
          </span>
        )}
      </div>
    );
  }

  // Syncing
  if (status.running) {
    return (
      <div className="flex items-center justify-center gap-2 bg-teal-50 px-4 py-2 text-xs font-medium text-teal-800 border-b border-teal-200">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Sincronizzazione in corso… ({status.pending} operazioni)
      </div>
    );
  }

  // Pending but online (idle between retries)
  if (status.pending > 0) {
    return (
      <div className="flex items-center justify-center gap-2 bg-blue-50 px-4 py-2 text-xs font-medium text-blue-800 border-b border-blue-200">
        <CloudUpload className="h-3.5 w-3.5" />
        {status.pending} operazioni in attesa di sincronizzazione
        <button
          onClick={() => drainQueue()}
          className="ml-2 rounded border border-blue-300 bg-white dark:bg-slate-800 px-2 py-0.5 text-2xs font-semibold hover:bg-blue-100"
        >
          Sincronizza ora
        </button>
      </div>
    );
  }

  // Just synced
  if (justSynced) {
    return (
      <div className="flex items-center justify-center gap-2 bg-green-50 px-4 py-2 text-xs font-medium text-green-800 border-b border-green-200">
        <Check className="h-3.5 w-3.5" />
        Tutte le modifiche sincronizzate
      </div>
    );
  }

  return null;
}
