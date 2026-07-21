'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Play,
  Pause,
  CheckCircle2,
  Plus,
  X,
  Users,
  Save,
  AlertTriangle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/auth/fetch';
import { useToast } from '@/components/ui/toast';

// ─── Types ──────────────────────────────────────────────

interface ApiEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: { message?: string };
}

/** Stint uses quarter-elapsed ms (0 → quarterDurationMs), NOT wall-clock */
interface Stint {
  quarter: number;
  inMs: number;       // quarter elapsed ms when entered
  outMs: number | null;
  durationMs: number;
}

interface AthleteInfo {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  position: string;
}

interface PlayerEntry {
  id: string;
  athleteId: string;
  totalPlayingMs: number;
  stints: Stint[];
  onCourt: boolean;
  athlete: AthleteInfo;
}

interface GameSession {
  id: string;
  calendarEventId: string;
  teamId: string | null;
  status: string;
  quarters: number;
  quarterDurationMs: number;
  overtimes: number;
  currentQuarter: number;
  startedAt: string;
  completedAt: string | null;
  entries: PlayerEntry[];
  team: { id: string; name: string; color: string | null } | null;
  calendarEvent: { id: string; title: string; startTime: string; endTime: string; type: string } | null;
}

interface PlayerTimer {
  onCourt: boolean;
  /** Quarter elapsed ms when current stint started. null = off court or timer not running */
  stintStartElapsed: number | null;
  stints: Stint[];
}

// ─── Helpers ────────────────────────────────────────────

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatTime(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// ─── Page ───────────────────────────────────────────────

export default function GameTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params?.eventId as string;
  const { toast } = useToast();
  const t = useTranslations('calendar');

  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [playerTimers, setPlayerTimers] = useState<Map<string, PlayerTimer>>(new Map());
  const [quarterRunning, setQuarterRunning] = useState(false);
  const [quarterTimeLeft, setQuarterTimeLeft] = useState(0);
  const [currentQuarter, setCurrentQuarter] = useState(1);

  /** Wall-clock when quarter play/resume started */
  const quarterWallStart = useRef<number | null>(null);
  /** Accumulated quarter elapsed ms before last pause */
  const quarterElapsedAccum = useRef(0);

  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showAddAthlete, setShowAddAthlete] = useState(false);
  const [availableAthletes, setAvailableAthletes] = useState<AthleteInfo[]>([]);
  const [, setTick] = useState(0);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Quarter elapsed helper ───────────────────────────
  /** Returns how many ms have elapsed in current quarter (paused = frozen) */
  const getQuarterElapsed = useCallback((): number => {
    let e = quarterElapsedAccum.current;
    if (quarterRunning && quarterWallStart.current) {
      e += Date.now() - quarterWallStart.current;
    }
    return e;
  }, [quarterRunning]);

  // ─── Load / Create session ────────────────────────────
  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const res = await apiFetch<ApiEnvelope<{ session: GameSession }>>(`/game/by-event/${eventId}`);
        if (res.success && res.data?.session) { initFromSession(res.data.session); return; }
      } catch { /* not found → create */ }

      try {
        const res = await apiFetch<ApiEnvelope<{ session: GameSession }>>('/game/start', {
          method: 'POST',
          body: JSON.stringify({ calendarEventId: eventId }),
        });
        if (res.success && res.data?.session) {
          initFromSession(res.data.session);
        } else {
          setError(res.error?.message || t('gtSessionStartError'));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('gtNetworkError'));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const initFromSession = useCallback((s: GameSession) => {
    setSession(s);
    setCurrentQuarter(s.currentQuarter);
    setQuarterTimeLeft(s.quarterDurationMs);
    quarterElapsedAccum.current = 0;

    const map = new Map<string, PlayerTimer>();
    for (const entry of s.entries) {
      map.set(entry.athleteId, {
        onCourt: entry.onCourt,
        stintStartElapsed: null, // timer not running yet
        stints: entry.stints || [],
      });
    }
    setPlayerTimers(map);
    setLoading(false);
  }, []);

  // ─── Tick loop ────────────────────────────────────────
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setTick((t) => t + 1); // force re-render for live bars

      if (!quarterRunning || !quarterWallStart.current) return;

      const elapsed = quarterElapsedAccum.current + (Date.now() - quarterWallStart.current);
      const qDur = session?.quarterDurationMs || 600000;
      const remaining = qDur - elapsed;

      if (remaining <= 0) {
        // Quarter ended — finalize all on-court stints
        setQuarterTimeLeft(0);
        setQuarterRunning(false);
        const finalElapsed = qDur; // clamp to quarter duration
        quarterWallStart.current = null;
        quarterElapsedAccum.current = 0;

        setPlayerTimers((prev) => {
          const next = new Map(prev);
          for (const [aid, pt] of next) {
            if (pt.onCourt && pt.stintStartElapsed != null) {
              const dur = finalElapsed - pt.stintStartElapsed;
              next.set(aid, {
                ...pt,
                // Keep onCourt = true (carry to next quarter), but close stint
                stintStartElapsed: null,
                stints: [...pt.stints, { quarter: currentQuarter, inMs: pt.stintStartElapsed, outMs: finalElapsed, durationMs: dur }],
              });
            }
          }
          return next;
        });
        toast('info', `Q${currentQuarter} terminato`);
      } else {
        setQuarterTimeLeft(remaining);
      }
    }, 250);

    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [quarterRunning, session?.quarterDurationMs, currentQuarter, toast]);

  // ─── Quarter controls ─────────────────────────────────
  const startQuarter = () => {
    const elapsed = getQuarterElapsed();
    quarterWallStart.current = Date.now();
    setQuarterRunning(true);

    // Start stints for all on-court players
    setPlayerTimers((prev) => {
      const next = new Map(prev);
      for (const [aid, pt] of next) {
        if (pt.onCourt && pt.stintStartElapsed == null) {
          next.set(aid, { ...pt, stintStartElapsed: elapsed });
        }
      }
      return next;
    });
  };

  const pauseQuarter = () => {
    const elapsed = getQuarterElapsed();
    // Accumulate elapsed time
    quarterElapsedAccum.current = elapsed;
    quarterWallStart.current = null;
    setQuarterRunning(false);

    // Close all on-court stints (keep onCourt = true for resume)
    setPlayerTimers((prev) => {
      const next = new Map(prev);
      for (const [aid, pt] of next) {
        if (pt.onCourt && pt.stintStartElapsed != null) {
          const dur = elapsed - pt.stintStartElapsed;
          next.set(aid, {
            ...pt,
            stintStartElapsed: null, // will reopen on resume
            stints: [...pt.stints, { quarter: currentQuarter, inMs: pt.stintStartElapsed, outMs: elapsed, durationMs: dur }],
          });
        }
      }
      return next;
    });
  };

  const nextQuarter = () => {
    const totalPeriods = (session?.quarters || 4) + (session?.overtimes || 0);
    if (currentQuarter >= totalPeriods) return;
    setCurrentQuarter((q) => q + 1);
    setQuarterTimeLeft(session?.quarterDurationMs || 600000);
    quarterElapsedAccum.current = 0;
    quarterWallStart.current = null;
    setQuarterRunning(false);
    // Keep onCourt flags, stintStartElapsed stays null until play
  };

  // ─── Player on/off court (radio toggle) ───────────────
  const toggleOnCourt = (athleteId: string) => {
    const elapsed = getQuarterElapsed();
    const timerIsRunning = quarterRunning;

    setPlayerTimers((prev) => {
      const next = new Map(prev);
      const pt = next.get(athleteId);
      if (!pt) return prev;

      if (pt.onCourt) {
        // Deselect — if timer running, close stint
        if (timerIsRunning && pt.stintStartElapsed != null) {
          const dur = elapsed - pt.stintStartElapsed;
          next.set(athleteId, {
            onCourt: false,
            stintStartElapsed: null,
            stints: [...pt.stints, { quarter: currentQuarter, inMs: pt.stintStartElapsed, outMs: elapsed, durationMs: dur }],
          });
        } else {
          next.set(athleteId, { ...pt, onCourt: false, stintStartElapsed: null });
        }
      } else {
        // Select — check max 5
        let count = 0;
        for (const [, p] of next) { if (p.onCourt) count++; }
        if (count >= 5) {
          toast('warning', t('gtMaxPlayers'));
          return prev;
        }
        next.set(athleteId, {
          ...pt,
          onCourt: true,
          // Only start stint if timer running
          stintStartElapsed: timerIsRunning ? elapsed : null,
        });
      }
      return next;
    });
  };

  // ─── Compute playing time ─────────────────────────────

  /** Total playing ms across all quarters for a player */
  const getTotalPlayingMs = useCallback((pt: PlayerTimer): number => {
    let total = 0;
    for (const s of pt.stints) total += s.durationMs;
    // Add live stint if running
    if (pt.onCourt && pt.stintStartElapsed != null && quarterRunning) {
      total += getQuarterElapsed() - pt.stintStartElapsed;
    }
    return total;
  }, [quarterRunning, getQuarterElapsed]);

  /** Playing ms in a specific quarter */
  const getQuarterPlayingMs = useCallback((pt: PlayerTimer, quarter: number): number => {
    let total = 0;
    for (const s of pt.stints) {
      if (s.quarter === quarter) total += s.durationMs;
    }
    if (pt.onCourt && pt.stintStartElapsed != null && quarter === currentQuarter && quarterRunning) {
      total += getQuarterElapsed() - pt.stintStartElapsed;
    }
    return total;
  }, [currentQuarter, quarterRunning, getQuarterElapsed]);

  /** Build bar segments for a quarter (positioned absolutely in quarter timeline) */
  const buildSegments = useCallback((pt: PlayerTimer, quarter: number, qDur: number) => {
    const segments: { leftPct: number; widthPct: number }[] = [];

    for (const s of pt.stints) {
      if (s.quarter !== quarter) continue;
      const leftPct = (s.inMs / qDur) * 100;
      const widthPct = (s.durationMs / qDur) * 100;
      segments.push({ leftPct: Math.min(leftPct, 100), widthPct: Math.min(widthPct, 100 - leftPct) });
    }

    // Live stint
    if (pt.onCourt && pt.stintStartElapsed != null && quarter === currentQuarter && quarterRunning) {
      const leftPct = (pt.stintStartElapsed / qDur) * 100;
      const liveDur = getQuarterElapsed() - pt.stintStartElapsed;
      const widthPct = (liveDur / qDur) * 100;
      segments.push({ leftPct: Math.min(leftPct, 100), widthPct: Math.min(widthPct, 100 - leftPct) });
    }

    return segments;
  }, [currentQuarter, quarterRunning, getQuarterElapsed]);

  // ─── Save data ────────────────────────────────────────
  const saveData = async (showToast = false) => {
    if (!session) return;
    if (showToast) setSaving(true);
    try {
      const elapsed = getQuarterElapsed();
      const entries = Array.from(playerTimers.entries()).map(([athleteId, pt]) => {
        const stints = [...pt.stints];
        let totalPlayingMs = 0;
        for (const s of stints) totalPlayingMs += s.durationMs;
        // Include live stint
        if (pt.onCourt && pt.stintStartElapsed != null && quarterRunning) {
          const dur = elapsed - pt.stintStartElapsed;
          totalPlayingMs += dur;
          stints.push({ quarter: currentQuarter, inMs: pt.stintStartElapsed, outMs: elapsed, durationMs: dur });
        }
        return { athleteId, totalPlayingMs, stints, onCourt: pt.onCourt };
      });
      await apiFetch(`/game/${session.id}/entries`, { method: 'PUT', body: JSON.stringify(entries) });
      if (showToast) toast('success', t('gtDataSaved'));
    } catch {
      if (showToast) toast('error', t('gtSaveError'));
    } finally {
      if (showToast) setSaving(false);
    }
  };

  // ─── Autosave ─────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      if (session && session.status !== 'COMPLETED') saveData(false);
    }, 30000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, playerTimers]);

  // ─── Add overtime ─────────────────────────────────────
  const addOvertime = async () => {
    if (!session) return;
    try {
      const res = await apiFetch<ApiEnvelope<{ overtimes: number }>>(`/game/${session.id}/overtime`, { method: 'POST', body: JSON.stringify({}) });
      if (res.success && res.data) {
        setSession((s) => s ? { ...s, overtimes: res.data!.overtimes } : s);
        toast('success', `OT${res.data.overtimes} aggiunto`);
      }
    } catch { toast('error', t('gtAddOvertimeError')); }
  };

  // ─── Complete game ────────────────────────────────────
  const completeGame = async () => {
    if (!session) return;
    const elapsed = getQuarterElapsed();

    // Build final entries
    const finalEntries = Array.from(playerTimers.entries()).map(([athleteId, pt]) => {
      const stints = [...pt.stints];
      let totalPlayingMs = 0;
      for (const s of stints) totalPlayingMs += s.durationMs;
      if (pt.onCourt && pt.stintStartElapsed != null) {
        const dur = elapsed - pt.stintStartElapsed;
        totalPlayingMs += dur;
        stints.push({ quarter: currentQuarter, inMs: pt.stintStartElapsed, outMs: elapsed, durationMs: dur });
      }
      return { athleteId, totalPlayingMs, stints, onCourt: false };
    });

    setQuarterRunning(false);
    quarterWallStart.current = null;

    // Close all stints visually
    setPlayerTimers((prev) => {
      const next = new Map(prev);
      for (const [aid, pt] of next) {
        if (pt.onCourt && pt.stintStartElapsed != null) {
          const dur = elapsed - pt.stintStartElapsed;
          next.set(aid, {
            onCourt: false,
            stintStartElapsed: null,
            stints: [...pt.stints, { quarter: currentQuarter, inMs: pt.stintStartElapsed, outMs: elapsed, durationMs: dur }],
          });
        } else {
          next.set(aid, { ...pt, onCourt: false, stintStartElapsed: null });
        }
      }
      return next;
    });

    setCompleting(true);
    try {
      await apiFetch(`/game/${session.id}/entries`, { method: 'PUT', body: JSON.stringify(finalEntries) });
      const res = await apiFetch<ApiEnvelope<{ trainingSessions: number }>>(`/game/${session.id}/complete`, { method: 'PUT', body: JSON.stringify({}) });
      if (res.success && res.data) {
        setSession((s) => s ? { ...s, status: 'COMPLETED' } : s);
        toast('success', `Partita completata. ${res.data.trainingSessions} sessioni create per analytics`);
      }
    } catch { toast('error', t('gtCompletionError')); }
    finally { setCompleting(false); }
  };

  // ─── Add / remove athlete ─────────────────────────────
  const loadAvailableAthletes = async () => {
    try {
      const res = await apiFetch<ApiEnvelope<AthleteInfo[]>>('/athletes?limit=100');
      if (res.success) {
        const existingIds = new Set(playerTimers.keys());
        setAvailableAthletes((res.data || []).filter((a: AthleteInfo) => !existingIds.has(a.id)));
      }
    } catch { /* ignore */ }
  };

  const addAthlete = async (athleteId: string) => {
    if (!session) return;
    try {
      const res = await apiFetch<ApiEnvelope<{ entry: PlayerEntry }>>(`/game/${session.id}/athletes`, { method: 'POST', body: JSON.stringify({ athleteId }) });
      if (res.success && res.data?.entry) {
        const entry = res.data.entry;
        setPlayerTimers((prev) => {
          const next = new Map(prev);
          next.set(entry.athleteId, { onCourt: false, stintStartElapsed: null, stints: [] });
          return next;
        });
        setSession((s) => s ? { ...s, entries: [...s.entries, entry] } : s);
        setAvailableAthletes((prev) => prev.filter((a) => a.id !== athleteId));
      }
    } catch { toast('error', t('gtAddPlayerError')); }
  };

  const removeAthlete = async (athleteId: string) => {
    if (!session) return;
    try {
      await apiFetch(`/game/${session.id}/athletes/${athleteId}`, { method: 'DELETE' });
      setPlayerTimers((prev) => { const next = new Map(prev); next.delete(athleteId); return next; });
      setSession((s) => s ? { ...s, entries: s.entries.filter((e) => e.athleteId !== athleteId) } : s);
    } catch { toast('error', t('gtRemovePlayerError')); }
  };

  // ─── Computed ─────────────────────────────────────────
  const totalPeriods = (session?.quarters || 4) + (session?.overtimes || 0);
  const isCompleted = session?.status === 'COMPLETED';
  const quarterDurationMs = session?.quarterDurationMs || 600000;

  const onCourtCount = useMemo(() => {
    let c = 0;
    for (const [, pt] of playerTimers) { if (pt.onCourt) c++; }
    return c;
  }, [playerTimers]);

  const sortedPlayers = useMemo(() => {
    if (!session?.entries) return [];
    return [...session.entries].sort((a, b) =>
      (a.athlete.jerseyNumber || 99) - (b.athlete.jerseyNumber || 99)
    );
  }, [session?.entries]);

  const periodLabels = useMemo(() => {
    const labels: string[] = [];
    const nq = session?.quarters || 4;
    for (let i = 0; i < totalPeriods; i++) {
      labels.push(i < nq ? `Q${i + 1}` : `OT${i - nq + 1}`);
    }
    return labels;
  }, [totalPeriods, session?.quarters]);

  // ─── Loading / Error ──────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8">
          <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-red-500" />
          <p className="mb-4 text-red-700">{error || t('gtSessionNotFound')}</p>
          <button onClick={() => router.back()} className="text-sm font-medium text-red-600 underline hover:text-red-800">
            Torna indietro
          </button>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────
  return (
    <div className="mx-auto max-w-full px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="rounded-lg p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">{session.calendarEvent?.title || t('title')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {session.team?.name || t('gtNoTeam')} · {t('gtNPlayers', { count: session.entries.length })}
              {isCompleted && <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">{t('gtCompleted')}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isCompleted && (
            <>
              <button
                onClick={() => { setShowAddAthlete(!showAddAthlete); if (!showAddAthlete) loadAvailableAthletes(); }}
                className="flex items-center gap-1 rounded-lg border border-purple-300 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-50 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> {t('gtAddPlayerBtn')}
              </button>
              <button
                onClick={() => saveData(true)}
                disabled={saving}
                className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" /> {saving ? t('gtSaving') : t('gtSave')}
              </button>
              <button
                onClick={completeGame}
                disabled={completing}
                className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> {completing ? t('gtCompleting') : t('gtComplete')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Timer bar */}
      <div className="mb-5 flex items-center gap-4 rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 px-5 py-3">
        <div className="flex items-center gap-1">
          {periodLabels.map((label, i) => (
            <button
              key={i}
              onClick={() => {
                if (!quarterRunning && !isCompleted) {
                  setCurrentQuarter(i + 1);
                  setQuarterTimeLeft(quarterDurationMs);
                  quarterElapsedAccum.current = 0;
                  quarterWallStart.current = null;
                }
              }}
              className={`flex h-8 min-w-[2rem] items-center justify-center rounded-md px-2 text-xs font-bold transition-colors ${
                currentQuarter === i + 1
                  ? 'bg-purple-600 text-white shadow-md'
                  : i + 1 < currentQuarter
                  ? 'bg-purple-200 text-purple-700'
                  : 'bg-white dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
          {!isCompleted && (
            <button onClick={addOvertime} className="flex h-8 items-center gap-1 rounded-md border border-dashed border-purple-300 px-2 text-xs font-medium text-purple-600 hover:bg-purple-100 transition-colors">
              <Plus className="h-3 w-3" /> OT
            </button>
          )}
        </div>

        <div className="font-mono text-3xl font-black text-purple-800 tabular-nums">
          {formatCountdown(quarterTimeLeft)}
        </div>

        {!isCompleted && (
          quarterTimeLeft > 0 ? (
            <button
              onClick={quarterRunning ? pauseQuarter : startQuarter}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-white shadow-md transition-colors ${
                quarterRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {quarterRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>
          ) : currentQuarter < totalPeriods ? (
            <button onClick={nextQuarter} className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 transition-colors">
              {t('gtNext')}
            </button>
          ) : null
        )}

        <div className="ml-auto flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-purple-500" />
          <span className={`font-semibold ${onCourtCount >= 5 ? 'text-red-600' : 'text-purple-700'}`}>{onCourtCount}/5</span>
        </div>
      </div>

      {/* Add athlete dropdown */}
      {showAddAthlete && (
        <div className="mb-4 rounded-xl border border-purple-200 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('gtSelectPlayer')}</span>
            <button onClick={() => setShowAddAthlete(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"><X className="h-4 w-4" /></button>
          </div>
          {availableAthletes.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">{t('gtNoPlayersAvailable')}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {availableAthletes.map((a) => (
                <button key={a.id} onClick={() => addAthlete(a.id)} className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm hover:border-purple-300 hover:bg-purple-50 transition-colors">
                  {a.jerseyNumber != null && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-2xs font-bold text-purple-700">{a.jerseyNumber}</span>
                  )}
                  <span className="truncate font-medium text-slate-700 dark:text-slate-300">{a.lastName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════ TABLE ═══════ */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold w-40">{t('gtPlayerHeader')}</th>
              {!isCompleted && <th className="px-2 py-3 text-center text-xs font-semibold w-10" />}
              {periodLabels.map((label, i) => (
                <th key={i} className="px-1 py-3 text-center text-xs font-semibold" style={{ minWidth: 140 }}>{label}</th>
              ))}
              <th className="px-3 py-3 text-right text-xs font-semibold w-20">{t('gtTotalHeader')}</th>
              {!isCompleted && <th className="w-8 px-1 py-3" />}
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((entry, rowIdx) => {
              const pt = playerTimers.get(entry.athleteId);
              if (!pt) return null;
              const totalMs = getTotalPlayingMs(pt);
              const rowBg = pt.onCourt ? 'bg-green-50' : rowIdx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-900/60';

              return (
                <tr key={entry.athleteId} className={`${rowBg} border-b border-slate-100 dark:border-slate-700 transition-colors`}>
                  {/* Player */}
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        pt.onCourt ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-600 dark:text-slate-400 dark:bg-slate-700 dark:text-slate-400'
                      }`}>
                        {entry.athlete.jerseyNumber ?? '–'}
                      </span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{entry.athlete.lastName}</span>
                    </div>
                  </td>

                  {/* Radio */}
                  {!isCompleted && (
                    <td className="px-2 py-2.5 text-center">
                      <button onClick={() => toggleOnCourt(entry.athleteId)} className="group flex items-center justify-center" title={pt.onCourt ? t('gtOffCourt') : t('gtOnCourt')}>
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                          pt.onCourt ? 'border-green-500 bg-green-500' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 group-hover:border-green-400'
                        }`}>
                          {pt.onCourt && <span className="h-2 w-2 rounded-full bg-white dark:bg-slate-800" />}
                        </span>
                      </button>
                    </td>
                  )}

                  {/* Quarter columns */}
                  {periodLabels.map((_, qi) => {
                    const q = qi + 1;
                    const segments = buildSegments(pt, q, quarterDurationMs);
                    const qMs = getQuarterPlayingMs(pt, q);

                    return (
                      <td key={qi} className="px-1 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className="relative h-5 flex-1 overflow-hidden rounded bg-slate-200/70 dark:bg-slate-700/70" style={{ minWidth: 70 }}>
                            {segments.map((seg, si) => (
                              <div
                                key={si}
                                className="absolute top-0 h-full rounded transition-all duration-200 bg-teal-500"
                                style={{
                                  left: `${seg.leftPct}%`,
                                  width: `${seg.widthPct}%`,
                                }}
                              />
                            ))}
                          </div>
                          <span className="w-10 text-right font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                            {qMs > 0 ? formatTime(qMs) : '–'}
                          </span>
                        </div>
                      </td>
                    );
                  })}

                  {/* Total */}
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-mono text-sm font-bold tabular-nums text-slate-800 dark:text-slate-200">{formatTime(totalMs)}</span>
                  </td>

                  {/* Remove */}
                  {!isCompleted && (
                    <td className="px-1 py-2.5 text-center">
                      {!pt.onCourt && getTotalPlayingMs(pt) === 0 && (
                        <button onClick={() => removeAthlete(entry.athleteId)} className="rounded p-0.5 text-slate-300 hover:text-red-500 transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
