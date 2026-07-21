'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClipboardList, Search, Clock, Plus, ChevronRight, Trash2, Dumbbell,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/auth/fetch';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';

// ─── Types ───────────────────────────────────────────────

interface SessionExercise {
  id: string;
  orderIndex: number;
  sets: number | null;
  reps: string | null;
  weight: number | null;
  duration: number | null;
  exercise: { id: string; name: string; category: string };
}

interface SessionTemplate {
  id: string;
  title: string;
  duration: number;
  notes: string | null;
  sessionExercises: SessionExercise[];
  _count: { sessionExercises: number };
  updatedAt: string;
}

// ─── Page ────────────────────────────────────────────────

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', duration: '60', notes: '' });
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('sessions');
  const tCommon = useTranslations('common');

  const loadSessions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('templates', '1');
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('limit', '30');

      const res = await apiFetch<{
        success: boolean;
        data: SessionTemplate[];
        meta: { total: number; page: number; totalPages: number };
      }>(`/training/sessions?${params}`);
      setSessions(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [page]);

  useEffect(() => {
    const timer = setTimeout(loadSessions, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      await apiFetch('/training/session-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          duration: parseInt(form.duration) || 60,
          notes: form.notes || undefined,
        }),
      });
      toast('success', t('sessionCreatedToast'));
      setShowCreate(false);
      setForm({ title: '', duration: '60', notes: '' });
      loadSessions();
    } catch {
      toast('error', t('sessionCreateError'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm(t('deleteTemplateConfirm'))) return;
    try {
      await apiFetch(`/training/session-templates/${id}`, { method: 'DELETE' });
      toast('success', t('sessionDeletedToast'));
      loadSessions();
    } catch {
      toast('error', 'Errore nell\'eliminazione');
    }
  };

  // Group exercises by category for display
  const categoryColors: Record<string, string> = {
    FORZA: 'bg-red-100 text-red-700',
    CARDIO: 'bg-blue-100 text-blue-700',
    MOBILITA: 'bg-purple-100 text-purple-700',
    TECNICA: 'bg-amber-100 text-amber-700',
    PLIOMETRIA: 'bg-green-100 text-green-700',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
        >
          <Plus className="h-4 w-4" />
          {t('newSession')}
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={t('searchSessions')}
          className="input-field w-full pl-10"
        />
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span className="font-medium text-slate-700 dark:text-slate-300">{total}</span> sessioni nella libreria
      </div>

      {/* Sessions grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16">
          <ClipboardList className="mb-3 h-12 w-12 text-slate-300 dark:text-slate-500" />
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">Nessuna sessione</p>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">Crea la tua prima sessione di allenamento</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            Crea Sessione
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => router.push(`/dashboard/sessions/${s.id}`)}
              className="card-hover group cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-teal-700 truncate">
                    {s.title}
                  </h3>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {s.duration} min
                    </span>
                    <span className="flex items-center gap-1">
                      <Dumbbell className="h-3 w-3" />
                      {s._count.sessionExercises} esercizi
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => handleDelete(e, s.id)}
                    className="rounded p-1.5 text-slate-300 dark:text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition"
                    title={tCommon('delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <ChevronRight className="h-5 w-5 text-slate-300 dark:text-slate-500 group-hover:text-teal-600" />
                </div>
              </div>

              {/* Exercise chips */}
              {s.sessionExercises.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {s.sessionExercises.slice(0, 5).map((se) => (
                    <span
                      key={se.id}
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                        categoryColors[se.exercise.category] || 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {se.exercise.name}
                      {se.sets && se.reps ? ` ${se.sets}×${se.reps}` : ''}
                    </span>
                  ))}
                  {s._count.sessionExercises > 5 && (
                    <span className="rounded-md bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs text-slate-400 dark:text-slate-500">
                      +{s._count.sessionExercises - 5}
                    </span>
                  )}
                </div>
              )}

              {s._count.sessionExercises === 0 && (
                <p className="mt-3 text-xs text-slate-400 dark:text-slate-500 italic">
                  Nessun esercizio — clicca per aggiungere
                </p>
              )}

              {s.notes && (
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500 line-clamp-2">{s.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 30 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            Precedente
          </button>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Pagina {page} di {Math.ceil(total / 30)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / 30)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            Successiva
          </button>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t('newSession')}
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700"
            >
              Annulla
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !form.title.trim()}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {creating ? 'Creazione...' : 'Crea Sessione'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label={t('sessionNameLabel')}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="es. Forza — Upper Body"
          />
          <Input
            label={t('durationLabel')}
            type="number"
            value={form.duration}
            onChange={(e) => setForm({ ...form, duration: e.target.value })}
            placeholder="60"
          />
          <Input
            label={t('notesLabel')}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder={t('notesPlaceholder')}
          />
        </div>
      </Modal>
    </div>
  );
}
