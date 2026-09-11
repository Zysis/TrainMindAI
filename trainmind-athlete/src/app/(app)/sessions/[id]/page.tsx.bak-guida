'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ArrowLeft, Clock, CheckCircle2, Play, ChevronDown, ChevronUp } from 'lucide-react';

interface Exercise {
  id: string;
  name: string;
  category: string;
  description?: string;
  videoUrl?: string;
  muscleGroups: string[];
}

interface SessionExercise {
  id: string;
  exerciseId: string;
  orderIndex: number;
  sets?: number;
  reps?: string;
  weight?: number;
  duration?: number;
  restTime?: number;
  notes?: string;
  exercise: Exercise;
}

interface SessionDetail {
  id: string;
  title: string;
  date: string;
  duration: number;
  status: string;
  notes?: string;
  sessionExercises: SessionExercise[];
  myLog?: {
    actualRpe?: number;
    notes?: string;
    exerciseChecks?: Record<string, boolean>;
    viewedAt?: string;
  } | null;
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Local state for feedback form
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [expandedEx, setExpandedEx] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getSession(id).then((res: { success: boolean; data?: SessionDetail }) => {
      if (res.success && res.data) {
        setSession(res.data);
        // Pre-fill from existing log
        if (res.data.myLog) {
          if (res.data.myLog.actualRpe) setRpe(res.data.myLog.actualRpe);
          if (res.data.myLog.notes) setNotes(res.data.myLog.notes);
          if (res.data.myLog.exerciseChecks) setChecks(res.data.myLog.exerciseChecks);
          if (res.data.myLog.actualRpe) setSubmitted(true);
        }
      }
      setLoading(false);
    });
  }, [id]);

  async function handleSubmit() {
    if (!session || rpe === null) return;
    setSubmitting(true);

    const res = await api.submitSessionLog({
      trainingSessionId: session.id,
      actualRpe: rpe,
      notes: notes || undefined,
      exerciseChecks: Object.keys(checks).length > 0 ? checks : undefined,
    });

    if (res.success) {
      setSubmitted(true);
    }
    setSubmitting(false);
  }

  function toggleCheck(exerciseId: string) {
    setChecks((prev) => ({ ...prev, [exerciseId]: !prev[exerciseId] }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="px-4 py-10 text-center text-slate-500">Sessione non trovata</div>
    );
  }

  const completedCount = Object.values(checks).filter(Boolean).length;
  const totalExercises = session.sessionExercises.length;

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="bg-gradient-to-b from-teal-600 to-teal-700 px-4 pb-6 pt-4 text-white">
        <button onClick={() => router.back()} className="mb-3 flex items-center gap-1 text-sm text-teal-100 hover:text-white">
          <ArrowLeft size={16} /> Indietro
        </button>
        <h2 className="text-xl font-bold">{session.title}</h2>
        <div className="mt-2 flex items-center gap-4 text-sm text-teal-100">
          <span className="flex items-center gap-1">
            <Clock size={14} /> {session.duration} min
          </span>
          <span>{totalExercises} esercizi</span>
          {session.date && (
            <span>{new Date(session.date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          )}
        </div>
        {session.notes && (
          <p className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-sm text-teal-50">{session.notes}</p>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{completedCount}/{totalExercises} completati</span>
          <span>{totalExercises > 0 ? Math.round((completedCount / totalExercises) * 100) : 0}%</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className="h-full rounded-full bg-teal-500 transition-all duration-300"
            style={{ width: `${totalExercises > 0 ? (completedCount / totalExercises) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Exercise list */}
      <div className="space-y-2 px-4">
        {session.sessionExercises.map((se, idx) => {
          const isChecked = checks[se.exerciseId] || false;
          const isExpanded = expandedEx === se.id;

          return (
            <div
              key={se.id}
              className={`overflow-hidden rounded-xl border transition ${
                isChecked
                  ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-3 p-4">
                {/* Checkbox */}
                <button
                  onClick={() => toggleCheck(se.exerciseId)}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 transition ${
                    isChecked
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {isChecked && <CheckCircle2 size={16} />}
                  {!isChecked && <span className="text-xs font-bold text-slate-400">{idx + 1}</span>}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${isChecked ? 'text-green-700 line-through dark:text-green-400' : 'text-slate-900 dark:text-white'}`}>
                    {se.exercise.name}
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                    {se.sets && <span>{se.sets} serie</span>}
                    {se.reps && <span>× {se.reps} rep</span>}
                    {se.weight && <span>@ {se.weight}kg</span>}
                    {se.duration && <span>{se.duration}s</span>}
                    {se.restTime && <span>🔄 {se.restTime}s pausa</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {se.exercise.videoUrl && (
                    <a
                      href={se.exercise.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg p-1.5 text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/30"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Play size={16} />
                    </a>
                  )}
                  <button
                    onClick={() => setExpandedEx(isExpanded ? null : se.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-700">
                  {se.exercise.description && (
                    <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">{se.exercise.description}</p>
                  )}
                  {se.exercise.muscleGroups.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {se.exercise.muscleGroups.map((mg) => (
                        <span key={mg} className="rounded-full bg-slate-100 px-2 py-0.5 text-2xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          {mg}
                        </span>
                      ))}
                    </div>
                  )}
                  {se.notes && (
                    <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">📝 {se.notes}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* RPE + Feedback form */}
      <div className="mt-6 px-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">
            {submitted ? '✅ Feedback inviato' : 'Feedback post-sessione'}
          </h3>

          {/* RPE scale */}
          <div className="mb-4">
            <label className="mb-2 block text-sm text-slate-600 dark:text-slate-400">RPE (sforzo percepito)</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setRpe(n)}
                  disabled={submitted}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold transition ${
                    rpe === n
                      ? n <= 3 ? 'bg-green-500 text-white'
                        : n <= 6 ? 'bg-yellow-500 text-white'
                        : n <= 8 ? 'bg-orange-500 text-white'
                        : 'bg-red-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
                  } disabled:cursor-not-allowed`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="mb-2 block text-sm text-slate-600 dark:text-slate-400">Note (opzionale)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitted}
              rows={3}
              placeholder="Come ti sei sentito? Qualcosa da segnalare?"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-800"
            />
          </div>

          {!submitted && (
            <button
              onClick={handleSubmit}
              disabled={rpe === null || submitting}
              className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
            >
              {submitting ? 'Invio...' : 'Invia feedback'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
