'use client';

import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/modal';
import type { Exercise } from '@/types';

interface DeleteExerciseModalProps {
  exercise: Exercise | null;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}

export function DeleteExerciseModal({ exercise, onClose, onConfirm, deleting }: DeleteExerciseModalProps) {
  const t = useTranslations('exercises');
  const tCommon = useTranslations('common');

  return (
    <Modal
      open={!!exercise}
      onClose={onClose}
      title={t('deleteExercise')}
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? t('deleting') : tCommon('delete')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-700 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: t('deleteConfirm', { name: exercise?.name || '' }) }} />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('deleteWarning')}
        </p>
      </div>
    </Modal>
  );
}
