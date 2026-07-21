'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Play, ChevronLeft, ChevronRight, Check,
  Dumbbell, Clock, Trophy,
} from 'lucide-react';
import { apiFetch } from '@/lib/auth/fetch';
import { useToast } from '@/components/ui/toast';
import { RestTimer } from './rest-timer';
import { cacheSession, enqueueOp } from '@/lib/offline/db';
import { drainQueue } from '@/lib/offline/sync-manager';

// ============================================================
// Types
// ============================================================

interface ExerciseDetail {
  id: string;
  name: string;
  category: string;
  muscleGroups: string[];
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

/** Single completed set data */
interface CompletedSet {
  reps: number;
  weight: number;
  rpe: number | null;
  completed: boolean;
}

/** Per-exercise completion data, stored in completedSets JSON */
interface ExerciseLogData {
  sets: CompletedSet[];
  notes: string;
}

/** Full completedSets structure: { [sessionExerciseId]: ExerciseLogData } */
type CompletedSetsMap = Record<string, ExerciseLogData>;

interface LiveSessionRecorderProps {
  sessionId: string;
  exercises: SessionExercise[];
  athleteId?: string;
  onComplete: () => void;
  onCancel: () => void;
}

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

// ============================================================
// Component
// ============================================================

export function LiveSessionRecorder({
  sessionId,
  exercises,
  athleteId,
  onComplete,
  onCancel,
}: LiveSessionRecorderProps) {
  const { toast } = useToast();

  // Current exercise index for swipe navigation
  const [currentIdx, setCurrentIdx] = useState(0);

  // All logged data
  const [logData, setLogData] = useState<CompletedSetsMap>(() => {
    const init: CompletedSetsMap = {};
    for (const se of exercises) {
      const plannedSets = se.sets ?? 3;
      const plannedWeight = se.weight ?? 0;
      const plannedReps = parseReps(se.reps);
      init[se.id] = {
        sets: Array.from({ length: plannedSets }, () => ({
          reps: plannedReps,
          weight: plannedWeight,
          rpe: null,
          completed: false,
        })),
        notes: '',
      };
    }
    return init;
  });

  // Session-level data
  const [sessionRpe, setSessionRpe] = useState<number | null>(null);
  const [sessionNotes, setSessionNotes] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Autosave ref
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Helpers ----

  function parseReps(reps: string | null): number {
    if (!reps) return 0;
    // Handle formats like "8-12" (take the lower), "10", etc.
    const match = reps.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  const currentExercise = exercises[currentIdx];
  const currentLog = currentExercise ? logData[currentExercise.id] : null;

  // ---- Session timer ----

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ---- Start recording ----

  const startRecording = async () => {
    setIsRecording(true);
    // Cache session payload for offline access
    try {
      await cacheSession(sessionId, { exercises, athleteId });
    } catch { /* ignore */ }
    // Mark session as IN_PROGRESS
    try {
      await apiFetch(`/training/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'IN_PROGRESS' }),
      });
    } catch {
      // Non-blocking — works offline
    }
  };

  // ---- Autosave to localStorage ----

  const autosave = useCallback(() => {
    try {
      const data = {
        sessionId,
        logData,
        elapsedSeconds,
        sessionRpe,
        sessionNotes,
        currentIdx,
        timestamp: Date.now(),
      };
      localStorage.setItem(`trainmind_session_${sessionId}`, JSON.stringify(data));
    } catch {
      // localStorage might not be available
    }
  }, [sessionId, logData, elapsedSeconds, sessionRpe, sessionNotes, currentIdx]);

  // Autosave on data change (debounced)
  useEffect(() => {
    if (!isRecording) return;
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    autosaveTimeoutRef.current = setTimeout(autosave, 2000);
    return () => {
      if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    };
  }, [logData, isRecording, autosave]);

  // Restore from autosave on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`trainmind_session_${sessionId}`);
      if (saved) {
        const data = JSON.parse(saved);
        // Only restore if less than 4 hours old
        if (Date.now() - data.timestamp < 4 * 60 * 60 * 1000) {
          setLogData(data.logData);
          setElapsedSeconds(data.elapsedSeconds || 0);
          setSessionRpe(data.sessionRpe);
          setSessionNotes(data.sessionNotes || '');
          setCurrentIdx(data.currentIdx || 0);
          setIsRecording(true);
          toast('success', 'Sessione recuperata dall\'autosalvataggio');
        }
      }
    } catch {
      // ignore
    }
  }, [sessionId]);

  // ---- Update set data ----

  const updateSet = (seId: string, setIdx: number, field: keyof CompletedSet, value: number | boolean | null) => {
    setLogData((prev) => {
      const updated = { ...prev };
      const exerciseLog = { ...updated[seId] };
      const sets = [...exerciseLog.sets];
      sets[setIdx] = { ...sets[setIdx], [field]: value };
      exerciseLog.sets = sets;
      updated[seId] = exerciseLog;
      return updated;
    });
  };

  const toggleSetCompleted = (seId: string, setIdx: number) => {
    setLogData((prev) => {
      const updated = { ...prev };
      const exerciseLog = { ...updated[seId] };
      const sets = [...exerciseLog.sets];
      sets[setIdx] = { ...sets[setIdx], completed: !sets[setIdx].completed };
      exerciseLog.sets = sets;
      updated[seId] = exerciseLog;
      return updated;
    });
  };

  const addSet = (seId: string) => {
    setLogData((prev) => {
      const updated = { ...prev };
      const exerciseLog = { ...updated[seId] };
      const lastSet = exerciseLog.sets[exerciseLog.sets.length - 1];
      exerciseLog.sets = [
        ...exerciseLog.sets,
        { reps: lastSet?.reps ?? 0, weight: lastSet?.weight ?? 0, rpe: null, completed: false },
      ];
      updated[seId] = exerciseLog;
      return updated;
    });
  };

  const removeSet = (seId: string, setIdx: number) => {
    setLogData((prev) => {
      const updated = { ...prev };
      const exerciseLog = { ...updated[seId] };
      if (exerciseLog.sets.length <= 1) return prev;
      exerciseLog.sets = exerciseLog.sets.filter((_, i) => i !== setIdx);
      updated[seId] = exerciseLog;
      return updated;
    });
  };

  const updateExerciseNotes = (seId: string, notes: string) => {
    setLogData((prev) => ({
      ...prev,
      [seId]: { ...prev[seId], notes },
    }));
  };

  // ---- Navigation ----

  const goNext = () => {
    if (currentIdx < exercises.length - 1) setCurrentIdx(currentIdx + 1);
  };

  const goPrev = () => {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  };

  // ---- Stats calculation ----

  const getCompletionStats = () => {
    let totalSets = 0;
    let completedSets = 0;
    let totalVolume = 0;

    for (const se of exercises) {
      const exLog = logData[se.id];
      if (!exLog) continue;
      for (const set of exLog.sets) {
        totalSets++;
        if (set.completed) {
          completedSets++;
          totalVolume += set.reps * set.weight;
        }
      }
    }

    return {
      totalSets,
      completedSets,
      completionPct: totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0,
      totalVolume: Math.round(totalVolume),
    };
  };

  // ---- Save session ----

  const saveSession = async () => {
    setSaving(true);

    // Build completedSets payload
    const completedSets: Record<string, { sets: CompletedSet[]; notes: string }> = {};
    for (const se of exercises) {
      completedSets[se.exerciseId] = logData[se.id];
    }
    const payload = {
      actualRpe: sessionRpe,
      actualDuration: Math.ceil(elapsedSeconds / 60),
      completedSets,
      notes: sessionNotes || undefined,
      clientTimestamp: Date.now(), // for last-write-wins
    };

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    const cleanupAndComplete = (msg: string) => {
      try {
        localStorage.removeItem(`trainmind_session_${sessionId}`);
      } catch { /* ignore */ }
      toast('success', msg);
      onComplete();
    };

    if (isOffline) {
      // Queue for later sync
      try {
        await enqueueOp({
          type: 'session_log',
          sessionId,
          payload,
          method: 'POST',
        });
        cleanupAndComplete('Sessione salvata offline — sarà sincronizzata');
      } catch {
        toast('error', 'Impossibile salvare offline');
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      await apiFetch(`/training/sessions/${sessionId}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      cleanupAndComplete('Sessione salvata con successo!');
    } catch {
      // Network/server failure → fall back to queue
      try {
        await enqueueOp({
          type: 'session_log',
          sessionId,
          payload,
          method: 'POST',
        });
        drainQueue(); // fire-and-forget retry
        cleanupAndComplete('Salvataggio in coda — riprova automaticamente');
      } catch {
        toast('error', 'Errore nel salvataggio della sessione');
      }
    } finally {
      setSaving(false);
    }
  };

  // ---- Completion stats ----
  const stats = getCompletionStats();

  // ---- Pre-recording screen ----

  if (!isRecording) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="rounded-2xl bg-teal-50 p-6 mb-6">
          <Dumbbell className="h-12 w-12 text-teal-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Registra Sessione</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{exercises.length} esercizi in programma</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">Il timer partira' automaticamente</p>
        <button
          onClick={startRecording}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-8 py-3 text-base font-semibold text-white hover:bg-teal-800 transition-colors"
        >
          <Play className="h-5 w-5" />
          Inizia Registrazione
        </button>
        <button
          onClick={onCancel}
          className="mt-3 text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400"
        >
          Annulla
        </button>
      </div>
    );
  }

  // ---- Summary screen ----

  if (showSummary) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Riepilogo Sessione</h2>
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
            <Clock className="mr-1 inline h-4 w-4" />
            {formatElapsed(elapsedSeconds)}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-teal-50 p-4 text-center">
            <p className="text-2xl font-bold text-teal-700">{stats.completedSets}/{stats.totalSets}</p>
            <p className="text-xs text-teal-600 mt-1">Serie completate</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{stats.completionPct}%</p>
            <p className="text-xs text-blue-600 mt-1">Completamento</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-4 text-center">
            <p className="text-2xl font-bold text-amber-700">{stats.totalVolume.toLocaleString()}</p>
            <p className="text-xs text-amber-600 mt-1">Volume (kg)</p>
          </div>
        </div>

        {/* RPE */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">RPE Sessione (1-10)</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
              <button
                key={v}
                onClick={() => setSessionRpe(v)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                  sessionRpe === v
                    ? 'bg-teal-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Note sessione</label>
          <textarea
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            placeholder="Come e' andata la sessione?"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowSummary(false)}
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900"
          >
            Torna agli esercizi
          </button>
          <button
            onClick={saveSession}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Trophy className="h-4 w-4" />
            )}
            {saving ? 'Salvataggio...' : 'Salva Sessione'}
          </button>
        </div>
      </div>
    );
  }

  // ---- Main recording UI ----

  return (
    <div className="space-y-4">
      {/* Top bar: timer + progress */}
      <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-lg font-bold tabular-nums">{formatElapsed(elapsedSeconds)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400 dark:text-slate-500">
            {stats.completedSets}/{stats.totalSets} serie
          </span>
          <div className="h-2 w-20 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-teal-500 transition-all"
              style={{ width: `${stats.completionPct}%` }}
            />
          </div>
        </div>
        <button
          onClick={() => setShowSummary(true)}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium hover:bg-slate-700"
        >
          Termina
        </button>
      </div>

      {/* Exercise navigation pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {exercises.map((se, idx) => {
          const exLog = logData[se.id];
          const allDone = exLog?.sets.every((s) => s.completed);
          const someDone = exLog?.sets.some((s) => s.completed);
          return (
            <button
              key={se.id}
              onClick={() => setCurrentIdx(idx)}
              className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                idx === currentIdx
                  ? 'bg-teal-700 text-white'
                  : allDone
                    ? 'bg-green-100 text-green-700'
                    : someDone
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Current exercise card */}
      {currentExercise && currentLog && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          {/* Exercise header */}
          <div className="border-b border-slate-100 dark:border-slate-700 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{currentExercise.exercise.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-2xs font-medium ${categoryColors[currentExercise.exercise.category] || 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                    {currentExercise.exercise.category}
                  </span>
                </div>
                {currentExercise.exercise.muscleGroups.length > 0 && (
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{currentExercise.exercise.muscleGroups.join(', ')}</p>
                )}
              </div>
              <span className="text-sm text-slate-400 dark:text-slate-500">
                {currentIdx + 1}/{exercises.length}
              </span>
            </div>
            {/* Target info */}
            <div className="flex gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
              {currentExercise.sets && <span>Target: {currentExercise.sets} serie</span>}
              {currentExercise.reps && <span>x {currentExercise.reps} reps</span>}
              {currentExercise.weight && <span>@ {currentExercise.weight} kg</span>}
            </div>
          </div>

          {/* Sets table */}
          <div className="px-4 py-3">
            {/* Header */}
            <div className="grid grid-cols-[2rem_1fr_1fr_4rem_2.5rem] gap-2 mb-2 text-xs font-medium text-slate-400 dark:text-slate-500">
              <span className="text-center">#</span>
              <span className="text-center">Reps</span>
              <span className="text-center">Kg</span>
              <span className="text-center">RPE</span>
              <span></span>
            </div>

            {/* Set rows */}
            <div className="space-y-2">
              {currentLog.sets.map((set, setIdx) => (
                <div
                  key={setIdx}
                  className={`grid grid-cols-[2rem_1fr_1fr_4rem_2.5rem] items-center gap-2 rounded-lg px-1 py-1.5 transition-colors ${
                    set.completed ? 'bg-green-50' : ''
                  }`}
                >
                  {/* Set number */}
                  <span className="text-center text-sm font-medium text-slate-400 dark:text-slate-500">{setIdx + 1}</span>

                  {/* Reps */}
                  <input
                    type="number"
                    inputMode="numeric"
                    value={set.reps || ''}
                    onChange={(e) => updateSet(currentExercise.id, setIdx, 'reps', parseInt(e.target.value) || 0)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-2 text-center text-sm font-medium focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />

                  {/* Weight */}
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    value={set.weight || ''}
                    onChange={(e) => updateSet(currentExercise.id, setIdx, 'weight', parseFloat(e.target.value) || 0)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-2 text-center text-sm font-medium focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />

                  {/* RPE (mini selector) */}
                  <select
                    value={set.rpe ?? ''}
                    onChange={(e) => updateSet(currentExercise.id, setIdx, 'rpe', e.target.value ? parseInt(e.target.value) : null)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-1 py-2 text-center text-xs focus:border-teal-500 focus:outline-none"
                  >
                    <option value="">-</option>
                    {[6, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>

                  {/* Complete toggle */}
                  <button
                    onClick={() => toggleSetCompleted(currentExercise.id, setIdx)}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                      set.completed
                        ? 'bg-green-600 text-white'
                        : 'border border-slate-200 dark:border-slate-700 text-slate-300 hover:border-green-400 hover:text-green-500'
                    }`}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add/remove set */}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => addSet(currentExercise.id)}
                className="text-xs font-medium text-teal-700 hover:text-teal-800"
              >
                + Aggiungi serie
              </button>
              {currentLog.sets.length > 1 && (
                <button
                  onClick={() => removeSet(currentExercise.id, currentLog.sets.length - 1)}
                  className="text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-red-500"
                >
                  - Rimuovi ultima
                </button>
              )}
            </div>
          </div>

          {/* Exercise notes */}
          <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3">
            <input
              type="text"
              value={currentLog.notes}
              onChange={(e) => updateExerciseNotes(currentExercise.id, e.target.value)}
              placeholder="Note per questo esercizio..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>
      )}

      {/* Rest timer */}
      <RestTimer defaultSeconds={currentExercise?.restTime ?? 90} />

      {/* Navigation arrows */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={currentIdx === 0}
          className="inline-flex items-center gap-1 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
          Precedente
        </button>

        {currentIdx < exercises.length - 1 ? (
          <button
            onClick={goNext}
            className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Successivo
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => setShowSummary(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
          >
            <Trophy className="h-4 w-4" />
            Termina sessione
          </button>
        )}
      </div>
    </div>
  );
}
