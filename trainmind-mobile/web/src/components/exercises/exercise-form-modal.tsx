'use client';

import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EXERCISE_CATEGORIES } from '@/lib/constants';
import type { ExerciseForm } from '@/types';

interface ExerciseFormModalProps {
  open: boolean;
  onClose: () => void;
  form: ExerciseForm;
  onFormChange: (form: ExerciseForm) => void;
  onSave: (e?: React.FormEvent) => void;
  saving: boolean;
  isEditing: boolean;
  categoryLabels: Record<string, string>;
}

export function ExerciseFormModal({
  open,
  onClose,
  form,
  onFormChange,
  onSave,
  saving,
  isEditing,
  categoryLabels,
}: ExerciseFormModalProps) {
  const t = useTranslations('exercises');
  const tCommon = useTranslations('common');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? t('editExercise') : t('newExercise')}
      size="lg"
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={() => onSave()}
            disabled={saving}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {saving
              ? isEditing ? t('saving') : t('creating')
              : isEditing ? t('saveChanges') : t('createExercise')}
          </button>
        </>
      }
    >
      <form onSubmit={onSave} className="space-y-4">
        <Input
          label={t('exerciseNameLabel')}
          required
          value={form.name}
          onChange={(e) => onFormChange({ ...form, name: e.target.value })}
          placeholder={t('exerciseNamePlaceholder')}
        />
        <Select
          label={t('categoryRequired')}
          options={EXERCISE_CATEGORIES.map((c) => ({ value: c, label: categoryLabels[c] || c }))}
          value={form.category}
          onChange={(e) => onFormChange({ ...form, category: e.target.value })}
        />
        <div>
          <label className="label mb-1.5 block">{t('descriptionLabel')}</label>
          <textarea
            value={form.description}
            onChange={(e) => onFormChange({ ...form, description: e.target.value })}
            placeholder={t('descriptionPlaceholder')}
            rows={3}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 dark:text-slate-500 dark:placeholder:text-slate-500 dark:text-slate-400 focus:border-teal-300 focus:outline-none focus:ring-1 focus:ring-teal-300"
          />
        </div>
        <Input
          label={t('muscleGroups')}
          value={form.muscleGroups}
          onChange={(e) => onFormChange({ ...form, muscleGroups: e.target.value })}
          placeholder={t('muscleGroupsPlaceholder')}
        />
        <Input
          label={t('equipment')}
          value={form.equipment}
          onChange={(e) => onFormChange({ ...form, equipment: e.target.value })}
          placeholder={t('equipmentPlaceholder')}
        />
        <Input
          label={t('videoUrl')}
          type="url"
          value={form.videoUrl}
          onChange={(e) => onFormChange({ ...form, videoUrl: e.target.value })}
          placeholder="https://youtube.com/watch?v=..."
        />
      </form>
    </Modal>
  );
}
