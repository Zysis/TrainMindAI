'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Search, Plus, Dumbbell, Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/auth/fetch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { EXERCISE_CATEGORIES } from '@/lib/constants';
import { AICoachPanel } from '@/components/ai/ai-coach-panel';
import { ExerciseCard } from '@/components/exercises/exercise-card';
import { ExerciseFormModal } from '@/components/exercises/exercise-form-modal';
import { DeleteExerciseModal } from '@/components/exercises/delete-exercise-modal';
import { VideoPlayerModal } from '@/components/exercises/video-player-modal';
import type { Exercise, ExerciseForm } from '@/types';

const emptyForm: ExerciseForm = {
  name: '', category: 'Forza', description: '', muscleGroups: '', equipment: '', videoUrl: '',
};

const categoryColors: Record<string, 'teal' | 'info' | 'warning' | 'danger' | 'success' | 'default'> = {
  Forza: 'danger',
  Potenza: 'warning',
  Pliometria: 'info',
  Agilita: 'teal',
  Velocita: 'success',
  Core: 'default',
  Propriocezione: 'info',
  Prevenzione: 'success',
  Flessibilita: 'teal',
  Resistenza: 'warning',
  Riabilitazione: 'danger',
  Condizionamento: 'warning',
  'Basket-Specifico': 'teal',
};

export default function ExercisesPage() {
  const { toast } = useToast();
  const t = useTranslations('exercises');
  const tCommon = useTranslations('common');
  // Localized category labels (DB values stay in IT -- display layer only)
  const categoryLabels = useMemo<Record<string, string>>(
    () => Object.fromEntries(EXERCISE_CATEGORIES.map((c) => [c, t(`cat_${c}`)])),
    [t]
  );
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [onlyCustom, setOnlyCustom] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ExerciseForm>(emptyForm);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [videoModal, setVideoModal] = useState<{ name: string; url: string } | null>(null);

  // Seed import state
  const [seeding, setSeeding] = useState(false);

  const seedDefaults = async () => {
    setSeeding(true);
    try {
      const res = await apiFetch<{ success: boolean; data: { created: number; skipped: number; total: number } }>(
        '/exercises/seed-defaults',
        { method: 'POST', body: JSON.stringify({}) },
      );
      toast('success', t('importedExercises', { created: res.data.created, skipped: res.data.skipped }));
      loadExercises();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('importError'));
    } finally {
      setSeeding(false);
    }
  };

  const loadExercises = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      if (catFilter) params.set('category', catFilter);
      if (onlyCustom) params.set('onlyCustom', 'true');
      const res = await apiFetch<{ data: Exercise[]; meta: { total: number } }>(`/exercises?${params}`);
      setExercises(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, catFilter, onlyCustom]);

  useEffect(() => {
    const timer = setTimeout(loadExercises, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadExercises]);

  // Open create modal
  const openCreate = () => {
    setEditingExercise(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  // Open edit modal
  const openEdit = (ex: Exercise) => {
    setEditingExercise(ex);
    setForm({
      name: ex.name,
      category: ex.category,
      description: ex.description || '',
      muscleGroups: ex.muscleGroups.join(', '),
      equipment: ex.equipment.join(', '),
      videoUrl: ex.videoUrl || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingExercise(null);
    setForm(emptyForm);
  };

  // Save (create or update)
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!form.name.trim()) {
      toast('error', t('exerciseNameRequired'));
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim() || undefined,
      muscleGroups: form.muscleGroups ? form.muscleGroups.split(',').map((s) => s.trim()).filter(Boolean) : [],
      equipment: form.equipment ? form.equipment.split(',').map((s) => s.trim()).filter(Boolean) : [],
      videoUrl: form.videoUrl.trim() || undefined,
    };

    try {
      if (editingExercise) {
        await apiFetch(`/exercises/${editingExercise.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast('success', t('exerciseUpdated'));
      } else {
        await apiFetch('/exercises', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast('success', t('exerciseCreated'));
      }
      closeModal();
      loadExercises();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/exercises/${deleteTarget.id}`, { method: 'DELETE' });
      toast('success', t('exerciseDeleted', { name: deleteTarget.name }));
      setDeleteTarget(null);
      loadExercises();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  // Group exercises by category
  const grouped = exercises.reduce<Record<string, Exercise[]>>((acc, ex) => {
    if (!acc[ex.category]) acc[ex.category] = [];
    acc[ex.category].push(ex);
    return acc;
  }, {});

  const isEditing = !!editingExercise;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={seedDefaults}
            disabled={seeding}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {seeding ? t('importing') : t('importDefaults')}
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" /> {t('newExercise')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder={t('searchExercises')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 dark:text-slate-500 dark:placeholder:text-slate-500 dark:text-slate-400 focus:outline-none"
          />
        </div>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300"
        >
          <option value="">{t('allCategories')}</option>
          {EXERCISE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{categoryLabels[c] || c}</option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyCustom}
            onChange={(e) => setOnlyCustom(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-teal-600"
          />
          {t('onlyCustom')}
        </label>
      </div>

      {/* AI Coach Panel */}
      <AICoachPanel category={catFilter || undefined} compact />

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      ) : exercises.length === 0 ? (
        <div className="card flex h-48 items-center justify-center">
          <div className="text-center">
            <Dumbbell className="mx-auto mb-2 h-10 w-10 text-slate-300 dark:text-slate-500" />
            <p className="text-sm text-slate-400 dark:text-slate-500">{t('noExercisesFound')}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, items]) => (
              <div key={category}>
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant={categoryColors[category] || 'default'}>{categoryLabels[category] || category}</Badge>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{items.length} {tCommon('exercises')}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((ex) => (
                    <ExerciseCard
                      key={ex.id}
                      exercise={ex}
                      onEdit={openEdit}
                      onDelete={setDeleteTarget}
                      onPlayVideo={(name, url) => setVideoModal({ name, url })}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <ExerciseFormModal
        open={showModal}
        onClose={closeModal}
        form={form}
        onFormChange={setForm}
        onSave={handleSave}
        saving={saving}
        isEditing={isEditing}
        categoryLabels={categoryLabels}
      />

      {/* Delete Confirmation Modal */}
      <DeleteExerciseModal
        exercise={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        deleting={deleting}
      />

      {/* Video Player Modal */}
      <VideoPlayerModal
        video={videoModal}
        onClose={() => setVideoModal(null)}
      />
    </div>
  );
}
