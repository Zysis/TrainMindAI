'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Clock,
  Dumbbell,
  Dribbble,
  User,
  Target,
  Swords,
  HeartPulse,
  Stethoscope,
  Users,
  CalendarDays,
  Trash2,
  ClipboardList,
  ClipboardCheck,
  ExternalLink,
  Layers,
  Ban,
  RotateCcw,
  CalendarClock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { apiFetch } from '@/lib/auth/fetch';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useApiError } from '@/lib/i18n/api-error';
import { useToast } from '@/components/ui/toast';
import { useTeam } from '@/hooks/use-team';

// ─── Types ──────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  allDay: boolean;
  type: string;
  color: string | null;
  isSession?: boolean;
  sessionId?: string;
  /** Stato del foglio presenze collegato: null = mai aperto, quindi pianificato */
  sheetStatus?: string | null;
  athleteId?: string | null;
  athleteName?: string | null;
  status?: string;
  /** Solo sugli eventi 'match'. */
  opponent?: string | null;
  isHome?: boolean | null;
  venue?: string | null;
  aiModified?: boolean;
  teamId?: string | null;
  teamName?: string | null;
  teamColor?: string | null;
}

interface WeekContext {
  weekStart: string;
  weekEnd: string;
  planId: string;
  planName: string;
  mesocycleId: string;
  mesocycleName: string;
  mesocyclePhase: string;
  mesocycleColor: string | null;
  microcycleWeekNumber: number;
  loadPercent: number;
  intensity: string;
  isDeload: boolean;
  teamId?: string | null;
  teamName?: string | null;
  teamColor?: string | null;
}

// ─── Constants ──────────────────────────────────────────

const EVENT_TYPE_STYLES: Record<string, { labelKey: string; color: string; bg: string; icon: typeof Dumbbell }> = {
  gym: { labelKey: 'typeGym', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200', icon: Dumbbell },
  basket: { labelKey: 'typeBasket', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: Dribbble },
  individual: { labelKey: 'typeIndividual', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200', icon: User },
  shooting: { labelKey: 'typeShooting', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Target },
  match: { labelKey: 'typeMatch', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: Swords },
  rehab: { labelKey: 'typeRehab', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200', icon: HeartPulse },
  meeting: { labelKey: 'typeMeeting', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Users },
  medical: { labelKey: 'typeMedical', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: Stethoscope },
  other: { labelKey: 'typeOther', color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-50 border-slate-200 dark:border-slate-700', icon: CalendarDays },
  // Non selezionabile a mano: l'API marca così le sessioni dei piani di allenamento
  session: { labelKey: 'typeSession', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', icon: Layers },
};

/** Tipi che si possono scegliere creando un evento (`session` la assegna l'API) */
const CREATABLE_TYPES = ['gym', 'basket', 'individual', 'shooting', 'match', 'rehab', 'meeting', 'medical', 'other'];

/** Tipi di allenamento con foglio presenze: semafori, RPE per atleta e carico.
 *  Le sessioni della programmazione (`isSession`) lo hanno comunque. */
const ATTENDANCE_TYPES = new Set(['gym', 'basket', 'individual', 'shooting', 'rehab']);

/** true se l'evento merita il pulsante del foglio.
 *  Una sessione annullata resta visibile in calendario ma non si allena: il
 *  foglio presenze la riaprirebbe di fatto, quindi il pulsante sparisce. */
function hasAttendance(ev: { type: string; isSession?: boolean; sessionId?: string; status?: string }): boolean {
  if (ev.isSession) return Boolean(ev.sessionId) && ev.status !== 'CANCELLED';
  return ATTENDANCE_TYPES.has(ev.type);
}

/** Solo il pallino: nella lista lo stato non deve sembrare cliccabile.
 *  L'etichetta resta nel tooltip e per intero nel pannello di dettaglio. */
function StatusDotOnly({ status }: { status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' }) {
  const t = useTranslations('calendar');
  const dot =
    status === 'COMPLETED' ? 'bg-green-500' : status === 'IN_PROGRESS' ? 'bg-teal-500' : 'bg-blue-500';
  const label =
    status === 'COMPLETED'
      ? t('statusCompletedShort')
      : status === 'IN_PROGRESS'
        ? t('statusInProgress')
        : t('statusPlannedShort');
  return (
    <span
      title={label}
      aria-label={label}
      className={`h-2 w-2 flex-shrink-0 rounded-full ${dot}`}
    />
  );
}

function TrainingStatusBadge({ status }: { status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' }) {
  const t = useTranslations('calendar');
  const tone =
    status === 'COMPLETED'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
      : status === 'IN_PROGRESS'
        ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
  const dot =
    status === 'COMPLETED' ? 'bg-green-500' : status === 'IN_PROGRESS' ? 'bg-teal-500' : 'bg-blue-500';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status === 'COMPLETED'
        ? t('statusCompletedShort')
        : status === 'IN_PROGRESS'
          ? t('statusInProgress')
          : t('statusPlannedShort')}
    </span>
  );
}

/** Stato di un allenamento per l'occhio: blu pianificato, verde completato.
 *  Le sessioni della programmazione hanno uno stato proprio; gli eventi creati
 *  a mano lo prendono dal foglio presenze collegato. */
function trainingStatus(ev: {
  isSession?: boolean;
  status?: string;
  sheetStatus?: string | null;
}): 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' {
  const raw = ev.isSession ? ev.status : ev.sheetStatus;
  if (raw === 'COMPLETED') return 'COMPLETED';
  if (raw === 'IN_PROGRESS') return 'IN_PROGRESS';
  return 'PLANNED';
}

/** Ordine delle fasi del protocollo Return To Play, come nell'API */
const RTP_PHASE_ORDER = ['PHASE_1', 'PHASE_2', 'PHASE_3', 'PHASE_4', 'PHASE_5', 'CLEARED'];

interface RtpProtocolInfo {
  protocolId: string;
  athleteId: string;
  athleteName: string;
  phase: string;
}

interface RtpApiProtocol {
  id: string;
  currentPhase: string;
  athlete: { id: string; firstName: string; lastName: string };
}

/** Protocolli RTP attivi, usati dagli eventi di tipo Rehab */
async function fetchActiveRtp(): Promise<RtpProtocolInfo[]> {
  try {
    const res = await apiFetch<{ data: { protocols: RtpApiProtocol[] } }>('/rtp');
    return (res.data?.protocols || []).map((p) => ({
      protocolId: p.id,
      athleteId: p.athlete.id,
      athleteName: `${p.athlete.lastName} ${p.athlete.firstName}`,
      phase: p.currentPhase,
    }));
  } catch {
    return [];
  }
}

const statusColors: Record<string, string> = {
  COMPLETED: 'bg-green-500',
  IN_PROGRESS: 'bg-teal-500',
  PLANNED: 'bg-blue-500',
  CANCELLED: 'bg-slate-400',
};

const PHASE_LABEL_KEYS: Record<string, string> = {
  PREPARATION: 'phasePreparation',
  SPECIFIC: 'phaseSpecific',
  COMPETITION: 'phaseCompetition',
  TRANSITION: 'phaseTransition',
  TAPER: 'phaseTaper',
  RECOVERY: 'phaseRecovery',
};

const INTENSITY_LABEL_KEYS: Record<string, string> = {
  VERY_LOW: 'intensityVeryLow',
  LOW: 'intensityLow',
  MODERATE: 'intensityModerate',
  HIGH: 'intensityHigh',
  VERY_HIGH: 'intensityVeryHigh',
};

// ─── Helpers ────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  return { daysInMonth, startOffset };
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

// ─── Page Component ─────────────────────────────────────

function useEventTypeConfig(t: ReturnType<typeof useTranslations>) {
  return useMemo(() => {
    const result: Record<string, { label: string; color: string; bg: string; icon: typeof Dumbbell }> = {};
    for (const [key, style] of Object.entries(EVENT_TYPE_STYLES)) {
      result[key] = { label: t(style.labelKey), color: style.color, bg: style.bg, icon: style.icon };
    }
    return result;
  }, [t]);
}

export default function CalendarPage() {
  const t = useTranslations('calendar');
  const apiError = useApiError();
  const { toast } = useToast();
  const router = useRouter();
  const { selectedTeamId } = useTeam();
  const eventTypeConfig = useEventTypeConfig(t);
  const DAYS = useMemo(() => [t('dayMon'), t('dayTue'), t('dayWed'), t('dayThu'), t('dayFri'), t('daySat'), t('daySun')], [t]);
  const MONTHS = useMemo(() => [t('monthJanuary'), t('monthFebruary'), t('monthMarch'), t('monthApril'), t('monthMay'), t('monthJune'), t('monthJuly'), t('monthAugust'), t('monthSeptember'), t('monthOctober'), t('monthNovember'), t('monthDecember')], [t]);
  const PHASE_LABELS = useMemo(() => {
    const result: Record<string, string> = {};
    for (const [key, labelKey] of Object.entries(PHASE_LABEL_KEYS)) {
      result[key] = t(labelKey);
    }
    return result;
  }, [t]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState(false);
  // Le sessioni della programmazione non si cancellano (regola SESSION_IN_PLAN):
  // si annullano, cosi' il mesociclo resta integro e la seduta saltata resta
  // visibile come tale. La conferma serve solo per l'annullamento, non per il
  // ripristino, che non distrugge niente.
  const [cancelTarget, setCancelTarget] = useState<CalendarEvent | null>(null);
  const [cancellingSession, setCancellingSession] = useState(false);
  // Periodization context
  const [weekContexts, setWeekContexts] = useState<WeekContext[]>([]);
  // Drag-and-drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const { daysInMonth, startOffset } = getDaysInMonth(year, month);
  const today = new Date();

  // ─── Fetch Events ───────────────────────────────────────

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const teamParam = selectedTeamId ? `&teamId=${selectedTeamId}` : '';
    try {
      const res = await apiFetch<{ data: CalendarEvent[] }>(`/calendar/events?from=${from}&to=${to}${teamParam}`);
      setEvents(res.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [year, month, selectedTeamId]);

  const fetchPeriodizationContext = useCallback(async () => {
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const teamParam = selectedTeamId ? `&teamId=${selectedTeamId}` : '';
    try {
      const res = await apiFetch<{ data: WeekContext[] }>(`/periodization/calendar-context?from=${from}&to=${to}${teamParam}`);
      setWeekContexts(res.data || []);
    } catch { /* ignore */ }
  }, [year, month, selectedTeamId]);

  useEffect(() => {
    fetchEvents();
    fetchPeriodizationContext();
  }, [fetchEvents, fetchPeriodizationContext]);

  // ─── Events By Day ──────────────────────────────────────

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (const ev of events) {
      const d = new Date(ev.startTime);
      if (d.getMonth() === month && d.getFullYear() === year) {
        const day = d.getDate();
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push(ev);
      }
    }
    // Sort events within each day
    for (const [, dayEvents] of map) {
      dayEvents.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }
    return map;
  }, [events, month, year]);

  // ─── Periodization context by day ───────────────────────

  const periodizationByDay = useMemo(() => {
    const map = new Map<number, WeekContext[]>();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const matches: WeekContext[] = [];
      for (const wc of weekContexts) {
        if (dateStr >= wc.weekStart && dateStr <= wc.weekEnd) {
          matches.push(wc);
        }
      }
      if (matches.length > 0) map.set(day, matches);
    }
    return map;
  }, [weekContexts, year, month, daysInMonth]);

  // ─── Actions ────────────────────────────────────────────

  const deleteEvent = async (id: string) => {
    setDeletingEvent(true);
    try {
      await apiFetch(`/calendar/events/${id}`, { method: 'DELETE' });
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setSelectedEvent(null);
      setDeleteTarget(null);
      toast('success', t('eventDeleted'));
    } catch (err) {
      // Il server rifiuta gli allenamenti gia' completati e spiega perche':
      // il suo messaggio e' piu' utile di una frase fissa.
      toast('error', apiError(err, t('eventDeleteError')));
    } finally {
      setDeletingEvent(false);
    }
  };

  // Annulla / ripristina una sessione del piano. `PUT /training/sessions/:id`
  // rifiuta con 409 SESSION_ALREADY_COMPLETED se la seduta e' gia' stata svolta.
  const setSessionStatus = async (event: CalendarEvent, status: 'CANCELLED' | 'PLANNED') => {
    if (!event.sessionId) return;
    setCancellingSession(true);
    try {
      await apiFetch(`/training/sessions/${event.sessionId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      const patched = { ...event, status, color: status === 'CANCELLED' ? '#94a3b8' : '#3b82f6' };
      setEvents((prev) => prev.map((e) => (e.id === event.id ? patched : e)));
      setSelectedEvent((prev) => (prev && prev.id === event.id ? patched : prev));
      setCancelTarget(null);
      toast('success', status === 'CANCELLED' ? t('sessionCancelled') : t('sessionRestored'));
    } catch (err) {
      toast('error', apiError(err, t('sessionCancelError')));
    } finally {
      setCancellingSession(false);
    }
  };

  // Spostamento esplicito: il drag-and-drop sul mese fa la stessa cosa, ma non
  // e' scopribile e non serve se il giorno di destinazione e' in un altro mese.
  const rescheduleSession = async (event: CalendarEvent, dateStr: string) => {
    if (!event.sessionId || !dateStr) return;
    try {
      await apiFetch(`/training/sessions/${event.sessionId}`, {
        method: 'PUT',
        body: JSON.stringify({ date: dateStr }),
      });
      toast('success', t('eventRescheduled'));
      setSelectedEvent(null);
      await fetchEvents();
    } catch (err) {
      toast('error', apiError(err, t('eventRescheduleError')));
    }
  };

  const handleDayClick = (day: number) => {
    const date = new Date(year, month, day);
    setSelectedDay(date);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // ─── Drag-and-Drop Reschedule ───────────────────────────

  const handleDragStart = (e: React.DragEvent, ev: CalendarEvent) => {
    // Sessions from training plans cannot be rescheduled (yet)
    // Actually we support both, but only allow drag for events whose owner the user controls.
    setDraggingId(ev.id);
    e.dataTransfer.effectAllowed = 'move';
    // Required for Firefox compatibility
    e.dataTransfer.setData('text/plain', ev.id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverDay(null);
  };

  const handleDayDragOver = (e: React.DragEvent, day: number) => {
    if (!draggingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDay !== day) setDragOverDay(day);
  };

  const handleDayDragLeave = (day: number) => {
    if (dragOverDay === day) setDragOverDay(null);
  };

  const handleDayDrop = async (e: React.DragEvent, targetDay: number) => {
    e.preventDefault();
    const eventId = draggingId || e.dataTransfer.getData('text/plain');
    setDraggingId(null);
    setDragOverDay(null);
    if (!eventId) return;

    const event = events.find((ev) => ev.id === eventId);
    if (!event) return;

    const originalStart = new Date(event.startTime);
    const originalEnd = new Date(event.endTime);

    // Same day → no-op
    if (
      originalStart.getFullYear() === year &&
      originalStart.getMonth() === month &&
      originalStart.getDate() === targetDay
    ) return;

    // Preserve time-of-day, change the date part only
    const newStart = new Date(
      year,
      month,
      targetDay,
      originalStart.getHours(),
      originalStart.getMinutes(),
      originalStart.getSeconds(),
    );
    const durationMs = originalEnd.getTime() - originalStart.getTime();
    const newEnd = new Date(newStart.getTime() + durationMs);

    // Optimistic update
    const updatedEvent: CalendarEvent = {
      ...event,
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
    };
    setEvents((prev) => prev.map((ev) => (ev.id === eventId ? updatedEvent : ev)));

    try {
      if (event.isSession && event.sessionId) {
        // Training session: only the date (YYYY-MM-DD) is updated server-side
        const dateStr = `${newStart.getFullYear()}-${String(newStart.getMonth() + 1).padStart(2, '0')}-${String(newStart.getDate()).padStart(2, '0')}`;
        await apiFetch(`/training/sessions/${event.sessionId}`, {
          method: 'PUT',
          body: JSON.stringify({ date: dateStr }),
        });
      } else {
        await apiFetch(`/calendar/events/${event.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            startTime: newStart.toISOString(),
            endTime: newEnd.toISOString(),
          }),
        });
      }
      toast('success', t('eventRescheduled'));
    } catch {
      // Rollback
      setEvents((prev) => prev.map((ev) => (ev.id === eventId ? event : ev)));
      toast('error', t('eventRescheduleError'));
    }
  };

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('headerSubtitle', { count: events.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700"
          >
            {t('today')}
          </button>
          <button
            onClick={() => { setSelectedDay(new Date()); setShowCreateModal(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" />
            {t('createEvent')}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
        {Object.entries(eventTypeConfig).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <cfg.icon className={`h-3.5 w-3.5 ${cfg.color}`} />
            <span className="text-xs text-slate-600 dark:text-slate-400">{cfg.label}</span>
          </div>
        ))}
        <div className="h-4 w-px bg-slate-200" />
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-xs text-slate-500 dark:text-slate-400">{t('statusCompleted')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          <span className="text-xs text-slate-500 dark:text-slate-400">{t('statusPlanned')}</span>
        </div>
      </div>

      {/* Periodization Context Banner */}
      {weekContexts.length > 0 && (() => {
        // Group by team for multi-team display
        const teamGroups = new Map<string, { teamName: string; teamColor: string | null; planName: string; contexts: WeekContext[] }>();
        for (const wc of weekContexts) {
          const key = wc.teamId || wc.planId; // fallback to planId if no team
          if (!teamGroups.has(key)) {
            teamGroups.set(key, { teamName: wc.teamName || '', teamColor: wc.teamColor || null, planName: wc.planName, contexts: [] });
          }
          teamGroups.get(key)!.contexts.push(wc);
        }

        const renderBands = (contexts: WeekContext[]) => {
          const bands: Array<{ mesocycleName: string; mesocyclePhase: string; mesocycleColor: string | null; weeks: number }> = [];
          let prevKey = '';
          for (const wc of contexts) {
            const key = wc.mesocycleId;
            if (key === prevKey && bands.length > 0) {
              bands[bands.length - 1].weeks++;
            } else {
              bands.push({ mesocycleName: wc.mesocycleName, mesocyclePhase: wc.mesocyclePhase, mesocycleColor: wc.mesocycleColor, weeks: 1 });
            }
            prevKey = key;
          }
          return (
            <div className="flex gap-1">
              {bands.map((band, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center rounded-lg px-3 py-1.5 text-xs"
                  style={{
                    flex: band.weeks,
                    backgroundColor: band.mesocycleColor ? `${band.mesocycleColor}20` : '#f1f5f9',
                    borderLeft: `3px solid ${band.mesocycleColor || '#94a3b8'}`,
                  }}
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{band.mesocycleName}</span>
                  <span className="text-slate-500 dark:text-slate-400">{PHASE_LABELS[band.mesocyclePhase] || band.mesocyclePhase}</span>
                </div>
              ))}
            </div>
          );
        };

        const groups = Array.from(teamGroups.entries());
        const showTeamLabel = !selectedTeamId && groups.length > 1;

        return (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
            <div className="mb-2 flex items-center gap-2">
              <Layers className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span className="text-xs font-semibold text-slate-700">{t('activePeriodization')}</span>
            </div>
            <div className="space-y-2">
              {groups.map(([key, group]) => (
                <div key={key}>
                  {showTeamLabel && (
                    <div className="mb-1 flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: group.teamColor || '#94a3b8' }}
                      />
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        {group.teamName || group.planName}
                      </span>
                      <span className="text-2xs text-slate-400 dark:text-slate-500">· {group.planName}</span>
                    </div>
                  )}
                  {!showTeamLabel && (
                    <div className="mb-1">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{group.planName}</span>
                    </div>
                  )}
                  {renderBands(group.contexts)}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="flex gap-6">
        {/* Calendar Grid */}
        <div className="flex-1">
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            {/* Month Navigation */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 px-5 py-3">
              <button
                onClick={() => setCurrentDate(new Date(year, month - 1))}
                className="rounded-lg p-2 text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700 dark:bg-slate-700 hover:text-slate-700"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {MONTHS[month]} {year}
              </h2>
              <button
                onClick={() => setCurrentDate(new Date(year, month + 1))}
                className="rounded-lg p-2 text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700 dark:bg-slate-700 hover:text-slate-700"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-700">
              {DAYS.map((day) => (
                <div key={day} className="bg-slate-50 dark:bg-slate-900 py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {day}
                </div>
              ))}
              {Array.from({ length: startOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[100px] bg-white dark:bg-slate-800" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                const dayEvents = eventsByDay.get(day) || [];
                const isSelected = selectedDay && isSameDay(selectedDay, new Date(year, month, day));
                const isDropTarget = dragOverDay === day && draggingId !== null;
                const dayContexts = periodizationByDay.get(day) || [];
                const primaryContext = dayContexts[0] || null;

                return (
                  <div
                    key={day}
                    onClick={() => handleDayClick(day)}
                    onDragOver={(e) => handleDayDragOver(e, day)}
                    onDragLeave={() => handleDayDragLeave(day)}
                    onDrop={(e) => handleDayDrop(e, day)}
                    className={`min-h-[100px] cursor-pointer bg-white dark:bg-slate-800 p-1.5 transition-colors hover:bg-teal-50/50 ${
                      isToday ? 'ring-2 ring-inset ring-teal-500' : ''
                    } ${isSelected ? 'bg-teal-50' : ''} ${
                      isDropTarget ? 'bg-teal-100/70 ring-2 ring-inset ring-teal-400' : ''
                    }`}
                    style={dayContexts.length === 1 && primaryContext?.mesocycleColor
                      ? { borderTop: `2px solid ${primaryContext.mesocycleColor}` }
                      : dayContexts.length > 1
                        ? { borderTop: `2px solid transparent`, backgroundImage: `linear-gradient(white, white), linear-gradient(to right, ${dayContexts.map((c) => c.teamColor || c.mesocycleColor || '#94a3b8').join(', ')})`, backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box' }
                        : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                        isToday ? 'bg-teal-600 text-white' : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {day}
                      </span>
                      {primaryContext && primaryContext.isDeload && (
                        <span className="rounded px-1 py-0.5 text-2xs font-medium bg-amber-100 text-amber-700">{t('deload')}</span>
                      )}
                    </div>
                    <div className="mt-0.5 space-y-0.5">
                      {dayEvents.slice(0, 3).map((ev) => {
                        const cfg = eventTypeConfig[ev.type] || eventTypeConfig.other;
                        const isDragging = draggingId === ev.id;
                        const showTeamBadge = !selectedTeamId && ev.teamName;
                        return (
                          <button
                            key={ev.id}
                            draggable
                            onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, ev); }}
                            onDragEnd={handleDragEnd}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasAttendance(ev)) {
                                // Allenamento: si va dove si lavora, cioe' il foglio
                                const id = ev.isSession ? ev.sessionId! : ev.id;
                                router.push(
                                  `/dashboard/field-training/${id}${ev.isSession ? '?source=session' : ''}`,
                                );
                              } else {
                                setSelectedEvent(ev);
                              }
                            }}
                            title={hasAttendance(ev) ? t('clickToOpenSheet') : t('dragToReschedule')}
                            className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-2xs font-medium border cursor-grab active:cursor-grabbing ${cfg.bg} ${cfg.color} ${
                              isDragging ? 'opacity-40 scale-95' : ''
                            } transition-all`}
                          >
                            {ev.teamColor ? (
                              <span
                                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                                style={{ backgroundColor: ev.teamColor }}
                              />
                            ) : ev.isSession && ev.status ? (
                              <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${statusColors[ev.status] || 'bg-slate-400'}`} />
                            ) : null}
                            {showTeamBadge && (
                              <span
                                className="flex-shrink-0 rounded px-0.5 text-white"
                                style={{ backgroundColor: ev.teamColor || '#94a3b8', fontSize: '8px', lineHeight: '12px' }}
                              >
                                {ev.teamName!.replace(/^(Under|U)\s*/i, 'U').split(' ')[0]}
                              </span>
                            )}
                            <span className="truncate">{ev.title}</span>
                            {ev.aiModified && (
                              <span className="ml-auto flex-shrink-0 rounded px-0.5 text-white bg-violet-500" style={{ fontSize: '7px', lineHeight: '11px' }}>AI</span>
                            )}
                          </button>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <span className="block text-center text-2xs text-slate-400 dark:text-slate-500">+{dayEvents.length - 3} {t('more')}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Conferma cancellazione evento */}
        <ConfirmDialog
          open={!!deleteTarget}
          title={t('deleteEvent')}
          message={t('deleteEventConfirm', { name: deleteTarget?.title ?? '' })}
          detail={t('deleteEventDetail')}
          busy={deletingEvent}
          onConfirm={() => deleteTarget && deleteEvent(deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
        />

        {/* Conferma annullamento sessione pianificata */}
        <ConfirmDialog
          open={!!cancelTarget}
          title={t('cancelSession')}
          message={t('cancelSessionConfirm', { name: cancelTarget?.title ?? '' })}
          detail={t('cancelSessionDetail')}
          confirmLabel={t('cancelSession')}
          busy={cancellingSession}
          onConfirm={() => cancelTarget && setSessionStatus(cancelTarget, 'CANCELLED')}
          onClose={() => setCancelTarget(null)}
        />

        {/* Side Panel — Day Detail or Event Detail */}
        <div className="w-80 flex-shrink-0">
          {selectedEvent ? (
            <EventDetail
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
              onDelete={deleteEvent}
              onCancelSession={(ev) => setCancelTarget(ev)}
              onRestoreSession={(ev) => setSessionStatus(ev, 'PLANNED')}
              onRescheduleSession={rescheduleSession}
              onNavigateToSession={(sessionId) => router.push(`/dashboard/sessions/${sessionId}`)}
              onOpenFieldTimers={(id, fromPlan) =>
                router.push(`/dashboard/field-training/${id}${fromPlan ? '?source=session' : ''}`)
              }
              onOpenGameTracking={(eventId) => router.push(`/dashboard/game/${eventId}`)}
            />
          ) : selectedDay ? (
            <DayDetail
              date={selectedDay}
              events={eventsByDay.get(selectedDay.getDate()) || []}
              onSelectEvent={setSelectedEvent}
              onDeleteEvent={(ev) => setDeleteTarget(ev)}
              onCancelSession={(ev) => setCancelTarget(ev)}
              onRestoreSession={(ev) => setSessionStatus(ev, 'PLANNED')}
              onCreateEvent={() => setShowCreateModal(true)}
              onOpenFieldTimers={(id, fromPlan) =>
                router.push(`/dashboard/field-training/${id}${fromPlan ? '?source=session' : ''}`)
              }
              onOpenGameTracking={(eventId) => router.push(`/dashboard/game/${eventId}`)}
              periodizationContexts={periodizationByDay.get(selectedDay.getDate()) || []}
            />
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
              <p className="text-center text-sm text-slate-400 dark:text-slate-500">{t('selectDayDetail')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <CreateEventModal
          defaultDate={selectedDay || new Date()}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); fetchEvents(); toast('success', t('eventCreated')); }}
        />
      )}
    </div>
  );
}

// ─── Day Detail Panel ───────────────────────────────────

function DayDetail({
  date,
  events,
  onSelectEvent,
  onDeleteEvent,
  onCancelSession,
  onRestoreSession,
  onCreateEvent,
  onOpenFieldTimers,
  onOpenGameTracking,
  periodizationContexts,
}: {
  date: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
  onDeleteEvent: (e: CalendarEvent) => void;
  onCancelSession: (e: CalendarEvent) => void;
  onRestoreSession: (e: CalendarEvent) => void;
  onCreateEvent: () => void;
  onOpenFieldTimers?: (id: string, fromPlan?: boolean) => void;
  onOpenGameTracking?: (eventId: string) => void;
  periodizationContexts: WeekContext[];
}) {
  const t = useTranslations('calendar');
  const locale = useLocale();
  const eventTypeConfig = useEventTypeConfig(t);
  const PHASE_LABELS = useMemo(() => {
    const result: Record<string, string> = {};
    for (const [key, labelKey] of Object.entries(PHASE_LABEL_KEYS)) {
      result[key] = t(labelKey);
    }
    return result;
  }, [t]);
  const INTENSITY_LABELS = useMemo(() => {
    const result: Record<string, string> = {};
    for (const [key, labelKey] of Object.entries(INTENSITY_LABEL_KEYS)) {
      result[key] = t(labelKey);
    }
    return result;
  }, [t]);
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <div className="border-b border-slate-100 dark:border-slate-700 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          {date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('nEventsCount', { count: events.length })}</p>
      </div>

      {/* Periodization context(s) */}
      {periodizationContexts.map((pc, idx) => (
        <div
          key={`${pc.planId}-${pc.mesocycleId}-${idx}`}
          className="mx-3 mt-3 rounded-lg border px-3 py-2.5"
          style={{
            backgroundColor: pc.mesocycleColor ? `${pc.mesocycleColor}10` : '#f8fafc',
            borderColor: pc.mesocycleColor || '#e2e8f0',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            {pc.teamColor && (
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pc.teamColor }} />
            )}
            <Layers className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            <span className="text-xs font-semibold text-slate-700">
              {pc.teamName ? `${pc.teamName} · ` : ''}{pc.planName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: pc.mesocycleColor || '#94a3b8' }}
            />
            <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{pc.mesocycleName}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">· {PHASE_LABELS[pc.mesocyclePhase] || pc.mesocyclePhase}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-slate-500 dark:text-slate-400">
            <span>{t('weekAbbr')} {pc.microcycleWeekNumber}</span>
            <span>{t('load')}: {pc.loadPercent}%</span>
            <span>{t('intensity')}: {INTENSITY_LABELS[pc.intensity] || pc.intensity}</span>
            {pc.isDeload && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700">{t('deload')}</span>
            )}
          </div>
        </div>
      ))}
      <div className="max-h-[500px] overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8">
            <CalendarDays className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-400 dark:text-slate-500">{t('noEvents')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700 p-2">
            {events.map((ev) => {
              const cfg = eventTypeConfig[ev.type] || eventTypeConfig.other;
              return (
                <div key={ev.id} className="group relative flex items-start rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-700">
                {/* Gli eventi creati a mano si eliminano da qui: cliccando la
                    striscia nel calendario si va al foglio, e li' non c'e'
                    nessun posto sensato per un cestino. Le sessioni della
                    programmazione non si cancellano (regola SESSION_IN_PLAN):
                    si annullano, e l'annullamento si disfa. */}
                {!ev.isSession && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteEvent(ev); }}
                    title={t('deleteEvent')}
                    className="absolute right-2 top-2 z-10 rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {ev.isSession && ev.status === 'CANCELLED' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRestoreSession(ev); }}
                    title={t('restoreSession')}
                    className="absolute right-2 top-2 z-10 rounded p-1.5 text-slate-400 transition-colors hover:bg-teal-50 hover:text-teal-600"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                {ev.isSession && ev.status !== 'CANCELLED' && ev.status !== 'COMPLETED' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onCancelSession(ev); }}
                    title={t('cancelSession')}
                    className="absolute right-2 top-2 z-10 rounded p-1.5 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                  >
                    <Ban className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => onSelectEvent(ev)}
                  className="flex w-full items-start gap-3 rounded-lg p-3 text-left"
                >
                  <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
                    <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {ev.teamName && (
                        <span
                          className="inline-flex flex-shrink-0 items-center rounded px-1 py-0.5 text-2xs font-semibold text-white"
                          style={{ backgroundColor: ev.teamColor || '#94a3b8' }}
                        >
                          {ev.teamName.replace(/^(Under|U)\s*/i, 'U').split(' ')[0]}
                        </span>
                      )}
                      {hasAttendance(ev) && <StatusDotOnly status={trainingStatus(ev)} />}
                      <p className={`text-sm font-medium truncate ${
                        ev.status === 'CANCELLED'
                          ? 'text-slate-400 line-through dark:text-slate-500'
                          : 'text-slate-900 dark:text-white'
                      }`}>{ev.title}</p>
                      {ev.status === 'CANCELLED' && (
                        <span className="flex-shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-2xs font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                          {t('sessionStatusCancelled')}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {ev.allDay ? t('allDay') : `${formatTime(ev.startTime)} - ${formatTime(ev.endTime)}`}
                    </p>

                    {hasAttendance(ev) && onOpenFieldTimers && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenFieldTimers(ev.isSession ? ev.sessionId! : ev.id, Boolean(ev.isSession));
                        }}
                        className="mt-1 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-2xs font-medium text-orange-700 hover:bg-orange-200 transition-colors"
                      >
                        <ClipboardCheck className="h-3 w-3" />
                        {t('attendanceAndExercises')}
                      </button>
                    )}
                    {ev.type === 'match' && !ev.isSession && onOpenGameTracking && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpenGameTracking(ev.id); }}
                        className="mt-1 inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-2xs font-medium text-purple-700 hover:bg-purple-200 transition-colors"
                      >
                        <ClipboardList className="h-3 w-3" /> {t('gameMinutes')}
                      </button>
                    )}
                  </div>
                </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="border-t border-slate-100 dark:border-slate-700 p-3">
        <button
          onClick={onCreateEvent}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 transition-colors hover:border-teal-400 hover:text-teal-600"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('addEvent')}
        </button>
      </div>
    </div>
  );
}

// ─── Event Detail Panel ─────────────────────────────────

function EventDetail({
  event,
  onClose,
  onDelete,
  onCancelSession,
  onRestoreSession,
  onRescheduleSession,
  onNavigateToSession,
  onOpenFieldTimers,
  onOpenGameTracking,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onDelete: (id: string) => void;
  onCancelSession?: (e: CalendarEvent) => void;
  onRestoreSession?: (e: CalendarEvent) => void;
  onRescheduleSession?: (e: CalendarEvent, date: string) => void;
  onNavigateToSession?: (sessionId: string) => void;
  onOpenFieldTimers?: (id: string, fromPlan?: boolean) => void;
  onOpenGameTracking?: (eventId: string) => void;
}) {
  const t = useTranslations('calendar');
  const apiError = useApiError();
  const tInjuries = useTranslations('injuries');
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const eventTypeConfig = useEventTypeConfig(t);
  const cfg = eventTypeConfig[event.type] || eventTypeConfig.other;

  // ─── Rehab: protocollo RTP dell'atleta collegato ───────
  const [rtp, setRtp] = useState<RtpProtocolInfo | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [moveDate, setMoveDate] = useState('');

  useEffect(() => {
    if (event.type !== 'rehab' || !event.athleteId) {
      setRtp(null);
      return;
    }
    let cancelled = false;
    fetchActiveRtp().then((list) => {
      if (cancelled) return;
      setRtp(list.find((p) => p.athleteId === event.athleteId) || null);
    });
    return () => { cancelled = true; };
  }, [event.type, event.athleteId]);

  const phaseLabel = (phase: string) => {
    const idx = RTP_PHASE_ORDER.indexOf(phase);
    if (phase === 'CLEARED') return t('rtpCleared');
    return idx >= 0 ? tInjuries(`phase${idx + 1}Label`) : phase;
  };

  const nextPhase = rtp ? RTP_PHASE_ORDER[RTP_PHASE_ORDER.indexOf(rtp.phase) + 1] : undefined;

  const advancePhase = async () => {
    if (!rtp || !nextPhase) return;
    setAdvancing(true);
    try {
      await apiFetch(`/rtp/${rtp.protocolId}/advance`, {
        method: 'POST',
        body: JSON.stringify({ targetPhase: nextPhase }),
      });
      setRtp({ ...rtp, phase: nextPhase });
      toast('success', tInjuries('phaseAdvanced'));
    } catch (err) {
      // 422 quando i criteri della fase corrente non sono soddisfatti:
      // il messaggio dell'API dice quanti ne mancano.
      toast('error', apiError(err, tInjuries('advancePhase')));
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
          <cfg.icon className="h-3.5 w-3.5" />
          {cfg.label}
        </span>
        <button onClick={onClose} className="rounded-lg p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700 dark:bg-slate-700 hover:text-slate-600 dark:text-slate-400">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{event.title}</h3>
          {hasAttendance(event) && <TrainingStatusBadge status={trainingStatus(event)} />}
        </div>

        {event.type === 'match' && (event.opponent || event.venue || event.isHome != null) && (
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-900/20">
            {event.opponent && (
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {event.isHome === false
                  ? `${event.opponent} vs ${event.teamName ?? ''}`.trim()
                  : `${event.teamName ?? ''} vs ${event.opponent}`.trim()}
              </p>
            )}
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              {event.isHome != null && (event.isHome ? t('gtHome') : t('gtAway'))}
              {event.isHome != null && event.venue ? ' · ' : ''}
              {event.venue}
            </p>
          </div>
        )}

        {event.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400">{event.description}</p>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Clock className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            {event.allDay ? (
              <span>{t('allDay')}</span>
            ) : (
              <span>{formatTime(event.startTime)} — {formatTime(event.endTime)}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <CalendarDays className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <span>{new Date(event.startTime).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
        </div>

        {event.isSession && event.status && (
          <div className={`rounded-lg border p-3 ${
            event.status === 'COMPLETED' ? 'border-green-200 bg-green-50' :
            event.status === 'IN_PROGRESS' ? 'border-teal-200 bg-teal-50' :
            event.status === 'CANCELLED' ? 'border-slate-200 bg-slate-50' :
            'border-blue-200 bg-blue-50'
          }`}>
            <p className="text-xs font-medium text-slate-700">{t('trainingSession')}</p>
            <p className={`mt-0.5 text-sm font-semibold ${
              event.status === 'COMPLETED' ? 'text-green-700' :
              event.status === 'IN_PROGRESS' ? 'text-teal-700' :
              event.status === 'CANCELLED' ? 'text-slate-500' : 'text-blue-700'
            }`}>
              {event.status === 'COMPLETED' ? t('sessionStatusCompleted')
                : event.status === 'IN_PROGRESS' ? t('sessionStatusInProgress')
                : event.status === 'CANCELLED' ? t('sessionStatusCancelled')
                : t('sessionStatusPlanned')}
            </p>
            {event.status === 'CANCELLED' && (
              <p className="mt-1 text-2xs text-slate-500">{t('sessionCancelledHint')}</p>
            )}
          </div>
        )}

        {/* Allenamenti e sessioni di piano → foglio presenze, RPE e carico.
            Sul basket il foglio contiene anche la tabella esercizi. */}
        {hasAttendance(event) && onOpenFieldTimers && (
          <button
            onClick={() =>
              onOpenFieldTimers(event.isSession ? event.sessionId! : event.id, Boolean(event.isSession))
            }
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-orange-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-700"
          >
            <ClipboardCheck className="h-4 w-4" />
            {t('attendanceAndExercises')}
          </button>
        )}

        {/* Rehab → protocollo Return To Play */}
        {event.type === 'rehab' && !event.isSession && rtp && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs font-medium text-rose-700">{t('rtpProtocol')}</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{rtp.athleteName}</p>
            <p className="mt-0.5 text-xs text-slate-600">{phaseLabel(rtp.phase)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {nextPhase && (
                <button
                  onClick={advancePhase}
                  disabled={advancing}
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {tInjuries('advancePhase')}
                </button>
              )}
              <button
                onClick={() => router.push('/dashboard/injuries')}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
              >
                <ExternalLink className="h-3 w-3" />
                {t('openInjuryCard')}
              </button>
            </div>
          </div>
        )}

        {/* Match → Game tracking button */}
        {event.type === 'match' && !event.isSession && onOpenGameTracking && (
          <button
            onClick={() => onOpenGameTracking(event.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700"
          >
            <ClipboardList className="h-4 w-4" />
            {t('gameMinutes')}
          </button>
        )}

        {event.isSession && event.sessionId && onNavigateToSession && (
          <button
            onClick={() => onNavigateToSession(event.sessionId!)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t('goToSession')}
          </button>
        )}

        {!event.isSession && (
          <button
            onClick={() => onDelete(event.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('deleteEvent')}
          </button>
        )}

        {/* Sessione della programmazione: non si elimina (buchereebbe il
            mesociclo), si sposta o si annulla. Entrambe reversibili. */}
        {event.isSession && event.sessionId && event.status !== 'COMPLETED' && (
          <div className="space-y-2 border-t border-slate-100 dark:border-slate-700 pt-3">
            {onRescheduleSession && (
              showMove ? (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={moveDate}
                    onChange={(e) => setMoveDate(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200"
                  />
                  <button
                    onClick={() => onRescheduleSession(event, moveDate)}
                    disabled={!moveDate}
                    className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                  >
                    {t('moveSessionConfirm')}
                  </button>
                  <button
                    onClick={() => setShowMove(false)}
                    className="rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    {t('cancelAction')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    const d = new Date(event.startTime);
                    setMoveDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                    setShowMove(true);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  {t('moveSession')}
                </button>
              )
            )}
            {event.status === 'CANCELLED'
              ? onRestoreSession && (
                  <button
                    onClick={() => onRestoreSession(event)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-teal-200 py-2 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {t('restoreSession')}
                  </button>
                )
              : onCancelSession && (
                  <button
                    onClick={() => onCancelSession(event)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-200 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    {t('cancelSession')}
                  </button>
                )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create Event Modal ─────────────────────────────────

function CreateEventModal({
  defaultDate,
  onClose,
  onCreated,
}: {
  defaultDate: Date;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations('calendar');
  const { toast } = useToast();
  const { teams, selectedTeamId } = useTeam();
  const eventTypeConfig = useEventTypeConfig(t);
  const dateStr = `${defaultDate.getFullYear()}-${String(defaultDate.getMonth() + 1).padStart(2, '0')}-${String(defaultDate.getDate()).padStart(2, '0')}`;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('other');
  const [teamId, setTeamId] = useState(selectedTeamId || '');
  const [athleteId, setAthleteId] = useState('');
  const [rtpList, setRtpList] = useState<RtpProtocolInfo[]>([]);
  const [startDate, setStartDate] = useState(dateStr);
  const [startTimeVal, setStartTimeVal] = useState('09:00');
  const [endTimeVal, setEndTimeVal] = useState('10:00');
  const [allDay, setAllDay] = useState(false);
  const [saving, setSaving] = useState(false);
  // Partita: avversario, campo, e casa/trasferta a tre stati ('' = non detto).
  const [opponent, setOpponent] = useState('');
  const [venue, setVenue] = useState('');
  const [homeAway, setHomeAway] = useState<'' | 'home' | 'away'>('');

  // Gli eventi Rehab si agganciano a un atleta con protocollo RTP attivo
  useEffect(() => {
    if (type !== 'rehab' || rtpList.length > 0) return;
    let cancelled = false;
    fetchActiveRtp().then((list) => { if (!cancelled) setRtpList(list); });
    return () => { cancelled = true; };
  }, [type, rtpList.length]);

  // Gli stessi quattro tipi dell'API (notifications.ts): allenamenti di gruppo
  // e partite hanno per definizione una squadra. Se il controllo restasse solo
  // sul server l'utente vedrebbe un errore generico dopo aver compilato tutto.
  const squadraObbligatoria = ['gym', 'basket', 'shooting', 'match'].includes(type);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    if (squadraObbligatoria && !teamId) {
      toast('error', t('teamRequired'));
      return;
    }
    setSaving(true);
    try {
      const startTime = allDay ? `${startDate}T00:00:00` : `${startDate}T${startTimeVal}:00`;
      const endTime = allDay ? `${startDate}T23:59:59` : `${startDate}T${endTimeVal}:00`;
      await apiFetch('/calendar/events', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          type,
          startTime,
          endTime,
          allDay,
          teamId: teamId || undefined,
          athleteId: type === 'rehab' && athleteId ? athleteId : undefined,
          ...(type === 'match' ? {
            opponent: opponent.trim() || null,
            venue: venue.trim() || null,
            isHome: homeAway === '' ? null : homeAway === 'home',
          } : {}),
        }),
      });
      onCreated();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('newEvent')}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700 dark:bg-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t('titleLabel')}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('titlePlaceholder')}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t('descriptionOptional')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('typeLabel')}</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              >
                {CREATABLE_TYPES.map((k) => (
                  <option key={k} value={k}>{eventTypeConfig[k]?.label || k}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t('teamLabel')}{squadraObbligatoria && ' *'}
              </label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              >
                {/* Sui tipi collettivi "nessuna squadra" non e' una scelta
                    valida: meglio non offrirla che rifiutarla dopo. */}
                <option value="" disabled={squadraObbligatoria}>
                  {squadraObbligatoria ? t('selectTeam') : t('noTeam')}
                </option>
                {teams.map((tm) => (
                  <option key={tm.id} value={tm.id}>{tm.name}</option>
                ))}
              </select>
            </div>
          </div>

          {type === 'rehab' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('injuredAthlete')}</label>
              <select
                value={athleteId}
                onChange={(e) => setAthleteId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              >
                <option value="">{t('noAthlete')}</option>
                {rtpList.map((p) => (
                  <option key={p.athleteId} value={p.athleteId}>{p.athleteName}</option>
                ))}
              </select>
              {rtpList.length === 0 && (
                <p className="mt-1 text-2xs text-slate-400">{t('noActiveRtp')}</p>
              )}
            </div>
          )}

          {/* Dettagli partita: compaiono solo sul tipo 'match'. */}
          {type === 'match' && (
            <div className="space-y-3 rounded-lg border border-purple-200 bg-purple-50/50 p-3 dark:border-purple-800 dark:bg-purple-900/20">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('opponentLabel')}</label>
                <input
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  placeholder={t('opponentPlaceholder')}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('homeAwayLabel')}</label>
                  <select
                    value={homeAway}
                    onChange={(e) => setHomeAway(e.target.value as '' | 'home' | 'away')}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                  >
                    <option value="">{t('homeAwayUnset')}</option>
                    <option value="home">{t('home')}</option>
                    <option value="away">{t('away')}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('venueLabel')}</label>
                  <input
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder={t('venuePlaceholder')}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{t('dateLabel')}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500"
              />
              {t('allDay')}
            </label>
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('startTimeLabel')}</label>
                <input
                  type="time"
                  value={startTimeVal}
                  onChange={(e) => setStartTimeVal(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('endTimeLabel')}</label>
                <input
                  type="time"
                  value={endTimeVal}
                  onChange={(e) => setEndTimeVal(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-700 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700 dark:bg-slate-700"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
          >
            {saving && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
            {t('createEventBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
