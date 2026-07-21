'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Flag,
  CheckCircle2,
  Plus,
  X,
  Timer,
  Users,
  Save,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/auth/fetch';
import { useToast } from '@/components/ui/toast';

// ─── Types ──────────────────────────────────────────────

interface Lap {
  startMs: number;
  endMs: number | null;
  durationMs: number;
}

interface AthleteInfo {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  position: string;
}

interface Entry {
  id: string;
  athleteId: string;
  totalActiveMs: number;
  laps: Lap[];
  athlete: AthleteInfo;
}

interface FieldSession {
  id: string;
  calendarEventId: string;
  teamId: string | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
  entries: Entry[];
  team: { id: string; name: string; color: string | null } | null;
  calendarEvent: { id: string; title: string; startTime: string; endTime: string; type: string } | null;
}

interface TimerState {
  running: boolean;
  elapsed: number; // total accumulated ms (paused time)
  lapStart: number | null; // Date.now() when current lap started, null if paused
  laps: Lap[];
}

// ─── Helpers ────────────────────────────────────────────

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatMsShort(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// ─── Page ───────────────────────────────────────────────

export default function FieldTrainingPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('calendar');
  const eventId = params.eventId as string;

  const [session, setSession] = useState<FieldSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [showAddAthlete, setShowAddAthlete] = useState(false);
  const [availableAthletes, setAvailableAthletes] = useState<AthleteInfo[]>([]);

  // Timer states per athlete
  const [timers, setTimers] = useState<Map<string, TimerState>>(new Map());
  const animRef = useRef<number | null>(null);
  const [, setTick] = useState(0); // force re-renders for timer display

  // ─── Initialize session ─────────────────────────────────

  const initRef = useRef(false);
  const initSession = useCallback(async () => {
    if (initRef.current) return; // prevent StrictMode double-invoke
    initRef.current = true;
    setLoading(true);
    try {
      // Try to get existing session
      const res = await apiFetch<{ data: { session: FieldSession } }>(`/field-training/by-event/${eventId}`);
      setSession(res.data.session);
      initTimersFromEntries(res.data.session.entries);
    } catch {
      // Create new session (POST handles race conditions gracefully)
      try {
        const res = await apiFetch<{ data: { session: FieldSession } }>('/field-training/start', {
          method: 'POST',
          body: JSON.stringify({ calendarEventId: eventId }),
        });
        setSession(res.data.session);
        initTimersFromEntries(res.data.session.entries);
      } catch (err) {
        toast('error', err instanceof Error ? err.message : t('ftSessionStartError'));
        initRef.current = false; // allow retry
      }
    }
    setLoading(false);
  }, [eventId]);

  const initTimersFromEntries = (entries: Entry[]) => {
    const map = new Map<string, TimerState>();
    for (const entry of entries) {
      map.set(entry.athleteId, {
        running: false,
        elapsed: entry.totalActiveMs,
        lapStart: null,
        laps: entry.laps || [],
      });
    }
    setTimers(map);
  };

  useEffect(() => {
    initSession();
  }, [initSession]);

  // ─── Animation loop for running timers ──────────────────

  useEffect(() => {
    const tick = () => {
      setTick((t) => t + 1);
      animRef.current = requestAnimationFrame(tick);
    };

    // Check if any timer is running
    let anyRunning = false;
    for (const [, ts] of timers) {
      if (ts.running) { anyRunning = true; break; }
    }

    if (anyRunning) {
      animRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [timers]);

  // ─── Timer actions ──────────────────────────────────────

  const getDisplayTime = (ts: TimerState): number => {
    if (ts.running && ts.lapStart) {
      return ts.elapsed + (Date.now() - ts.lapStart);
    }
    return ts.elapsed;
  };

  const startTimer = (athleteId: string) => {
    setTimers((prev) => {
      const map = new Map(prev);
      const ts = map.get(athleteId);
      if (!ts || ts.running) return prev;
      map.set(athleteId, { ...ts, running: true, lapStart: Date.now() });
      return map;
    });
  };

  const pauseTimer = (athleteId: string) => {
    setTimers((prev) => {
      const map = new Map(prev);
      const ts = map.get(athleteId);
      if (!ts || !ts.running || !ts.lapStart) return prev;
      const lapDuration = Date.now() - ts.lapStart;
      const newElapsed = ts.elapsed + lapDuration;
      const newLaps = [...ts.laps, {
        startMs: ts.lapStart,
        endMs: Date.now(),
        durationMs: lapDuration,
      }];
      map.set(athleteId, { running: false, elapsed: newElapsed, lapStart: null, laps: newLaps });
      return map;
    });
  };

  const addLap = (athleteId: string) => {
    setTimers((prev) => {
      const map = new Map(prev);
      const ts = map.get(athleteId);
      if (!ts || !ts.running || !ts.lapStart) return prev;
      const now = Date.now();
      const lapDuration = now - ts.lapStart;
      const newElapsed = ts.elapsed + lapDuration;
      const newLaps = [...ts.laps, {
        startMs: ts.lapStart,
        endMs: now,
        durationMs: lapDuration,
      }];
      map.set(athleteId, { running: true, elapsed: newElapsed, lapStart: now, laps: newLaps });
      return map;
    });
  };

  const resetTimer = (athleteId: string) => {
    setTimers((prev) => {
      const map = new Map(prev);
      map.set(athleteId, { running: false, elapsed: 0, lapStart: null, laps: [] });
      return map;
    });
  };

  // ─── Start/Stop All ─────────────────────────────────────

  const startAll = () => {
    setTimers((prev) => {
      const map = new Map(prev);
      for (const [id, ts] of map) {
        if (!ts.running) {
          map.set(id, { ...ts, running: true, lapStart: Date.now() });
        }
      }
      return map;
    });
  };

  const pauseAll = () => {
    setTimers((prev) => {
      const map = new Map(prev);
      for (const [id, ts] of map) {
        if (ts.running && ts.lapStart) {
          const lapDuration = Date.now() - ts.lapStart;
          map.set(id, {
            running: false,
            elapsed: ts.elapsed + lapDuration,
            lapStart: null,
            laps: [...ts.laps, { startMs: ts.lapStart, endMs: Date.now(), durationMs: lapDuration }],
          });
        }
      }
      return map;
    });
  };

  // ─── Autosave ───────────────────────────────────────────

  const [saving, setSaving] = useState(false);

  const saveData = useCallback(async (showToast = false) => {
    if (!session) return;
    const entries = Array.from(timers.entries()).map(([athleteId, ts]) => ({
      athleteId,
      totalActiveMs: getDisplayTime(ts),
      laps: ts.laps,
    }));
    if (showToast) setSaving(true);
    try {
      await apiFetch(`/field-training/${session.id}/entries`, {
        method: 'PUT',
        body: JSON.stringify(entries),
      });
      if (showToast) toast('success', t('gtDataSaved'));
    } catch (err) {
      if (showToast) toast('error', err instanceof Error ? err.message : t('gtSaveError'));
    } finally {
      if (showToast) setSaving(false);
    }
  }, [session, timers]);

  // Autosave every 15 seconds
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(saveData, 15000);
    return () => clearInterval(interval);
  }, [saveData, session]);

  // ─── Complete session ───────────────────────────────────

  const completeSession = async () => {
    if (!session) return;

    // Build final entries with correct elapsed times BEFORE state update
    const now = Date.now();
    const finalEntries = Array.from(timers.entries()).map(([athleteId, ts]) => {
      let totalActiveMs = ts.elapsed;
      const laps = [...ts.laps];
      // If timer is running, add current lap
      if (ts.running && ts.lapStart) {
        const lapDuration = now - ts.lapStart;
        totalActiveMs += lapDuration;
        laps.push({ startMs: ts.lapStart, endMs: now, durationMs: lapDuration });
      }
      return { athleteId, totalActiveMs, laps };
    });

    // Pause all timers (visual update)
    pauseAll();

    setCompleting(true);
    try {
      // Save final data directly (bypass stale state)
      await apiFetch(`/field-training/${session.id}/entries`, {
        method: 'PUT',
        body: JSON.stringify(finalEntries),
      });

      // Complete session
      const res = await apiFetch<{ data: { completed: boolean; trainingSessions: number } }>(
        `/field-training/${session.id}/complete`,
        { method: 'PUT', body: JSON.stringify({}) },
      );
      toast('success', t('ftSessionCompletedMsg', { count: res.data.trainingSessions }));
      router.push('/dashboard/calendar');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('gtCompletionError'));
    }
    setCompleting(false);
  };

  // ─── Add/Remove athlete ─────────────────────────────────

  const loadAvailableAthletes = async () => {
    try {
      const res = await apiFetch<{ data: AthleteInfo[] }>('/athletes?limit=100');
      const existing = new Set(session?.entries.map((e) => e.athleteId) || []);
      setAvailableAthletes((res.data || []).filter((a) => !existing.has(a.id)));
    } catch { /* ignore */ }
    setShowAddAthlete(true);
  };

  const addAthlete = async (athleteId: string) => {
    if (!session) return;
    try {
      const res = await apiFetch<{ data: { entry: Entry } }>(`/field-training/${session.id}/athletes`, {
        method: 'POST',
        body: JSON.stringify({ athleteId }),
      });
      setSession((prev) => prev ? { ...prev, entries: [...prev.entries, res.data.entry] } : prev);
      setTimers((prev) => {
        const map = new Map(prev);
        map.set(athleteId, { running: false, elapsed: 0, lapStart: null, laps: [] });
        return map;
      });
      setAvailableAthletes((prev) => prev.filter((a) => a.id !== athleteId));
      toast('success', t('ftAthleteAdded'));
    } catch {
      toast('error', t('ftAddAthleteError'));
    }
  };

  const removeAthlete = async (athleteId: string) => {
    if (!session) return;
    try {
      await apiFetch(`/field-training/${session.id}/athletes/${athleteId}`, { method: 'DELETE' });
      setSession((prev) => prev ? { ...prev, entries: prev.entries.filter((e) => e.athleteId !== athleteId) } : prev);
      setTimers((prev) => {
        const map = new Map(prev);
        map.delete(athleteId);
        return map;
      });
      toast('success', t('ftAthleteRemoved'));
    } catch {
      toast('error', t('ftRemoveAthleteError'));
    }
  };

  // ─── Render ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <p className="text-slate-500 dark:text-slate-400">{t('gtSessionNotFound')}</p>
        <button
          onClick={() => router.push('/dashboard/calendar')}
          className="text-sm text-teal-600 hover:underline"
        >
          Torna al calendario
        </button>
      </div>
    );
  }

  const isCompleted = session.status === 'COMPLETED';
  const anyRunning = Array.from(timers.values()).some((ts) => ts.running);
  const totalEntries = session.entries.length;

  // Summary stats
  const totalActiveTime = Array.from(timers.values()).reduce((sum, ts) => sum + getDisplayTime(ts), 0);
  const avgActiveTime = totalEntries > 0 ? totalActiveTime / totalEntries : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/calendar')}
            className="rounded-lg p-2 text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              <Timer className="mr-2 inline h-6 w-6 text-orange-600" />
              {t('title')}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {session.calendarEvent?.title || t('ftFieldTraining')}
              {session.team && (
                <span className="ml-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: session.team.color || '#94a3b8' }}
                >
                  {session.team.name}
                </span>
              )}
              {isCompleted && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  <CheckCircle2 className="h-3 w-3" /> {t('gtCompleted')}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isCompleted && (
            <>
              <button
                onClick={() => saveData(true)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? t('gtSaving') : t('gtSave')}
              </button>
              {!anyRunning ? (
                <button
                  onClick={startAll}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  <Play className="h-4 w-4" />
                  {t('ftStartAll')}
                </button>
              ) : (
                <button
                  onClick={pauseAll}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                >
                  <Pause className="h-4 w-4" />
                  {t('ftPauseAll')}
                </button>
              )}
              <button
                onClick={completeSession}
                disabled={completing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {completing ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {t('ftCompleteSession')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">{t('ftAthletes')}</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{totalEntries}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Timer className="h-4 w-4" />
            <span className="text-xs font-medium">{t('ftTotalActiveTime')}</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{formatMs(totalActiveTime)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Timer className="h-4 w-4" />
            <span className="text-xs font-medium">{t('ftAvgPerAthlete')}</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{formatMs(avgActiveTime)}</p>
        </div>
      </div>

      {/* Add athlete button */}
      {!isCompleted && (
        <div className="flex items-center gap-2">
          <button
            onClick={loadAvailableAthletes}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:border-teal-400 hover:text-teal-600"
          >
            <Plus className="h-4 w-4" />
            {t('ftAddAthlete')}
          </button>
        </div>
      )}

      {/* Add athlete dropdown */}
      {showAddAthlete && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('ftSelectAthleteToAdd')}</h3>
            <button onClick={() => setShowAddAthlete(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300">
              <X className="h-4 w-4" />
            </button>
          </div>
          {availableAthletes.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">{t('ftAllAthletesIn')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {availableAthletes.map((a) => (
                <button
                  key={a.id}
                  onClick={() => addAthlete(a.id)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm transition-colors hover:bg-teal-50 hover:border-teal-300"
                >
                  {a.jerseyNumber != null && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-2xs font-bold text-slate-600 dark:text-slate-400">
                      {a.jerseyNumber}
                    </span>
                  )}
                  <span className="font-medium text-slate-700 dark:text-slate-300">{a.lastName} {a.firstName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Athlete timer cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {session.entries.map((entry) => {
          const ts = timers.get(entry.athleteId);
          if (!ts) return null;
          return (
            <AthleteTimerCard
              key={entry.athleteId}
              athlete={entry.athlete}
              timerState={ts}
              displayTime={getDisplayTime(ts)}
              isCompleted={isCompleted}
              onStart={() => startTimer(entry.athleteId)}
              onPause={() => pauseTimer(entry.athleteId)}
              onLap={() => addLap(entry.athleteId)}
              onReset={() => resetTimer(entry.athleteId)}
              onRemove={() => removeAthlete(entry.athleteId)}
            />
          );
        })}
      </div>

      {session.entries.length === 0 && (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900">
          <Users className="h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-400 dark:text-slate-500">{t('ftNoAthletesInSession')}</p>
          {!isCompleted && (
            <button
              onClick={loadAvailableAthletes}
              className="text-sm text-teal-600 hover:underline"
            >
              {t('ftAddAthletes')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Athlete Timer Card ─────────────────────────────────

function AthleteTimerCard({
  athlete,
  timerState,
  displayTime,
  isCompleted,
  onStart,
  onPause,
  onLap,
  onReset,
  onRemove,
}: {
  athlete: AthleteInfo;
  timerState: TimerState;
  displayTime: number;
  isCompleted: boolean;
  onStart: () => void;
  onPause: () => void;
  onLap: () => void;
  onReset: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations('calendar');
  const [showLaps, setShowLaps] = useState(false);
  const { running, laps } = timerState;

  return (
    <div className={`rounded-xl border bg-white dark:bg-slate-800 px-4 py-3 transition-shadow ${
      running ? 'border-green-300 shadow-sm shadow-green-100' : 'border-slate-200 dark:border-slate-700'
    }`}>
      {/* Top row: Name + Timer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          {athlete.jerseyNumber != null && (
            <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              running ? 'bg-green-100 text-green-700' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
            }`}>
              {athlete.jerseyNumber}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {athlete.lastName} {athlete.firstName}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{athlete.position}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {running && <span className="h-2 w-2 animate-pulse rounded-full bg-green-500 flex-shrink-0" />}
          <span className={`font-mono text-xl font-bold tabular-nums ${
            running ? 'text-green-600' : displayTime > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-300'
          }`}>
            {formatMs(displayTime)}
          </span>
        </div>
      </div>

      {/* Bottom row: Controls + Laps */}
      <div className="mt-2.5 flex items-center justify-between">
        {!isCompleted ? (
          <div className="flex items-center gap-1.5">
            {!running ? (
              <button
                onClick={onStart}
                className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
              >
                <Play className="h-3 w-3" />
                {displayTime > 0 ? t('ftResume') : t('ftStart')}
              </button>
            ) : (
              <>
                <button
                  onClick={onPause}
                  className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                >
                  <Pause className="h-3 w-3" />
                </button>
                <button
                  onClick={onLap}
                  className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  <Flag className="h-3 w-3" />
                </button>
              </>
            )}
            {!running && displayTime > 0 && (
              <button
                onClick={onReset}
                className="rounded-md border border-slate-200 dark:border-slate-700 p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
            {!running && displayTime === 0 && (
              <button onClick={onRemove} className="rounded-md p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ) : <div />}

        {laps.length > 0 && (
          <button
            onClick={() => setShowLaps(!showLaps)}
            className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
          >
            {laps.length} lap
            {showLaps ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
      </div>

      {/* Laps detail (expandable) */}
      {showLaps && laps.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 dark:border-slate-700 pt-2">
          {laps.map((lap, i) => (
            <span key={i} className="text-xs text-slate-500 dark:text-slate-400">
              <span className="text-slate-400 dark:text-slate-500">L{i + 1}</span> {formatMsShort(lap.durationMs)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
