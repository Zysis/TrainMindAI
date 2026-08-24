'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  CheckCircle2,
  Plus,
  X,
  Timer,
  Users,
  Save,
  ClipboardCheck,
  Gauge,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/auth/fetch';
import { useToast } from '@/components/ui/toast';

// ─── Types ──────────────────────────────────────────────

type AttendanceStatus = 'PRESENT' | 'UNAVAILABLE' | 'ABSENT';

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
  status: AttendanceStatus | null;
  note: string | null;
  rpe: number | null;
  athlete: AthleteInfo;
}

/** Giocatore in rosa, con il suo semaforo */
interface RosterPlayer {
  athleteId: string;
  athlete: AthleteInfo;
  status: AttendanceStatus;
  note: string;
  /** RPE percepito dal singolo atleta (1-10); se vuoto vale l'RPE di sessione */
  rpe: number | null;
}

/** Giocatore ospite: esiste solo in questa sessione, nome editabile */
interface GuestPlayer {
  id: string;
  name: string;
  status: AttendanceStatus;
  note: string;
}

type ExerciseState = 'idle' | 'running' | 'paused' | 'done';

/** Esercizio come viene salvato sul server (colonna JSON sulla sessione) */
interface StoredExercise {
  id: string;
  name: string;
  isWarmup: boolean;
  players: number;
  courts: number;
  activityMs: number;
  pauseMs: number;
  breakMs: number;
  state: ExerciseState;
  breakRunning: boolean;
}

/** Esercizio nel browser: aggiunge gli ancoraggi dei segmenti in corso */
interface Exercise extends StoredExercise {
  segmentStart: number | null; // Date.now() del segmento attività/pausa corrente
  breakStart: number | null; // Date.now() del break in corso
}

interface FieldSession {
  id: string;
  calendarEventId: string | null;
  trainingSessionId: string | null;
  teamId: string | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
  availableAthletes: number | null;
  durationMinutes: number | null;
  sessionRpe: number | null;
  exercises: StoredExercise[] | null;
  guests: GuestPlayer[] | null;
  entries: Entry[];
  team: { id: string; name: string; color: string | null } | null;
  calendarEvent: { id: string; title: string; startTime: string; endTime: string; type: string } | null;
  trainingSession: { id: string; title: string; date: string; duration: number | null } | null;
}

// ─── Helpers ────────────────────────────────────────────

function formatMs(ms: number): string {
  const sign = ms < 0 ? '-' : '';
  const abs = Math.abs(ms);
  const totalSec = Math.floor(abs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${sign}${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${sign}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Come formatMs ma arrotondando al secondo: usato per i valori derivati
 *  (effettivo, intensità metabolica) per allinearsi al foglio Excel di riferimento. */
function formatMsRound(ms: number): string {
  const sign = ms < 0 ? '-' : '';
  const totalSec = Math.round(Math.abs(ms) / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${sign}${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${sign}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeStatus(value: unknown): AttendanceStatus {
  return value === 'UNAVAILABLE' || value === 'ABSENT' ? value : 'PRESENT';
}

/** RPE accettato solo se intero fra 1 e 10, altrimenti null (= non compilato) */
function normalizeRpe(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  return i >= 1 && i <= 10 ? i : null;
}

/** Tipi di evento che hanno anche la tabella esercizi coi cronometri */
const EXERCISE_TYPES = new Set(['basket']);

// ─── Exercise math ──────────────────────────────────────
// Attività e Pause sono due cronometri separati: Start avvia l'attività,
// il secondo tocco ferma l'attività e avvia la pausa.
// Netto = Attività − Pause (formula richiesta, può risultare negativa).

function liveActivity(ex: Exercise, now: number): number {
  return ex.activityMs + (ex.state === 'running' && ex.segmentStart != null ? now - ex.segmentStart : 0);
}

function livePause(ex: Exercise, now: number): number {
  return ex.pauseMs + (ex.state === 'paused' && ex.segmentStart != null ? now - ex.segmentStart : 0);
}

function liveBreak(ex: Exercise, now: number): number {
  return ex.breakMs + (ex.breakRunning && ex.breakStart != null ? now - ex.breakStart : 0);
}

function netMs(ex: Exercise, now: number): number {
  return liveActivity(ex, now) - livePause(ex, now);
}

function effectiveMs(ex: Exercise, now: number, available: number): number {
  if (available <= 0) return 0;
  return netMs(ex, now) * (ex.players / available);
}

function intensityMs(ex: Exercise, now: number, available: number): number {
  return effectiveMs(ex, now, available) * ex.courts;
}

/** Congela i segmenti in corso negli accumulatori, per il salvataggio */
function freezeExercise(ex: Exercise, now: number): StoredExercise {
  return {
    id: ex.id,
    name: ex.name,
    isWarmup: ex.isWarmup,
    players: ex.players,
    courts: ex.courts,
    activityMs: Math.max(0, Math.round(liveActivity(ex, now))),
    pauseMs: Math.max(0, Math.round(livePause(ex, now))),
    breakMs: Math.max(0, Math.round(liveBreak(ex, now))),
    state: ex.state,
    breakRunning: ex.breakRunning,
  };
}

// ─── Page ───────────────────────────────────────────────

export default function FieldTrainingPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const t = useTranslations('calendar');
  // La stessa pagina serve sia gli eventi di calendario sia le sessioni della
  // programmazione: `?source=session` dice quale delle due cose e' l'id.
  const routeId = params.eventId as string;
  const fromPlan = searchParams.get('source') === 'session';

  const [session, setSession] = useState<FieldSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  // Roster + semafori
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [guests, setGuests] = useState<GuestPlayer[]>([]);

  // Esercizi
  const [exercises, setExercises] = useState<Exercise[]>([]);

  // Carico: durata effettiva della seduta e RPE di sessione (fallback)
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [sessionRpe, setSessionRpe] = useState<number | null>(null);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, setTick] = useState(0); // forza il re-render dei cronometri

  // Atleti disponibili = semafori verdi (rosa + ospiti), non editabile
  const available =
    roster.filter((p) => p.status === 'PRESENT').length +
    guests.filter((g) => g.status === 'PRESENT').length;

  // ─── Initialize session ─────────────────────────────────

  const initRef = useRef(false);
  const initSession = useCallback(async () => {
    if (initRef.current) return; // evita il doppio invoke di StrictMode
    initRef.current = true;
    setLoading(true);
    try {
      const lookup = fromPlan
        ? `/field-training/by-session/${routeId}`
        : `/field-training/by-event/${routeId}`;
      const res = await apiFetch<{ data: { session: FieldSession } }>(lookup);
      setSession(res.data.session);
      hydrate(res.data.session);
    } catch {
      // Crea la sessione (il POST gestisce le race condition)
      try {
        const res = await apiFetch<{ data: { session: FieldSession } }>('/field-training/start', {
          method: 'POST',
          body: JSON.stringify(
            fromPlan ? { trainingSessionId: routeId } : { calendarEventId: routeId },
          ),
        });
        setSession(res.data.session);
        hydrate(res.data.session);
      } catch (err) {
        toast('error', err instanceof Error ? err.message : t('ftSessionStartError'));
        initRef.current = false; // consente il retry
      }
    }
    setLoading(false);
  }, [routeId, fromPlan]);

  const hydrate = (s: FieldSession) => {
    const now = Date.now();
    // Su una sessione chiusa i cronometri non devono ripartire: i tempi
    // restano quelli congelati al momento del completamento.
    const completed = s.status === 'COMPLETED';

    setRoster(
      (s.entries || []).map((e) => ({
        athleteId: e.athleteId,
        athlete: e.athlete,
        status: normalizeStatus(e.status),
        note: e.note || '',
        rpe: normalizeRpe(e.rpe),
      })),
    );

    // Durata effettiva: quella salvata, altrimenti quella dedotta dall'evento
    // o dalla sessione di piano. Resta comunque modificabile a mano.
    let duration = s.durationMinutes ?? null;
    if (duration == null && s.calendarEvent?.startTime && s.calendarEvent?.endTime) {
      duration = Math.max(
        0,
        Math.round(
          (new Date(s.calendarEvent.endTime).getTime() -
            new Date(s.calendarEvent.startTime).getTime()) / 60000,
        ),
      );
    }
    if (duration == null) duration = s.trainingSession?.duration ?? null;
    setDurationMinutes(duration);
    setSessionRpe(normalizeRpe(s.sessionRpe));

    const rawGuests: unknown = s.guests;
    setGuests(
      (Array.isArray(rawGuests) ? (rawGuests as Partial<GuestPlayer>[]) : []).map((g) => ({
        id: typeof g.id === 'string' && g.id ? g.id : uid('gu'),
        name: typeof g.name === 'string' ? g.name : '',
        status: normalizeStatus(g.status),
        note: typeof g.note === 'string' ? g.note : '',
      })),
    );

    const rawExercises: unknown = s.exercises;
    const list = Array.isArray(rawExercises) ? (rawExercises as Partial<StoredExercise>[]) : [];
    setExercises(
      list.map((e) => {
        const state: ExerciseState =
          e.state === 'running' || e.state === 'paused' || e.state === 'done' ? e.state : 'idle';
        const breakRunning = Boolean(e.breakRunning);
        return {
          id: typeof e.id === 'string' && e.id ? e.id : uid('ex'),
          name: typeof e.name === 'string' ? e.name : '',
          isWarmup: Boolean(e.isWarmup),
          players: Number(e.players) || 0,
          courts: Number(e.courts) || 0,
          activityMs: Number(e.activityMs) || 0,
          pauseMs: Number(e.pauseMs) || 0,
          breakMs: Number(e.breakMs) || 0,
          state: completed && state !== 'idle' ? 'done' : state,
          breakRunning: completed ? false : breakRunning,
          // il segmento in corso riparte da adesso: il tempo tra l'ultimo
          // autosave e il reload va perso, come prima
          segmentStart: !completed && (state === 'running' || state === 'paused') ? now : null,
          breakStart: !completed && breakRunning ? now : null,
        };
      }),
    );
  };

  useEffect(() => {
    initSession();
  }, [initSession]);

  // ─── Tick loop mentre qualcosa gira ─────────────────────

  const anyExerciseRunning = exercises.some(
    (ex) => ex.state === 'running' || ex.state === 'paused' || ex.breakRunning,
  );

  useEffect(() => {
    if (!anyExerciseRunning) return;
    tickRef.current = setInterval(() => setTick((n) => n + 1), 200);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [anyExerciseRunning]);

  // ─── Roster actions ─────────────────────────────────────

  const setPlayerStatus = (athleteId: string, status: AttendanceStatus) => {
    setRoster((prev) =>
      prev.map((p) => (p.athleteId === athleteId ? { ...p, status, note: status === 'PRESENT' ? '' : p.note } : p)),
    );
  };

  const setPlayerNote = (athleteId: string, note: string) => {
    setRoster((prev) => prev.map((p) => (p.athleteId === athleteId ? { ...p, note } : p)));
  };

  const setPlayerRpe = (athleteId: string, rpe: number | null) => {
    setRoster((prev) => prev.map((p) => (p.athleteId === athleteId ? { ...p, rpe } : p)));
  };

  const addGuest = () => {
    setGuests((prev) => [...prev, { id: uid('gu'), name: '', status: 'PRESENT', note: '' }]);
  };

  const patchGuest = (id: string, patch: Partial<GuestPlayer>) => {
    setGuests((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  const removeGuest = (id: string) => {
    setGuests((prev) => prev.filter((g) => g.id !== id));
  };

  // ─── Exercise actions ───────────────────────────────────

  const addExercise = () => {
    setExercises((prev) => [
      ...prev,
      {
        id: uid('ex'),
        name: t('ftExerciseDefaultName', { n: prev.length + 1 }),
        isWarmup: false,
        players: 0,
        courts: 1,
        activityMs: 0,
        pauseMs: 0,
        breakMs: 0,
        state: 'idle',
        breakRunning: false,
        segmentStart: null,
        breakStart: null,
      },
    ]);
  };

  const patchExercise = (id: string, patch: Partial<Exercise>) => {
    setExercises((prev) => prev.map((ex) => (ex.id === id ? { ...ex, ...patch } : ex)));
  };

  const removeExercise = (id: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== id));
  };

  /** Start / pausa. Avviare un esercizio chiude il break in corso. */
  const toggleExercise = (id: string) => {
    const now = Date.now();
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== id) {
          if (ex.breakRunning && ex.breakStart != null) {
            return { ...ex, breakMs: ex.breakMs + (now - ex.breakStart), breakRunning: false, breakStart: null };
          }
          return ex;
        }
        if (ex.state === 'idle' || ex.state === 'done') {
          const breakMs = ex.breakRunning && ex.breakStart != null ? ex.breakMs + (now - ex.breakStart) : ex.breakMs;
          return { ...ex, state: 'running', segmentStart: now, breakMs, breakRunning: false, breakStart: null };
        }
        if (ex.state === 'running') {
          const activityMs = ex.activityMs + (ex.segmentStart != null ? now - ex.segmentStart : 0);
          return { ...ex, state: 'paused', activityMs, segmentStart: now };
        }
        // paused → running
        const pauseMs = ex.pauseMs + (ex.segmentStart != null ? now - ex.segmentStart : 0);
        return { ...ex, state: 'running', pauseMs, segmentStart: now };
      }),
    );
  };

  /** Stop: chiude l'esercizio e avvia subito il cronometro del break. */
  const stopExercise = (id: string) => {
    const now = Date.now();
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== id) return ex;
        if (ex.state !== 'running' && ex.state !== 'paused') return ex;
        const segment = ex.segmentStart != null ? now - ex.segmentStart : 0;
        return {
          ...ex,
          state: 'done',
          activityMs: ex.activityMs + (ex.state === 'running' ? segment : 0),
          pauseMs: ex.pauseMs + (ex.state === 'paused' ? segment : 0),
          segmentStart: null,
          breakRunning: true,
          breakStart: now,
        };
      }),
    );
  };

  const stopBreak = (id: string) => {
    const now = Date.now();
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== id || !ex.breakRunning || ex.breakStart == null) return ex;
        return { ...ex, breakMs: ex.breakMs + (now - ex.breakStart), breakRunning: false, breakStart: null };
      }),
    );
  };

  // ─── Autosave ───────────────────────────────────────────

  const [saving, setSaving] = useState(false);

  /** Salva presenze + esercizi. Con `stop` congela anche i cronometri in corso
   *  (usato dal completamento: la seduta è finita, i tempi non devono più correre). */
  const persist = useCallback(async (stop = false) => {
    if (!session) return;
    const now = Date.now();
    const frozen = exercises.map((ex) => {
      const snapshot = freezeExercise(ex, now);
      if (!stop) return snapshot;
      return {
        ...snapshot,
        state: snapshot.state === 'idle' ? 'idle' : ('done' as ExerciseState),
        breakRunning: false,
      };
    });
    await Promise.all([
      apiFetch(`/field-training/${session.id}/roster`, {
        method: 'PUT',
        body: JSON.stringify({
          availableAthletes: available,
          durationMinutes: durationMinutes ?? null,
          sessionRpe: sessionRpe ?? null,
          athletes: roster.map((p) => ({
            athleteId: p.athleteId,
            status: p.status,
            note: p.note || null,
            rpe: p.status === 'PRESENT' ? p.rpe : null,
          })),
          guests: guests.map((g) => ({ id: g.id, name: g.name, status: g.status, note: g.note || null })),
        }),
      }),
      apiFetch(`/field-training/${session.id}/exercises`, {
        method: 'PUT',
        body: JSON.stringify({
          availableAthletes: available,
          exercises: frozen,
        }),
      }),
    ]);
  }, [session, roster, guests, exercises, available, durationMinutes, sessionRpe]);

  const saveData = useCallback(async (showToast = false) => {
    if (!session) return;
    if (showToast) setSaving(true);
    try {
      await persist();
      if (showToast) toast('success', t('gtDataSaved'));
    } catch (err) {
      if (showToast) toast('error', err instanceof Error ? err.message : t('gtSaveError'));
    } finally {
      if (showToast) setSaving(false);
    }
  }, [session, persist]);

  // Autosave ogni 15 secondi
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => { void saveData(); }, 15000);
    return () => clearInterval(interval);
  }, [saveData, session]);

  // ─── Complete session ───────────────────────────────────

  const completeSession = async () => {
    if (!session) return;
    setCompleting(true);
    try {
      await persist(true); // congela i cronometri prima di chiudere
      const res = await apiFetch<{ data: { completed: boolean; trainingSessions: number; skippedNoRpe?: number } }>(
        `/field-training/${session.id}/complete`,
        { method: 'PUT', body: JSON.stringify({}) },
      );
      toast('success', t('ftSessionCompletedMsg', { count: res.data.trainingSessions }));
      if (res.data.skippedNoRpe) {
        // Senza RPE o senza durata non si puo' calcolare il carico:
        // quei giocatori restano registrati come presenti ma senza sRPE.
        toast('info', t('ftSkippedNoRpe', { count: res.data.skippedNoRpe }));
      }
      router.push('/dashboard/calendar');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('gtCompletionError'));
    }
    setCompleting(false);
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
          {t('ftBackToCalendar')}
        </button>
      </div>
    );
  }

  const isCompleted = session.status === 'COMPLETED';
  const now = Date.now();

  const eventType = session.calendarEvent?.type || (fromPlan ? 'session' : 'basket');
  // La tabella esercizi resta solo sull'allenamento basket (e sulle sedute
  // vecchie che l'hanno gia' compilata): sugli altri tipi serve solo il carico.
  const showExercises = EXERCISE_TYPES.has(eventType) || exercises.length > 0;
  const sessionTitle =
    session.calendarEvent?.title || session.trainingSession?.title || t('ftFieldTraining');

  // Carico = RPE x durata effettiva. Chi non ha un RPE proprio usa quello di sessione.
  const rpeOf = (p: RosterPlayer) => (p.status === 'PRESENT' ? p.rpe ?? sessionRpe : null);
  const loadOf = (p: RosterPlayer) => {
    const r = rpeOf(p);
    return r && durationMinutes ? r * durationMinutes : null;
  };
  const loadedPlayers = roster.filter((p) => loadOf(p) != null);
  const totalLoad = loadedPlayers.reduce((sum, p) => sum + (loadOf(p) || 0), 0);
  const avgRpe = loadedPlayers.length
    ? loadedPlayers.reduce((sum, p) => sum + (rpeOf(p) || 0), 0) / loadedPlayers.length
    : 0;

  const unavailableCount =
    roster.filter((p) => p.status === 'UNAVAILABLE').length + guests.filter((g) => g.status === 'UNAVAILABLE').length;
  const absentCount =
    roster.filter((p) => p.status === 'ABSENT').length + guests.filter((g) => g.status === 'ABSENT').length;

  // ─── Totali ────────────────────────────────────────────
  const totalActivity = exercises.reduce((sum, ex) => sum + liveActivity(ex, now), 0);
  const totalPlayed = exercises.reduce((sum, ex) => sum + (ex.isWarmup ? 0 : liveActivity(ex, now)), 0);
  const totalPauses = exercises.reduce((sum, ex) => sum + livePause(ex, now), 0);
  const totalNet = exercises.reduce((sum, ex) => sum + netMs(ex, now), 0);
  const totalEffective = exercises.reduce((sum, ex) => sum + effectiveMs(ex, now, available), 0);
  const density = totalPlayed > 0 ? totalEffective / totalPlayed : 0;

  const cellNum = 'px-2 py-2 text-right font-mono text-sm tabular-nums whitespace-nowrap';
  const headCell = 'px-2 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/calendar')}
            className="rounded-lg p-2 text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              <ClipboardCheck className="mr-2 inline h-6 w-6 text-orange-600" />
              {showExercises ? t('title') : t('ftAttendance')}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {sessionTitle}
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? t('gtSaving') : t('gtSave')}
              </button>
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

      {/* Atleti disponibili (calcolato) + totali */}
      <div className="grid gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-900/20 p-4">
          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-300">
            <Users className="h-4 w-4" />
            <span className="text-xs font-semibold">{t('ftAvailableAthletes')}</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{available}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t('ftOfInRoster', { count: roster.length + guests.length })}
            </span>
          </div>
        </div>

        {showExercises ? (
          <div className="lg:col-span-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <StatTile label={t('ftTotalTime')} value={formatMs(totalActivity)} />
            <StatTile label={t('ftTotalPlayed')} value={formatMs(totalPlayed)} />
            <StatTile label={t('ftTotalPauses')} value={formatMs(totalPauses)} />
            <StatTile label={t('ftTotalNet')} value={formatMs(totalNet)} />
            <StatTile label={t('ftEffectivePerPlayer')} value={formatMsRound(totalEffective)} highlight />
            <StatTile label={t('ftDensity')} value={`${(density * 100).toFixed(1)}%`} highlight />
          </div>
        ) : (
          <div className="lg:col-span-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label={t('ftPresentCount')} value={String(available)} />
            <StatTile label={t('ftAvgRpe')} value={avgRpe ? avgRpe.toFixed(1) : '—'} />
            <StatTile label={t('ftTotalLoad')} value={totalLoad ? String(Math.round(totalLoad)) : '—'} highlight />
            <StatTile
              label={t('ftAvgLoad')}
              value={loadedPlayers.length ? String(Math.round(totalLoad / loadedPlayers.length)) : '—'}
              highlight
            />
          </div>
        )}
      </div>

      {/* ─── Carico della seduta ───────────────────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              {t('ftDurationMinutes')}
            </label>
            <input
              type="number"
              min={0}
              max={600}
              value={durationMinutes ?? ''}
              disabled={isCompleted}
              onChange={(e) => {
                const v = e.target.value;
                setDurationMinutes(v === '' ? null : Math.max(0, Math.min(600, Number(v) || 0)));
              }}
              className="mt-1 w-28 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm tabular-nums text-slate-900 dark:text-white outline-none focus:border-teal-500 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              {t('ftSessionRpe')}
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={sessionRpe ?? ''}
              disabled={isCompleted}
              placeholder="1-10"
              onChange={(e) => setSessionRpe(normalizeRpe(e.target.value))}
              className="mt-1 w-28 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-sm tabular-nums text-slate-900 dark:text-white outline-none focus:border-teal-500 disabled:opacity-60"
            />
          </div>
          <p className="flex-1 min-w-[16rem] text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            <Gauge className="mr-1 inline h-3.5 w-3.5" />
            {t('ftLoadFormula')}
          </p>
        </div>
      </div>

      {/* ─── Giocatori + semaforo ──────────────────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('ftPlayers')}</h2>
            <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-500" />{available}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-400" />{unavailableCount}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" />{absentCount}
              </span>
            </span>
            {totalLoad > 0 && (
              <span className="rounded-full bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300">
                {t('ftTotalLoad')}: {Math.round(totalLoad)}
              </span>
            )}
          </div>
          {!isCompleted && (
            <button
              onClick={addGuest}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:border-teal-400 hover:text-teal-600"
            >
              <Plus className="h-4 w-4" />
              {t('ftAddPlayer')}
            </button>
          )}
        </div>

        {roster.length === 0 && guests.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-3">
            <Users className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-400 dark:text-slate-500">{t('ftNoPlayers')}</p>
          </div>
        ) : (
          <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {roster.map((p) => (
              <PlayerRow
                key={p.athleteId}
                label={`${p.athlete.lastName} ${p.athlete.firstName}`}
                sublabel={p.athlete.position}
                jersey={p.athlete.jerseyNumber}
                status={p.status}
                note={p.note}
                isCompleted={isCompleted}
                rpe={p.rpe}
                fallbackRpe={sessionRpe}
                load={loadOf(p)}
                onRpe={(v) => setPlayerRpe(p.athleteId, v)}
                onStatus={(s) => setPlayerStatus(p.athleteId, s)}
                onNote={(n) => setPlayerNote(p.athleteId, n)}
              />
            ))}
            {guests.map((g) => (
              <PlayerRow
                key={g.id}
                label={g.name}
                editableLabel
                isGuest
                status={g.status}
                note={g.note}
                isCompleted={isCompleted}
                onLabel={(name) => patchGuest(g.id, { name })}
                onStatus={(s) => patchGuest(g.id, { status: s, note: s === 'PRESENT' ? '' : g.note })}
                onNote={(note) => patchGuest(g.id, { note })}
                onRemove={() => removeGuest(g.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Esercizi (solo allenamento basket) ─────────────── */}
      {showExercises && (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('ftExercises')}</h2>
          {!isCompleted && (
            <button
              onClick={addExercise}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:border-teal-400 hover:text-teal-600"
            >
              <Plus className="h-4 w-4" />
              {t('ftAddExercise')}
            </button>
          )}
        </div>

        {exercises.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3">
            <Timer className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-400 dark:text-slate-500">{t('ftNoExercises')}</p>
            {!isCompleted && (
              <button onClick={addExercise} className="text-sm text-teal-600 hover:underline">
                {t('ftAddExercise')}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-900">
                <tr>
                  <th className={`${headCell} text-left`}>{t('ftActivity')}</th>
                  <th className={`${headCell} text-center`}>{t('ftPlayersUsed')}</th>
                  <th className={`${headCell} text-center`}>{t('ftCourts')}</th>
                  <th className={`${headCell} text-right`}>{t('ftActivityTime')}</th>
                  <th className={`${headCell} text-right`}>{t('ftPauses')}</th>
                  <th className={`${headCell} text-right`}>{t('ftNet')}</th>
                  <th className={`${headCell} text-right`}>{t('ftEffective')}</th>
                  <th className={`${headCell} text-right`}>{t('ftMetabolicIntensity')}</th>
                  <th className={`${headCell} text-right`} />
                </tr>
              </thead>
              <tbody>
                {exercises.map((ex, idx) => (
                  <ExerciseRows
                    key={ex.id}
                    ex={ex}
                    idx={idx}
                    now={now}
                    available={available}
                    isCompleted={isCompleted}
                    showBreakRow={ex.breakRunning || ex.breakMs > 0}
                    cellNum={cellNum}
                    onPatch={(patch) => patchExercise(ex.id, patch)}
                    onToggle={() => toggleExercise(ex.id)}
                    onStop={() => stopExercise(ex.id)}
                    onStopBreak={() => stopBreak(ex.id)}
                    onRemove={() => removeExercise(ex.id)}
                  />
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <tr>
                  <td className="px-2 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {t('ftTotals')}
                  </td>
                  <td />
                  <td />
                  <td className={`${cellNum} font-bold text-slate-900 dark:text-white`}>{formatMs(totalActivity)}</td>
                  <td className={`${cellNum} font-bold text-slate-900 dark:text-white`}>{formatMs(totalPauses)}</td>
                  <td className={`${cellNum} font-bold text-slate-900 dark:text-white`}>{formatMs(totalNet)}</td>
                  <td className={`${cellNum} font-bold text-teal-700 dark:text-teal-300`}>{formatMsRound(totalEffective)}</td>
                  <td className={`${cellNum} font-bold text-slate-900 dark:text-white`}>
                    {formatMsRound(exercises.reduce((s, ex) => s + intensityMs(ex, now, available), 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

// ─── Stat tile ──────────────────────────────────────────

function StatTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${
      highlight
        ? 'border-teal-200 dark:border-teal-800 bg-teal-50/60 dark:bg-teal-900/20'
        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
    }`}>
      <p className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 font-mono text-lg font-bold tabular-nums ${
        highlight ? 'text-teal-700 dark:text-teal-300' : 'text-slate-900 dark:text-white'
      }`}>
        {value}
      </p>
    </div>
  );
}

// ─── Riga giocatore col semaforo ────────────────────────

function PlayerRow({
  label,
  sublabel,
  jersey,
  status,
  note,
  isCompleted,
  editableLabel,
  isGuest,
  rpe,
  fallbackRpe,
  load,
  onLabel,
  onStatus,
  onNote,
  onRpe,
  onRemove,
}: {
  label: string;
  sublabel?: string;
  jersey?: number | null;
  status: AttendanceStatus;
  note: string;
  isCompleted: boolean;
  editableLabel?: boolean;
  isGuest?: boolean;
  rpe?: number | null;
  fallbackRpe?: number | null;
  load?: number | null;
  onLabel?: (value: string) => void;
  onStatus: (status: AttendanceStatus) => void;
  onNote: (value: string) => void;
  onRpe?: (value: number | null) => void;
  onRemove?: () => void;
}) {
  const t = useTranslations('calendar');

  const border =
    status === 'PRESENT'
      ? 'border-green-300 dark:border-green-800 bg-green-50/40 dark:bg-green-900/10'
      : status === 'UNAVAILABLE'
        ? 'border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-900/10'
        : 'border-red-300 dark:border-red-900 bg-red-50/40 dark:bg-red-900/10';

  return (
    <div className={`rounded-xl border px-3 py-2 ${border}`}>
      <div className="flex items-center gap-2">
        {jersey != null && (
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
            {jersey}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {editableLabel ? (
            <input
              type="text"
              value={label}
              disabled={isCompleted}
              placeholder={t('ftGuestName')}
              onChange={(e) => onLabel?.(e.target.value)}
              className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-semibold text-slate-900 dark:text-white outline-none hover:border-slate-300 focus:border-teal-500 dark:hover:border-slate-600 disabled:opacity-60"
            />
          ) : (
            <p className="truncate px-1.5 text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
          )}
          <p className="truncate px-1.5 text-2xs text-slate-400 dark:text-slate-500">
            {isGuest ? t('ftGuest') : sublabel}
          </p>
        </div>

        {/* Semaforo: tre pulsanti, sempre tutti e tre visibili */}
        <div className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-1">
          <StatusDot
            active={status === 'PRESENT'}
            disabled={isCompleted}
            title={t('ftPresent')}
            onClick={() => onStatus('PRESENT')}
            tone="green"
          />
          <StatusDot
            active={status === 'UNAVAILABLE'}
            disabled={isCompleted}
            title={t('ftUnavailable')}
            onClick={() => onStatus('UNAVAILABLE')}
            tone="amber"
          />
          <StatusDot
            active={status === 'ABSENT'}
            disabled={isCompleted}
            title={t('ftAbsent')}
            onClick={() => onStatus('ABSENT')}
            tone="red"
          />
        </div>
        <div className="flex flex-shrink-0 items-center">
          {onRemove && !isCompleted && (
            <button
              onClick={onRemove}
              title={t('ftRemovePlayer')}
              className="ml-0.5 rounded-md p-1 text-slate-300 transition-colors hover:text-red-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {status !== 'PRESENT' && (
        <input
          type="text"
          value={note}
          disabled={isCompleted}
          placeholder={t('ftNotePlaceholder')}
          onChange={(e) => onNote(e.target.value)}
          className="mt-1.5 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-teal-500 disabled:opacity-60"
        />
      )}

      {/* RPE del singolo + carico calcolato. Vuoto = eredita l'RPE di sessione. */}
      {status === 'PRESENT' && onRpe && (
        <div className="mt-1.5 flex items-center gap-2">
          <label className="text-2xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('ftRpe')}
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={rpe ?? ''}
            disabled={isCompleted}
            placeholder={fallbackRpe ? String(fallbackRpe) : '1-10'}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '') return onRpe(null);
              const n = Math.round(Number(v));
              onRpe(Number.isFinite(n) && n >= 1 && n <= 10 ? n : null);
            }}
            className="w-16 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs tabular-nums text-slate-900 dark:text-white outline-none focus:border-teal-500 disabled:opacity-60"
          />
          <span className="ml-auto text-2xs text-slate-500 dark:text-slate-400">
            {t('ftLoad')}:{' '}
            <span className="font-mono font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {load != null ? Math.round(load) : '—'}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

// Classi scritte per intero: Tailwind non genera nomi costruiti a runtime.
const DOT_TONES = {
  green: {
    on: 'bg-green-500 border-green-600 ring-2 ring-green-300 ring-offset-1 dark:ring-offset-slate-900',
    off: 'bg-green-100 border-green-400 hover:bg-green-300 dark:bg-green-950 dark:border-green-700',
  },
  amber: {
    on: 'bg-amber-400 border-amber-500 ring-2 ring-amber-200 ring-offset-1 dark:ring-offset-slate-900',
    off: 'bg-amber-100 border-amber-400 hover:bg-amber-300 dark:bg-amber-950 dark:border-amber-700',
  },
  red: {
    on: 'bg-red-500 border-red-600 ring-2 ring-red-300 ring-offset-1 dark:ring-offset-slate-900',
    off: 'bg-red-100 border-red-400 hover:bg-red-300 dark:bg-red-950 dark:border-red-800',
  },
} as const;

function StatusDot({
  active,
  disabled,
  title,
  onClick,
  tone,
}: {
  active: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  tone: keyof typeof DOT_TONES;
}) {
  const palette = DOT_TONES[tone];
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`h-6 w-6 cursor-pointer rounded-full border-2 transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? palette.on : palette.off
      }`}
    />
  );
}

// ─── Riga esercizio + riga break ────────────────────────

function ExerciseRows({
  ex,
  idx,
  now,
  available,
  isCompleted,
  showBreakRow,
  cellNum,
  onPatch,
  onToggle,
  onStop,
  onStopBreak,
  onRemove,
}: {
  ex: Exercise;
  idx: number;
  now: number;
  available: number;
  isCompleted: boolean;
  showBreakRow: boolean;
  cellNum: string;
  onPatch: (patch: Partial<Exercise>) => void;
  onToggle: () => void;
  onStop: () => void;
  onStopBreak: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations('calendar');
  const activity = liveActivity(ex, now);
  const pause = livePause(ex, now);
  const net = netMs(ex, now);
  const effective = effectiveMs(ex, now, available);
  const intensity = intensityMs(ex, now, available);
  const running = ex.state === 'running';
  const paused = ex.state === 'paused';

  const numInput =
    'w-16 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-center text-sm text-slate-900 dark:text-white outline-none focus:border-teal-500 disabled:opacity-60';

  return (
    <>
      <tr className={`border-b border-slate-100 dark:border-slate-700 ${
        running ? 'bg-green-50/60 dark:bg-green-900/10' : paused ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''
      }`}>
        <td className="px-2 py-2">
          <div className="flex items-center gap-2">
            <span className="w-5 text-xs text-slate-400 dark:text-slate-500">{idx + 1}</span>
            <input
              type="text"
              value={ex.name}
              disabled={isCompleted}
              placeholder={t('ftExerciseName')}
              onChange={(e) => onPatch({ name: e.target.value })}
              className="min-w-[8rem] flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-900 dark:text-white outline-none hover:border-slate-200 focus:border-teal-500 dark:hover:border-slate-600 disabled:opacity-60"
            />
            <label className="flex flex-shrink-0 cursor-pointer items-center gap-1 text-2xs text-slate-500 dark:text-slate-400" title={t('ftWarmupHint')}>
              <input
                type="checkbox"
                checked={ex.isWarmup}
                disabled={isCompleted}
                onChange={(e) => onPatch({ isWarmup: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              {t('ftWarmup')}
            </label>
            {running && <span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-green-500" />}
            {paused && <span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-amber-500" />}
          </div>
        </td>
        <td className="px-2 py-2 text-center">
          <input
            type="number"
            min={0}
            max={999}
            value={ex.players}
            disabled={isCompleted}
            onChange={(e) => onPatch({ players: Number.parseInt(e.target.value, 10) || 0 })}
            className={numInput}
          />
        </td>
        <td className="px-2 py-2 text-center">
          <input
            type="number"
            min={0}
            max={99}
            value={ex.courts}
            disabled={isCompleted}
            onChange={(e) => onPatch({ courts: Number.parseInt(e.target.value, 10) || 0 })}
            className={numInput}
          />
        </td>
        <td className={`${cellNum} ${running ? 'text-green-600 dark:text-green-400 font-bold' : 'text-slate-900 dark:text-white'}`}>
          {formatMs(activity)}
        </td>
        <td className={`${cellNum} ${paused ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>
          {formatMs(pause)}
        </td>
        <td className={`${cellNum} ${net < 0 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>{formatMs(net)}</td>
        <td className={`${cellNum} text-teal-700 dark:text-teal-300 font-semibold`}>{formatMsRound(effective)}</td>
        <td className={`${cellNum} text-slate-900 dark:text-white`}>{formatMsRound(intensity)}</td>
        <td className="px-2 py-2">
          {!isCompleted && (
            <div className="flex items-center justify-end gap-1.5">
              <button
                onClick={onToggle}
                title={running ? t('ftPause') : t('ftStart')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-white ${
                  running ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {running ? t('ftPause') : ex.state === 'idle' ? t('ftStart') : t('ftResume')}
              </button>
              <button
                onClick={onStop}
                disabled={ex.state !== 'running' && ex.state !== 'paused'}
                title={t('ftStop')}
                className="inline-flex items-center gap-1 rounded-md bg-slate-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-30"
              >
                <Square className="h-3.5 w-3.5" />
                {t('ftStop')}
              </button>
              <button
                onClick={onRemove}
                title={t('ftRemoveExercise')}
                className="rounded-md p-1.5 text-slate-300 hover:text-red-500 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </td>
      </tr>

      {showBreakRow && (
        <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <td colSpan={3} className="px-2 py-1.5 pl-9 text-xs font-medium italic text-slate-500 dark:text-slate-400">
            {t('ftBreak')}
          </td>
          <td className={`${cellNum} ${ex.breakRunning ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
            {formatMs(liveBreak(ex, now))}
          </td>
          <td colSpan={4} />
          <td className="px-2 py-1.5">
            {!isCompleted && ex.breakRunning && (
              <div className="flex justify-end">
                <button
                  onClick={onStopBreak}
                  className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-2xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  <Square className="h-3 w-3" />
                  {t('ftStopBreak')}
                </button>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
