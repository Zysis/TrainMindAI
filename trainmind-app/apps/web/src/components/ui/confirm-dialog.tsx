'use client';

import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/modal';

/**
 * Conferma di un'azione distruttiva, al posto del `confirm()` del browser.
 *
 * Il dialog nativo mostra "localhost:3000 dice", non si puo' formattare, ha i
 * pulsanti nella lingua del browser e blocca il thread: fuori posto in un'app
 * che per il resto ha i suoi modali.
 */

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Frase principale: cosa sta per succedere. */
  message: ReactNode;
  /** Riga piccola sotto: la conseguenza, se serve dirla. */
  detail?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** In corso: disabilita il pulsante ed evita il doppio invio. */
  busy?: boolean;
  busyLabel?: string;
  /** `danger` (rosso) per le cancellazioni, `default` per il resto. */
  tone?: 'danger' | 'default';
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  detail,
  confirmLabel,
  cancelLabel,
  busy = false,
  busyLabel,
  tone = 'danger',
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const tCommon = useTranslations('common');

  const confirmClass =
    tone === 'danger'
      ? 'bg-red-600 hover:bg-red-700'
      : 'bg-teal-700 hover:bg-teal-800';

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 disabled:opacity-50"
          >
            {cancelLabel ?? tCommon('cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${confirmClass}`}
          >
            {busy ? (busyLabel ?? `${tCommon('delete')}…`) : (confirmLabel ?? tCommon('delete'))}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        {tone === 'danger' && (
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
        )}
        <div className="space-y-1.5">
          <p className="text-sm text-slate-700 dark:text-slate-300">{message}</p>
          {detail && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{detail}</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
