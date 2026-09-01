'use client';

import { useTranslations } from 'next-intl';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { Exercise } from '@/types';

interface DeleteExerciseModalProps {
  exercise: Exercise | null;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}

/**
 * Conferma della cancellazione di un esercizio.
 *
 * Prima il messaggio conteneva `<strong>{name}</strong>` e veniva reso con
 * `dangerouslySetInnerHTML`. Due problemi in uno:
 *  - next-intl legge `<strong>` come tag rich-text e pretende `t.rich(...)`
 *    con la funzione corrispondente; con `t()` semplice solleva un errore e
 *    stampa il percorso della chiave — da qui "exercises.deleteConfirm" a video;
 *  - il nome dell'esercizio lo scrive l'utente, e finiva dentro l'HTML della
 *    pagina senza nessun filtro.
 * Il grassetto non valeva né l'uno né l'altro: ora il testo e' piano.
 */
export function DeleteExerciseModal({ exercise, onClose, onConfirm, deleting }: DeleteExerciseModalProps) {
  const t = useTranslations('exercises');

  return (
    <ConfirmDialog
      open={!!exercise}
      title={t('deleteExercise')}
      message={t('deleteConfirm', { name: exercise?.name ?? '' })}
      detail={t('deleteWarning')}
      busy={deleting}
      busyLabel={t('deleting')}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
