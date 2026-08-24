# -*- coding: utf-8 -*-
"""Foglio presenze su tutti i tipi di allenamento: RPE per atleta e carico."""
import io, os

ROOTS = ['trainmind-app', 'trainmind-mobile']
REL = 'apps/web/src/app/dashboard/field-training/[eventId]/page.tsx'


def patch(path):
    s = io.open(path, encoding='utf-8').read()

    def sub(old, new, label):
        assert s.count(old) == 1, '%s: "%s" non trovata o non unica (%d)' % (path, label, s.count(old))
        return s.replace(old, new)

    # ── import ──────────────────────────────────────────────────────────
    s = sub("import { useParams, useRouter } from 'next/navigation';",
            "import { useParams, useRouter, useSearchParams } from 'next/navigation';",
            'import navigation')

    s = sub("""  Plus,
  X,
  Timer,
  Users,
  Save,
} from 'lucide-react';""",
            """  Plus,
  X,
  Timer,
  Users,
  Save,
  ClipboardCheck,
  Gauge,
} from 'lucide-react';""",
            'import icone')

    # ── tipi ────────────────────────────────────────────────────────────
    s = sub("""interface Entry {
  id: string;
  athleteId: string;
  totalActiveMs: number;
  status: AttendanceStatus | null;
  note: string | null;
  athlete: AthleteInfo;
}""",
            """interface Entry {
  id: string;
  athleteId: string;
  totalActiveMs: number;
  status: AttendanceStatus | null;
  note: string | null;
  rpe: number | null;
  athlete: AthleteInfo;
}""",
            'Entry.rpe')

    s = sub("""interface RosterPlayer {
  athleteId: string;
  athlete: AthleteInfo;
  status: AttendanceStatus;
  note: string;
}""",
            """interface RosterPlayer {
  athleteId: string;
  athlete: AthleteInfo;
  status: AttendanceStatus;
  note: string;
  /** RPE percepito dal singolo atleta (1-10); se vuoto vale l'RPE di sessione */
  rpe: number | null;
}""",
            'RosterPlayer.rpe')

    s = sub("""interface FieldSession {
  id: string;
  calendarEventId: string;
  teamId: string | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
  availableAthletes: number | null;
  exercises: StoredExercise[] | null;
  guests: GuestPlayer[] | null;
  entries: Entry[];
  team: { id: string; name: string; color: string | null } | null;
  calendarEvent: { id: string; title: string; startTime: string; endTime: string; type: string } | null;
}""",
            """interface FieldSession {
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
}""",
            'FieldSession')

    # ── helper: RPE valido ──────────────────────────────────────────────
    s = sub("""function normalizeStatus(value: unknown): AttendanceStatus {
  return value === 'UNAVAILABLE' || value === 'ABSENT' ? value : 'PRESENT';
}""",
            """function normalizeStatus(value: unknown): AttendanceStatus {
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
const EXERCISE_TYPES = new Set(['basket']);""",
            'normalizeRpe')

    # ── stato pagina ────────────────────────────────────────────────────
    s = sub("""  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('calendar');
  const eventId = params.eventId as string;""",
            """  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const t = useTranslations('calendar');
  // La stessa pagina serve sia gli eventi di calendario sia le sessioni della
  // programmazione: `?source=session` dice quale delle due cose e' l'id.
  const routeId = params.eventId as string;
  const fromPlan = searchParams.get('source') === 'session';""",
            'params pagina')

    s = sub("""  // Esercizi
  const [exercises, setExercises] = useState<Exercise[]>([]);""",
            """  // Esercizi
  const [exercises, setExercises] = useState<Exercise[]>([]);

  // Carico: durata effettiva della seduta e RPE di sessione (fallback)
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [sessionRpe, setSessionRpe] = useState<number | null>(null);""",
            'stato carico')

    # ── caricamento ─────────────────────────────────────────────────────
    s = sub("""      const res = await apiFetch<{ data: { session: FieldSession } }>(`/field-training/by-event/${eventId}`);
      setSession(res.data.session);
      hydrate(res.data.session);""",
            """      const lookup = fromPlan
        ? `/field-training/by-session/${routeId}`
        : `/field-training/by-event/${routeId}`;
      const res = await apiFetch<{ data: { session: FieldSession } }>(lookup);
      setSession(res.data.session);
      hydrate(res.data.session);""",
            'lookup foglio')

    s = sub("""          body: JSON.stringify({ calendarEventId: eventId }),""",
            """          body: JSON.stringify(
            fromPlan ? { trainingSessionId: routeId } : { calendarEventId: routeId },
          ),""",
            'body start')

    s = sub("""    setLoading(false);
  }, [eventId]);""",
            """    setLoading(false);
  }, [routeId, fromPlan]);""",
            'deps initSession')

    # ── hydrate ─────────────────────────────────────────────────────────
    s = sub("""    setRoster(
      (s.entries || []).map((e) => ({
        athleteId: e.athleteId,
        athlete: e.athlete,
        status: normalizeStatus(e.status),
        note: e.note || '',
      })),
    );""",
            """    setRoster(
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
    setSessionRpe(normalizeRpe(s.sessionRpe));""",
            'hydrate roster')

    # ── azioni roster ───────────────────────────────────────────────────
    s = sub("""  const setPlayerNote = (athleteId: string, note: string) => {
    setRoster((prev) => prev.map((p) => (p.athleteId === athleteId ? { ...p, note } : p)));
  };""",
            """  const setPlayerNote = (athleteId: string, note: string) => {
    setRoster((prev) => prev.map((p) => (p.athleteId === athleteId ? { ...p, note } : p)));
  };

  const setPlayerRpe = (athleteId: string, rpe: number | null) => {
    setRoster((prev) => prev.map((p) => (p.athleteId === athleteId ? { ...p, rpe } : p)));
  };""",
            'setPlayerRpe')

    # ── persist ─────────────────────────────────────────────────────────
    s = sub("""        body: JSON.stringify({
          availableAthletes: available,
          athletes: roster.map((p) => ({ athleteId: p.athleteId, status: p.status, note: p.note || null })),
          guests: guests.map((g) => ({ id: g.id, name: g.name, status: g.status, note: g.note || null })),
        }),""",
            """        body: JSON.stringify({
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
        }),""",
            'persist roster')

    s = sub("""  }, [session, roster, guests, exercises, available]);""",
            """  }, [session, roster, guests, exercises, available, durationMinutes, sessionRpe]);""",
            'deps persist')

    # ── completamento: avvisa se qualcuno resta senza carico ───────────
    s = sub("""      const res = await apiFetch<{ data: { completed: boolean; trainingSessions: number } }>(
        `/field-training/${session.id}/complete`,
        { method: 'PUT', body: JSON.stringify({}) },
      );
      toast('success', t('ftSessionCompletedMsg', { count: res.data.trainingSessions }));""",
            """      const res = await apiFetch<{ data: { completed: boolean; trainingSessions: number; skippedNoRpe?: number } }>(
        `/field-training/${session.id}/complete`,
        { method: 'PUT', body: JSON.stringify({}) },
      );
      toast('success', t('ftSessionCompletedMsg', { count: res.data.trainingSessions }));
      if (res.data.skippedNoRpe) {
        // Senza RPE o senza durata non si puo' calcolare il carico:
        // quei giocatori restano registrati come presenti ma senza sRPE.
        toast('info', t('ftSkippedNoRpe', { count: res.data.skippedNoRpe }));
      }""",
            'toast skipped')

    # ── render: derivati ────────────────────────────────────────────────
    s = sub("""  const isCompleted = session.status === 'COMPLETED';
  const now = Date.now();""",
            """  const isCompleted = session.status === 'COMPLETED';
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
    : 0;""",
            'derivati render')

    # ── header: icona e titolo ──────────────────────────────────────────
    s = sub("""              <Timer className="mr-2 inline h-6 w-6 text-orange-600" />
              {t('title')}""",
            """              <ClipboardCheck className="mr-2 inline h-6 w-6 text-orange-600" />
              {showExercises ? t('title') : t('ftAttendance')}""",
            'titolo header')

    s = sub("""              {session.calendarEvent?.title || t('ftFieldTraining')}""",
            """              {sessionTitle}""",
            'sottotitolo header')

    # ── tessere in alto: solo per il basket i tempi, sempre il carico ──
    s = sub("""        <div className="lg:col-span-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StatTile label={t('ftTotalTime')} value={formatMs(totalActivity)} />
          <StatTile label={t('ftTotalPlayed')} value={formatMs(totalPlayed)} />
          <StatTile label={t('ftTotalPauses')} value={formatMs(totalPauses)} />
          <StatTile label={t('ftTotalNet')} value={formatMs(totalNet)} />
          <StatTile label={t('ftEffectivePerPlayer')} value={formatMsRound(totalEffective)} highlight />
          <StatTile label={t('ftDensity')} value={`${(density * 100).toFixed(1)}%`} highlight />
        </div>
      </div>""",
            """        {showExercises ? (
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
      </div>""",
            'tessere e blocco carico')

    # ── riepilogo carico nell'intestazione dei giocatori ───────────────
    s = sub("""              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" />{absentCount}
              </span>
            </span>
          </div>""",
            """              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" />{absentCount}
              </span>
            </span>
            {totalLoad > 0 && (
              <span className="rounded-full bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300">
                {t('ftTotalLoad')}: {Math.round(totalLoad)}
              </span>
            )}
          </div>""",
            'badge carico')

    # ── PlayerRow: passaggio RPE ────────────────────────────────────────
    s = sub("""                isCompleted={isCompleted}
                onStatus={(s) => setPlayerStatus(p.athleteId, s)}
                onNote={(n) => setPlayerNote(p.athleteId, n)}
              />""",
            """                isCompleted={isCompleted}
                rpe={p.rpe}
                fallbackRpe={sessionRpe}
                load={loadOf(p)}
                onRpe={(v) => setPlayerRpe(p.athleteId, v)}
                onStatus={(s) => setPlayerStatus(p.athleteId, s)}
                onNote={(n) => setPlayerNote(p.athleteId, n)}
              />""",
            'props PlayerRow rosa')

    # ── esercizi condizionati ───────────────────────────────────────────
    s = sub("""      {/* ─── Esercizi ──────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">""",
            """      {/* ─── Esercizi (solo allenamento basket) ─────────────── */}
      {showExercises && (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">""",
            'apertura blocco esercizi')

    s = sub("""            </table>
          </div>
        )}
      </div>
    </div>
  );
}""",
            """            </table>
          </div>
        )}
      </div>
      )}
    </div>
  );
}""",
            'chiusura blocco esercizi')

    # ── PlayerRow: firma e riga RPE ─────────────────────────────────────
    s = sub("""  status,
  note,
  isCompleted,
  editableLabel,
  isGuest,
  onLabel,
  onStatus,
  onNote,
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
  onLabel?: (value: string) => void;
  onStatus: (status: AttendanceStatus) => void;
  onNote: (value: string) => void;
  onRemove?: () => void;
}) {""",
            """  status,
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
}) {""",
            'firma PlayerRow')

    s = sub("""      {status !== 'PRESENT' && (
        <input
          type="text"
          value={note}
          disabled={isCompleted}
          placeholder={t('ftNotePlaceholder')}
          onChange={(e) => onNote(e.target.value)}
          className="mt-1.5 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 outline-none focus:border-teal-500 disabled:opacity-60"
        />
      )}""",
            """      {status !== 'PRESENT' && (
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
      )}""",
            'input RPE')

    io.open(path, 'w', encoding='utf-8', newline='').write(s)
    print('  patched', path)


for root in ROOTS:
    p = os.path.join(root, REL)
    if os.path.exists(p):
        patch(p)
    else:
        print('  skip (assente)', p)
