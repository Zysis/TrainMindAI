'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Calendar, Clock, Dumbbell, Plus, Trash2,
  CheckCircle2, Search, X, Play, Sparkles,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { apiFetch } from '@/lib/auth/fetch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { LiveSessionRecorder } from '@/components/training';

interface ExerciseDetail {
  id: string;
  name: string;
  category: string;
  muscleGroups: string[];
  equipment: string[];
  description: string | null;
}

interface SessionExercise {
  id: string;
  exerciseId: string;
  orderIndex: number;
  sets: number | null;
  reps: string | null;
  weight: number | null;
  duration: number | null;
  restTime: number | null;
  notes: string | null;
  exercise: ExerciseDetail;
}

interface Session {
  id: string;
  title: string;
  date: string;
  duration: number | null;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  rpe: number | null;
  notes: string | null;
  aiModified: boolean;
  athlete: { id: string; firstName: string; lastName: string; position: string } | null;
  week: {
    id: string;
    weekNumber: number;
    trainingPlan: { id: string; name: string };
  };
  sessionExercises: SessionExercise[];
}

interface LibraryExercise {
  id: string;
  name: string;
  category: string;
  muscleGroups: string[];
}

const statusLabels: Record<string, string> = {
  PLANNED: 'Pianificata',
  IN_PROGRESS: 'In corso',
  COMPLETED: 'Completata',
  CANCELLED: 'Annullata',
};

const statusVariants: Record<string, 'default' | 'teal' | 'success' | 'danger'> = {
  PLANNED: 'default',
  IN_PROGRESS: 'teal',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const categoryColors: Record<string, string> = {
  Forza: 'bg-red-100 text-red-700',
  Potenza: 'bg-orange-100 text-orange-700',
  Pliometria: 'bg-amber-100 text-amber-700',
  Velocita: 'bg-yellow-100 text-yellow-700',
  Agilita: 'bg-lime-100 text-lime-700',
  Core: 'bg-emerald-100 text-emerald-700',
  Propriocezione: 'bg-cyan-100 text-cyan-700',
  Prevenzione: 'bg-blue-100 text-blue-700',
  Flessibilita: 'bg-violet-100 text-violet-700',
  Resistenza: 'bg-pink-100 text-pink-700',
  Riabilitazione: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
};

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('training');
  const locale = useLocale();
  const sessionId = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [recordingMode, setRecordingMode] = useState(false);

  const loadSession = async () => {
    try {
      const res = await apiFetch<{ success: boolean; data: Session }>(`/training/sessions/${sessionId}`);
      setSession(res.data);
    } catch {
      toast('error', 'Sessione non trovata');
      router.push('/dashboard/training');
    } finally {
      setLoading(false);
    }
  };

  const loadLibrary = async () => {
    try {
      const res = await apiFetch<{ data: LibraryExercise[] }>('/exercises?limit=100');
      setLibrary(res.data);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadSession();
    loadLibrary();
  }, [sessionId]);

  const handleAddExercise = async (exerciseId: string) => {
    setAdding(true);
    try {
      await apiFetch(`/training/sessions/${sessionId}/exercises`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseId,
          sets: 3,
          reps: '10',
          restTime: 90,
        }),
      });
      toast('success', 'Esercizio aggiunto');
      loadSession();
    } catch {
      toast('error', 'Errore nell\'aggiunta');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveExercise = async (seId: string) => {
    try {
      await apiFetch(`/training/session-exercises/${seId}`, { method: 'DELETE' });
      toast('success', 'Esercizio rimosso');
      loadSession();
    } catch {
      toast('error', 'Errore nella rimozione');
    }
  };

  const handleUpdateExercise = async (seId: string, data: Record<string, unknown>) => {
    try {
      await apiFetch(`/training/session-exercises/${seId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      loadSession();
    } catch {
      toast('error', 'Errore nell\'aggiornamento');
    }
  };

  const handleCompleteSession = async () => {
    try {
      await apiFetch(`/training/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });
      toast('success', 'Sessione completata!');
      loadSession();
    } catch {
      toast('error', 'Errore nel completamento');
    }
  };

  const filteredLibrary = library.filter(
    (ex) =>
      ex.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
      ex.category.toLowerCase().includes(librarySearch.toLowerCase()),
  );

  // Exercises already in session
  const existingExerciseIds = new Set(session?.sessionExercises.map((se) => se.exerciseId) || []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (!session) return null;

  // Check if session can be recorded (not completed or cancelled)
  const canRecord = session.status === 'PLANNED' || session.status === 'IN_PROGRESS';

  // ---- Recording Mode ----
  if (recordingMode && canRecord && session.sessionExercises.length > 0) {
    return (
      <div className="space-y-4">
        {/* Minimal header in recording mode */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => setRecordingMode(false)}
              className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-teal-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Torna alla scheda
            </button>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{session.title}</h1>
          </div>
          {session.athlete && (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {session.athlete.firstName} {session.athlete.lastName}
            </span>
          )}
        </div>

        <LiveSessionRecorder
          sessionId={sessionId}
          exercises={session.sessionExercises}
          athleteId={session.athlete?.id}
          onComplete={() => {
            setRecordingMode(false);
            loadSession();
          }}
          onCancel={() => setRecordingMode(false)}
        />
      </div>
    );
  }

  // ---- Planning Mode (default) ----
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/dashboard/training/${session.week.trainingPlan.id}`}
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-teal-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {session.week.trainingPlan.name} — Settimana {session.week.weekNumber}
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{session.title}</h1>
              <Badge variant={statusVariants[session.status]}>{statusLabels[session.status]}</Badge>
              {session.aiModified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                  <Sparkles className="h-3 w-3" />
                  Modificata da AI
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(session.date).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
              {session.duration && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" /> {session.duration} minuti
                </span>
              )}
              {session.rpe && <span>RPE: {session.rpe}/10</span>}
              {session.athlete && (
                <span>{session.athlete.firstName} {session.athlete.lastName}</span>
              )}
            </div>
            {session.notes && (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{session.notes}</p>
            )}
          </div>

          <div className="flex gap-2">
            {canRecord && session.sessionExercises.length > 0 && (
              <button
                onClick={() => setRecordingMode(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                <Play className="h-4 w-4" />
                Registra
              </button>
            )}
            {session.status === 'PLANNED' && (
              <button
                onClick={handleCompleteSession}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                Completa
              </button>
            )}
            <button
              onClick={() => { setShowAddExercise(true); setLibrarySearch(''); }}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
            >
              <Plus className="h-4 w-4" />
              Aggiungi Esercizio
            </button>
          </div>
        </div>
      </div>

      {/* Exercise list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Esercizi ({session.sessionExercises.length})
        </h2>

        {session.sessionExercises.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-12">
            <Dumbbell className="mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Nessun esercizio aggiunto</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Aggiungi esercizi dalla libreria per creare la scheda</p>
            <button
              onClick={() => { setShowAddExercise(true); setLibrarySearch(''); }}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-800"
            >
              <Plus className="h-4 w-4" />
              Aggiungi esercizio
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {session.sessionExercises.map((se, idx) => (
              <div key={se.id} className="card !p-4">
                <div className="flex items-start gap-3">
                  {/* Index */}
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-sm font-bold text-slate-500 dark:text-slate-400">
                    {idx + 1}
                  </div>

                  {/* Exercise info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">{se.exercise.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-2xs font-medium ${categoryColors[se.exercise.category] || 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                        {se.exercise.category}
                      </span>
                    </div>
                    {se.exercise.muscleGroups.length > 0 && (
                      <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                        {se.exercise.muscleGroups.join(', ')}
                      </p>
                    )}

                    {/* Editable params */}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Serie</label>
                        <input
                          type="number"
                          defaultValue={se.sets ?? ''}
                          className="w-14 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-center text-sm dark:bg-slate-800 dark:text-white"
                          onBlur={(e) => {
                            const v = parseInt(e.target.value);
                            if (v && v !== se.sets) handleUpdateExercise(se.id, { sets: v });
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Reps</label>
                        <input
                          type="text"
                          defaultValue={se.reps ?? ''}
                          className="w-16 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-center text-sm dark:bg-slate-800 dark:text-white"
                          onBlur={(e) => {
                            const v = e.target.value;
                            if (v !== se.reps) handleUpdateExercise(se.id, { reps: v || undefined });
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Kg</label>
                        <input
                          type="number"
                          defaultValue={se.weight ?? ''}
                          className="w-16 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-center text-sm dark:bg-slate-800 dark:text-white"
                          onBlur={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v !== se.weight) handleUpdateExercise(se.id, { weight: v });
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Recupero</label>
                        <input
                          type="number"
                          defaultValue={se.restTime ?? ''}
                          className="w-16 rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-center text-sm dark:bg-slate-800 dark:text-white"
                          onBlur={(e) => {
                            const v = parseInt(e.target.value);
                            if (!isNaN(v) && v !== se.restTime) handleUpdateExercise(se.id, { restTime: v });
                          }}
                        />
                        <span className="text-xs text-slate-400 dark:text-slate-500">s</span>
                      </div>
                    </div>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => handleRemoveExercise(se.id)}
                    className="rounded p-1.5 text-slate-400 dark:text-slate-500 hover:bg-red-50 hover:text-red-600"
                    title={t('removeExercise')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Exercise Drawer / Panel */}
      {showAddExercise && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white dark:bg-slate-800 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Aggiungi Esercizio</h2>
            <button
              onClick={() => setShowAddExercise(false)}
              className="rounded p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="border-b border-slate-200 dark:border-slate-700 px-5 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                placeholder="Cerca esercizi..."
                className="input-field w-full pl-10"
                autoFocus
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredLibrary.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                Nessun esercizio trovato
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredLibrary.map((ex) => {
                  const isAdded = existingExerciseIds.has(ex.id);
                  return (
                    <div
                      key={ex.id}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{ex.name}</span>
                          <span className={`rounded-full px-2 py-0.5 text-2xs font-medium ${categoryColors[ex.category] || 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                            {ex.category}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{ex.muscleGroups.join(', ')}</p>
                      </div>
                      {isAdded ? (
                        <span className="text-xs font-medium text-green-600">Aggiunto</span>
                      ) : (
                        <button
                          onClick={() => handleAddExercise(ex.id)}
                          disabled={adding}
                          className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backdrop for exercise drawer */}
      {showAddExercise && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setShowAddExercise(false)}
        />
      )}
    </div>
  );
}
