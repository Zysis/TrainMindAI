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
  Pencil,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { apiFetch } from '@/lib/auth/fetch';
import { useApiError } from '@/lib/i18n/api-error';
import { useToast } from '@/components/ui/toast';

// ─── Types ──────────────────────────────────────────────

interface ApiEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: { message?: string };
}

/** Un turno in campo, in ms di quarto trascorso (0 → quarterDurationMs), non
 *  orologio da parete. Il cronometro del quarto e' fermo durante le pause,
 *  quindi `durationMs` e' gia' tempo di gioco netto: le interruzioni non ci
 *  finiscono dentro, si contano a parte in `breaks`. */
interface Stint {
  quarter: number;
  inMs: number;       // quarter elapsed ms when entered
  outMs: number | null;
  durationMs: number;
  /** Quante volte il cronometro si e' fermato mentre il giocatore era in campo.
   *  Assente sulle partite salvate prima di questa funzione. */
  breaks?: number;
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
  rpe: number | null;
  athlete: AthleteInfo;
}

interface GameSession {
  id: string;
  homeScore?: number | null;
  awayScore?: number | null;
  competition?: string | null;
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
  calendarEvent: {
    id: string; title: string; startTime: string; endTime: string; type: string;
    opponent: string | null; isHome: boolean | null; venue: string | null;
  } | null;
}

interface PlayerTimer {
  onCourt: boolean;
  /** Quarter elapsed ms when current stint started. null = off court or timer not running */
  stintStartElapsed: number | null;
  /** Interruzioni accumulate nel turno ancora aperto. */
  stintBreaks: number;
  stints: Stint[];
  /** RPE post-partita (1-10). null = non ancora raccolto. */
  rpe: number | null;
}

/** Un turno cosi' come va mostrato: chiuso o ancora in corso. */
interface StintView {
  durationMs: number;
  breaks: number;
  live: boolean;
}

// ─── Helpers ────────────────────────────────────────────

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * "Squadra di casa vs Squadra ospite".
 *
 * `isHome` e' a tre stati: null significa "non specificato", e in quel caso si
 * assume la casa — e' il caso piu' frequente e non c'e' niente di meglio da
 * indovinare. Senza avversario non c'e' confronto da scrivere e si ripiega sul
 * titolo dell'evento.
 */
function matchTitle(teamName: string | null | undefined, opponent: string | null | undefined, isHome: boolean | null | undefined, fallback: string): string {
  const mine = teamName?.trim();
  const other = opponent?.trim();
  if (!other) return fallback;
  if (!mine) return other;
  return isHome === false ? `${other} vs ${mine}` : `${mine} vs ${other}`;
}

/** Q1..Qn poi OT1..OTn. Fuori dal componente cosi' e' utilizzabile anche dal
 *  tick, che gira prima che i memo del corpo componente siano rileggibili. */
function periodLabel(index: number, quarters: number): string {
  return index <= quarters ? `Q${index}` : `OT${index - quarters}`;
}

/** sRPE della partita: RPE x minuti giocati, arrotondati come per l'allenamento. */
function sessionLoad(rpe: number | null, ms: number): number | null {
  if (!rpe || ms <= 0) return null;
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return null;
  return rpe * minutes;
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
  const apiError = useApiError();
  const t = useTranslations('calendar');
  const locale = useLocale();

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
  // Modifica dei dati partita dalla pagina stessa: e' qui che ti accorgi di un
  // avversario scritto male, e le partite create prima di questi campi non
  // avrebbero altro modo per riempirli.
  // Il risultato si chiede alla chiusura: e' il momento in cui esiste, e
  // scriverlo dopo vorrebbe dire ricordarsi di tornare qui.
  const [showFinish, setShowFinish] = useState(false);
  const [fHome, setFHome] = useState('');
  const [fAway, setFAway] = useState('');
  const [fCompetition, setFCompetition] = useState('');
  const [showMatchEdit, setShowMatchEdit] = useState(false);
  const [savingMatch, setSavingMatch] = useState(false);
  const [mOpponent, setMOpponent] = useState('');
  const [mVenue, setMVenue] = useState('');
  const [mHomeAway, setMHomeAway] = useState<'' | 'home' | 'away'>('');
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

  // ─── Chiusura dei turni aperti ────────────────────────
  /** Chiude i turni ancora aperti al minuto `elapsed` del quarto indicato.
   *  Serve a ogni cambio di periodo e a fine partita: senza, un turno aperto
   *  verrebbe attribuito al quarto successivo con un `inMs` del quarto vecchio. */
  const closeOpenStints = useCallback((elapsed: number, quarter: number, keepOnCourt = true) => {
    setPlayerTimers((prev) => {
      const next = new Map(prev);
      for (const [aid, pt] of next) {
        if (pt.stintStartElapsed != null) {
          next.set(aid, {
            ...pt,
            onCourt: keepOnCourt ? pt.onCourt : false,
            stintStartElapsed: null,
            stintBreaks: 0,
            stints: [...pt.stints, {
              quarter,
              inMs: pt.stintStartElapsed,
              outMs: elapsed,
              durationMs: Math.max(0, elapsed - pt.stintStartElapsed),
              breaks: pt.stintBreaks,
            }],
          });
        } else if (!keepOnCourt) {
          next.set(aid, { ...pt, onCourt: false, stintStartElapsed: null, stintBreaks: 0 });
        }
      }
      return next;
    });
  }, []);

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
        setError(apiError(err, t('gtNetworkError')));
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
        stintBreaks: 0,
        stints: entry.stints || [],
        rpe: entry.rpe ?? null,
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

        // onCourt resta true (i quintetti si portano al quarto dopo), ma il
        // turno si chiude qui.
        closeOpenStints(finalElapsed, currentQuarter);
        toast('info', t('gtQuarterEnded', { period: periodLabel(currentQuarter, session?.quarters || 4) }));
      } else {
        setQuarterTimeLeft(remaining);
      }
    }, 250);

    return () => { if (tickRef.current) clearInterval(tickRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quarterRunning, session?.quarterDurationMs, session?.quarters, currentQuarter, toast, closeOpenStints]);

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
          next.set(aid, { ...pt, stintStartElapsed: elapsed, stintBreaks: 0 });
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

    // Il turno NON si chiude: l'orologio del quarto e' fermo, quindi il tempo
    // giocato non avanza comunque. Si registra solo l'interruzione, che e' il
    // dato che interessa (quante volte il gioco si e' fermato mentre era in
    // campo). Prima ogni pausa spezzava il turno in due, e "un turno" non
    // corrispondeva piu' a una permanenza in campo.
    setPlayerTimers((prev) => {
      const next = new Map(prev);
      for (const [aid, pt] of next) {
        if (pt.stintStartElapsed != null) {
          next.set(aid, { ...pt, stintBreaks: pt.stintBreaks + 1 });
        }
      }
      return next;
    });
  };

  const nextQuarter = () => {
    const totalPeriods = (session?.quarters || 4) + (session?.overtimes || 0);
    if (currentQuarter >= totalPeriods) return;
    closeOpenStints(getQuarterElapsed(), currentQuarter);
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
        // Esce dal campo: se un turno e' aperto lo chiude, anche a cronometro
        // fermo (una sostituzione durante un timeout e' comunque una sostituzione).
        if (pt.stintStartElapsed != null) {
          const dur = Math.max(0, elapsed - pt.stintStartElapsed);
          next.set(athleteId, {
            ...pt,
            onCourt: false,
            stintStartElapsed: null,
            stintBreaks: 0,
            stints: [...pt.stints, { quarter: currentQuarter, inMs: pt.stintStartElapsed, outMs: elapsed, durationMs: dur, breaks: pt.stintBreaks }],
          });
        } else {
          next.set(athleteId, { ...pt, onCourt: false, stintStartElapsed: null, stintBreaks: 0 });
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
          stintBreaks: 0,
        });
      }
      return next;
    });
  };

  /** RPE del singolo. Vuoto = non raccolto: la riga di carico nascera' con i
   *  soli minuti, senza sRPE. */
  const setPlayerRpe = (athleteId: string, rpe: number | null) => {
    setPlayerTimers((prev) => {
      const next = new Map(prev);
      const pt = next.get(athleteId);
      if (!pt) return prev;
      next.set(athleteId, { ...pt, rpe });
      return next;
    });
  };

  // ─── Compute playing time ─────────────────────────────

  /** Total playing ms across all quarters for a player */
  const getTotalPlayingMs = useCallback((pt: PlayerTimer): number => {
    let total = 0;
    for (const s of pt.stints) total += s.durationMs;
    // Turno ancora aperto. `getQuarterElapsed()` e' congelato in pausa, quindi
    // vale anche a cronometro fermo: il tempo maturato non deve sparire dalla
    // riga solo perche' l'arbitro ha fischiato.
    if (pt.stintStartElapsed != null) {
      total += Math.max(0, getQuarterElapsed() - pt.stintStartElapsed);
    }
    return total;
  }, [getQuarterElapsed]);

  /** Playing ms in a specific quarter */
  const getQuarterPlayingMs = useCallback((pt: PlayerTimer, quarter: number): number => {
    let total = 0;
    for (const s of pt.stints) {
      if (s.quarter === quarter) total += s.durationMs;
    }
    if (pt.stintStartElapsed != null && quarter === currentQuarter) {
      total += Math.max(0, getQuarterElapsed() - pt.stintStartElapsed);
    }
    return total;
  }, [currentQuarter, getQuarterElapsed]);

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
    if (pt.stintStartElapsed != null && quarter === currentQuarter) {
      const leftPct = (pt.stintStartElapsed / qDur) * 100;
      const liveDur = Math.max(0, getQuarterElapsed() - pt.stintStartElapsed);
      const widthPct = (liveDur / qDur) * 100;
      segments.push({ leftPct: Math.min(leftPct, 100), widthPct: Math.min(widthPct, 100 - leftPct) });
    }

    return segments;
  }, [currentQuarter, getQuarterElapsed]);

  /** I turni del quarto, quello aperto compreso, con le loro interruzioni. */
  const getQuarterStints = useCallback((pt: PlayerTimer, quarter: number): StintView[] => {
    const list: StintView[] = pt.stints
      .filter((st) => st.quarter === quarter)
      .map((st) => ({ durationMs: st.durationMs, breaks: st.breaks ?? 0, live: false }));
    if (pt.stintStartElapsed != null && quarter === currentQuarter) {
      list.push({
        durationMs: Math.max(0, getQuarterElapsed() - pt.stintStartElapsed),
        breaks: pt.stintBreaks,
        live: true,
      });
    }
    return list;
  }, [currentQuarter, getQuarterElapsed]);

  /** Riepilogo di riga: quanti turni e quante interruzioni in tutta la partita. */
  const getStintSummary = useCallback((pt: PlayerTimer) => {
    let stints = pt.stints.length;
    let breaks = pt.stints.reduce((acc, st) => acc + (st.breaks ?? 0), 0);
    if (pt.stintStartElapsed != null) { stints += 1; breaks += pt.stintBreaks; }
    return { stints, breaks };
  }, []);

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
        if (pt.stintStartElapsed != null) {
          const dur = Math.max(0, elapsed - pt.stintStartElapsed);
          totalPlayingMs += dur;
          stints.push({ quarter: currentQuarter, inMs: pt.stintStartElapsed, outMs: elapsed, durationMs: dur, breaks: pt.stintBreaks });
        }
        return { athleteId, totalPlayingMs, stints, onCourt: pt.onCourt, rpe: pt.rpe };
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
        toast('success', t('gtOvertimeAdded', { n: res.data.overtimes }));
      }
    } catch { toast('error', t('gtAddOvertimeError')); }
  };

  // ─── Dati partita ─────────────────────────────────────

  const openMatchEdit = () => {
    const ev = session?.calendarEvent;
    setMOpponent(ev?.opponent ?? '');
    setMVenue(ev?.venue ?? '');
    setMHomeAway(ev?.isHome == null ? '' : ev.isHome ? 'home' : 'away');
    setShowMatchEdit(true);
  };

  const saveMatchDetails = async () => {
    const ev = session?.calendarEvent;
    if (!ev) return;
    setSavingMatch(true);
    const opponent = mOpponent.trim() || null;
    const venue = mVenue.trim() || null;
    const isHome = mHomeAway === '' ? null : mHomeAway === 'home';
    try {
      await apiFetch(`/calendar/events/${ev.id}`, {
        method: 'PUT',
        body: JSON.stringify({ opponent, venue, isHome }),
      });
      setSession((prev) => (prev && prev.calendarEvent
        ? { ...prev, calendarEvent: { ...prev.calendarEvent, opponent, venue, isHome } }
        : prev));
      setShowMatchEdit(false);
      toast('success', t('gtMatchDetailsSaved'));
    } catch (err) {
      toast('error', apiError(err, t('gtMatchDetailsError')));
    } finally {
      setSavingMatch(false);
    }
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
      if (pt.stintStartElapsed != null) {
        const dur = Math.max(0, elapsed - pt.stintStartElapsed);
        totalPlayingMs += dur;
        stints.push({ quarter: currentQuarter, inMs: pt.stintStartElapsed, outMs: elapsed, durationMs: dur, breaks: pt.stintBreaks });
      }
      return { athleteId, totalPlayingMs, stints, onCourt: false, rpe: pt.rpe };
    });

    setQuarterRunning(false);
    quarterWallStart.current = null;

    // Close all stints visually
    closeOpenStints(elapsed, currentQuarter, false);

    setCompleting(true);
    try {
      // Il risultato prima del completamento: se la chiusura fallisce, almeno
      // il tabellone e' salvato e non va riscritto.
      const home = fHome.trim() === '' ? null : Number(fHome);
      const away = fAway.trim() === '' ? null : Number(fAway);
      if (home != null || away != null || fCompetition.trim()) {
        await apiFetch(`/game/${session.id}/match-info`, {
          method: 'PUT',
          body: JSON.stringify({
            homeScore: Number.isFinite(home) ? home : null,
            awayScore: Number.isFinite(away) ? away : null,
            competition: fCompetition.trim() || null,
          }),
        });
      }
      await apiFetch(`/game/${session.id}/entries`, { method: 'PUT', body: JSON.stringify(finalEntries) });
      const res = await apiFetch<ApiEnvelope<{ trainingSessions: number; withoutRpe?: number }>>(`/game/${session.id}/complete`, { method: 'PUT', body: JSON.stringify({}) });
      if (res.success && res.data) {
        setShowFinish(false);
        setSession((s) => s ? {
          ...s, status: 'COMPLETED',
          homeScore: fHome.trim() === '' ? null : Number(fHome),
          awayScore: fAway.trim() === '' ? null : Number(fAway),
          competition: fCompetition.trim() || null,
        } : s);
        toast('success', t('gtGameCompletedMsg', { count: res.data.trainingSessions }));
        if (res.data.withoutRpe) {
          // Senza RPE il carico sRPE non si puo' calcolare: quei giocatori
          // restano negli analytics con i soli minuti.
          toast('info', t('gtSkippedNoRpe', { count: res.data.withoutRpe }));
        }
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
          next.set(entry.athleteId, { onCourt: false, stintStartElapsed: null, stintBreaks: 0, stints: [], rpe: entry.rpe ?? null });
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

  /** Totali di squadra: minuti, RPE medio (solo di chi ha giocato e ha un RPE)
   *  e carico complessivo. Il medio pesa i giocatori, non i minuti: serve a
   *  leggere la percezione di fatica del gruppo, non a sommarla. */
  // Non memoizzato di proposito: durante il gioco il tempo cresce a ogni tick
  // senza che cambino le dipendenze, e un useMemo mostrerebbe totali fermi.
  const teamTotals = (() => {
    let ms = 0, load = 0, players = 0, rpeSum = 0, rpeCount = 0;
    for (const [, pt] of playerTimers) {
      const total = getTotalPlayingMs(pt);
      if (total <= 0) continue;
      players++;
      ms += total;
      const l = sessionLoad(pt.rpe, total);
      if (l != null) load += l;
      if (pt.rpe) { rpeSum += pt.rpe; rpeCount++; }
    }
    return { ms, load, players, avgRpe: rpeCount > 0 ? rpeSum / rpeCount : null };
  })();

  const periodLabels = useMemo(() => {
    const nq = session?.quarters || 4;
    return Array.from({ length: totalPeriods }, (_, i) => periodLabel(i + 1, nq));
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
            {t('gtGoBack')}
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
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                {matchTitle(
                  session.team?.name,
                  session.calendarEvent?.opponent,
                  session.calendarEvent?.isHome,
                  session.calendarEvent?.title || t('gtGameTitle'),
                )}
              </h1>
              {session.calendarEvent && !isCompleted && (
                <button
                  onClick={openMatchEdit}
                  title={t('gtEditMatchDetails')}
                  className="rounded p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-purple-600 dark:hover:bg-slate-700"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {session.calendarEvent && (
                <>
                  {new Date(session.calendarEvent.startTime).toLocaleDateString(locale, {
                    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
                  })}
                  {' · '}
                  {new Date(session.calendarEvent.startTime).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                  {session.calendarEvent.venue ? ` · ${session.calendarEvent.venue}` : ''}
                  {session.calendarEvent.isHome != null && (
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-2xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      {session.calendarEvent.isHome ? t('gtHome') : t('gtAway')}
                    </span>
                  )}
                  {' · '}
                </>
              )}
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
                onClick={() => {
                  setFHome(session.homeScore != null ? String(session.homeScore) : '');
                  setFAway(session.awayScore != null ? String(session.awayScore) : '');
                  setFCompetition(session.competition ?? '');
                  setShowFinish(true);
                }}
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
                if (!quarterRunning && !isCompleted && currentQuarter !== i + 1) {
                  // Un turno lasciato aperto finirebbe nel periodo nuovo con
                  // l'inMs di quello vecchio: prima si chiude.
                  closeOpenStints(getQuarterElapsed(), currentQuarter);
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

      {/* Risultato alla chiusura della partita */}
      {showFinish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('gtCompleteWithScore')}</h2>
              <button onClick={() => setShowFinish(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('gtScoreLabel')}</label>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {session.calendarEvent?.isHome === false
                      ? (session.calendarEvent?.opponent || '—')
                      : (session.team?.name || '—')}
                  </span>
                  <input
                    type="number" min={0} max={300} inputMode="numeric"
                    value={fHome} onChange={(e) => setFHome(e.target.value)}
                    className="w-16 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-white px-2 py-2 text-center font-mono text-lg tabular-nums focus:border-purple-500 focus:outline-none"
                  />
                  <span className="text-slate-400">-</span>
                  <input
                    type="number" min={0} max={300} inputMode="numeric"
                    value={fAway} onChange={(e) => setFAway(e.target.value)}
                    className="w-16 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-white px-2 py-2 text-center font-mono text-lg tabular-nums focus:border-purple-500 focus:outline-none"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {session.calendarEvent?.isHome === false
                      ? (session.team?.name || '—')
                      : (session.calendarEvent?.opponent || '—')}
                  </span>
                </div>
                <p className="mt-1 text-2xs text-slate-400 dark:text-slate-500">{t('gtScoreHint')}</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('gtCompetitionLabel')}</label>
                <input
                  value={fCompetition}
                  onChange={(e) => setFCompetition(e.target.value)}
                  placeholder={t('gtCompetitionPlaceholder')}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700 px-5 py-3">
              <button
                onClick={() => setShowFinish(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                {t('cancelAction')}
              </button>
              <button
                onClick={completeGame}
                disabled={completing}
                className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {completing ? t('gtCompleting') : t('gtComplete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modifica dei dati partita */}
      {showMatchEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('gtEditMatchDetails')}</h2>
              <button onClick={() => setShowMatchEdit(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('gtOpponentLabel')}</label>
                <input
                  value={mOpponent}
                  onChange={(e) => setMOpponent(e.target.value)}
                  placeholder={t('gtOpponentPlaceholder')}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('gtHomeAwayLabel')}</label>
                  <select
                    value={mHomeAway}
                    onChange={(e) => setMHomeAway(e.target.value as '' | 'home' | 'away')}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">{t('gtHomeAwayUnset')}</option>
                    <option value="home">{t('gtHome')}</option>
                    <option value="away">{t('gtAway')}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('gtVenueLabel')}</label>
                  <input
                    value={mVenue}
                    onChange={(e) => setMVenue(e.target.value)}
                    placeholder={t('gtVenuePlaceholder')}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
              <p className="text-2xs text-slate-400 dark:text-slate-500">{t('gtMatchDetailsHint')}</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700 px-5 py-3">
              <button
                onClick={() => setShowMatchEdit(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                {t('cancelAction')}
              </button>
              <button
                onClick={saveMatchDetails}
                disabled={savingMatch}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {savingMatch ? t('gtSaving') : t('gtSave')}
              </button>
            </div>
          </div>
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
              <th className="px-3 py-3 text-right text-xs font-semibold w-24">{t('gtTotalHeader')}</th>
              <th className="px-2 py-3 text-center text-xs font-semibold w-16">{t('gtRpeHeader')}</th>
              <th className="px-2 py-3 text-right text-xs font-semibold w-16">{t('gtLoadHeader')}</th>
              {!isCompleted && <th className="w-8 px-1 py-3" />}
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((entry, rowIdx) => {
              const pt = playerTimers.get(entry.athleteId);
              if (!pt) return null;
              const totalMs = getTotalPlayingMs(pt);
              const summary = getStintSummary(pt);
              const load = sessionLoad(pt.rpe, totalMs);
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
                    const qStints = getQuarterStints(pt, q);

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
                        {/* Un chip per turno in campo: tempo netto e, se ce ne
                            sono state, le interruzioni del cronometro dentro
                            quel turno. */}
                        {qStints.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {qStints.map((st, si) => (
                              <span
                                key={si}
                                title={t('gtStintTooltip', { n: si + 1, time: formatTime(st.durationMs), breaks: st.breaks })}
                                className={`inline-flex items-center gap-0.5 rounded px-1 py-px font-mono text-2xs tabular-nums ${
                                  st.live
                                    ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {formatTime(st.durationMs)}
                                {st.breaks > 0 && (
                                  <span className="inline-flex items-center gap-px font-sans font-semibold text-amber-600 dark:text-amber-400">
                                    <Pause className="h-2 w-2" />{st.breaks}
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}

                  {/* Total */}
                  <td className="px-3 py-2.5 text-right align-top">
                    <span className="block font-mono text-sm font-bold tabular-nums text-slate-800 dark:text-slate-200">{formatTime(totalMs)}</span>
                    {summary.stints > 0 && (
                      <span className="mt-0.5 block text-2xs text-slate-400 dark:text-slate-500">
                        {t('gtStintsSummary', { stints: summary.stints, breaks: summary.breaks })}
                      </span>
                    )}
                  </td>

                  {/* RPE post-partita del singolo */}
                  <td className="px-2 py-2.5 text-center align-top">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      inputMode="numeric"
                      value={pt.rpe ?? ''}
                      disabled={isCompleted}
                      placeholder="1-10"
                      title={t('gtRpeHint')}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '') return setPlayerRpe(entry.athleteId, null);
                        const n = Math.round(Number(v));
                        setPlayerRpe(entry.athleteId, Number.isFinite(n) && n >= 1 && n <= 10 ? n : null);
                      }}
                      className="w-14 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-1 text-center text-xs tabular-nums text-slate-900 dark:text-white outline-none focus:border-purple-500 disabled:opacity-60"
                    />
                  </td>

                  {/* Carico sRPE = RPE x minuti */}
                  <td className="px-2 py-2.5 text-right align-top">
                    <span className="font-mono text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                      {load != null ? load : '—'}
                    </span>
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
          {teamTotals.players > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/60">
                <td className="px-3 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300" colSpan={isCompleted ? 1 : 2}>
                  {t('gtTeamTotals')}
                </td>
                <td className="px-1 py-2.5 text-2xs text-slate-500 dark:text-slate-400" colSpan={periodLabels.length}>
                  {t('gtPlayersWithMinutes', { count: teamTotals.players })}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className="font-mono text-sm font-bold tabular-nums text-slate-800 dark:text-slate-200">
                    {formatTime(teamTotals.ms)}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-center">
                  <span className="font-mono text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                    {teamTotals.avgRpe != null ? teamTotals.avgRpe.toFixed(1) : '—'}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right">
                  <span className="font-mono text-xs font-bold tabular-nums text-slate-800 dark:text-slate-200">
                    {teamTotals.load > 0 ? teamTotals.load : '—'}
                  </span>
                </td>
                {!isCompleted && <td className="px-1 py-2.5" />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
