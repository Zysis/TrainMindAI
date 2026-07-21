'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Clock,
  Dumbbell,
  Swords,
  Stethoscope,
  Users,
  CalendarDays,
  Trash2,
  CircleDot,
  ExternalLink,
  Layers,
  Timer,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { apiFetch } from '@/lib/auth/fetch';
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
  status?: string;
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
  training: { labelKey: 'training', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200', icon: Dumbbell },
  field_training: { labelKey: 'fieldTraining', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: CircleDot },
  match: { labelKey: 'match', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: Swords },
  medical: { labelKey: 'medical', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: Stethoscope },
  meeting: { labelKey: 'meeting', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Users },
  other: { labelKey: 'other', color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-50 border-slate-200 dark:border-slate-700', icon: CalendarDays },
};

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
    try {
      await apiFetch(`/calendar/events/${id}`, { method: 'DELETE' });
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setSelectedEvent(null);
      toast('success', t('eventDeleted'));
    } catch {
      toast('error', t('eventDeleteError'));
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
                              if (ev.isSession && ev.sessionId) {
                                router.push(`/dashboard/sessions/${ev.sessionId}`);
                              } else {
                                setSelectedEvent(ev);
                              }
                            }}
                            title={ev.isSession ? t('clickToOpenSession') : t('dragToReschedule')}
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

        {/* Side Panel — Day Detail or Event Detail */}
        <div className="w-80 flex-shrink-0">
          {selectedEvent ? (
            <EventDetail
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
              onDelete={deleteEvent}
              onNavigateToSession={(sessionId) => router.push(`/dashboard/sessions/${sessionId}`)}
              onOpenFieldTimers={(eventId) => router.push(`/dashboard/field-training/${eventId}`)}
              onOpenGameTracking={(eventId) => router.push(`/dashboard/game/${eventId}`)}
            />
          ) : selectedDay ? (
            <DayDetail
              date={selectedDay}
              events={eventsByDay.get(selectedDay.getDate()) || []}
              onSelectEvent={setSelectedEvent}
              onCreateEvent={() => setShowCreateModal(true)}
              onNavigateToSession={(sessionId) => router.push(`/dashboard/sessions/${sessionId}`)}
              onOpenFieldTimers={(eventId) => router.push(`/dashboard/field-training/${eventId}`)}
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
  onCreateEvent,
  onNavigateToSession,
  onOpenFieldTimers,
  onOpenGameTracking,
  periodizationContexts,
}: {
  date: Date;
  events: CalendarEvent[];
  onSelectEvent: (e: CalendarEvent) => void;
  onCreateEvent: () => void;
  onNavigateToSession?: (sessionId: string) => void;
  onOpenFieldTimers?: (eventId: string) => void;
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
                <button
                  key={ev.id}
                  onClick={() => {
                    if (ev.isSession && ev.sessionId && onNavigateToSession) {
                      onNavigateToSession(ev.sessionId);
                    } else {
                      onSelectEvent(ev);
                    }
                  }}
                  className="flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700 dark:bg-slate-900"
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
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{ev.title}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {ev.allDay ? t('allDay') : `${formatTime(ev.startTime)} - ${formatTime(ev.endTime)}`}
                    </p>
                    {ev.isSession && ev.status && (
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium ${
                          ev.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                          ev.status === 'IN_PROGRESS' ? 'bg-teal-100 text-teal-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusColors[ev.status]}`} />
                          {ev.status === 'COMPLETED' ? t('statusCompleted') : ev.status === 'IN_PROGRESS' ? t('statusInProgress') : t('statusPlanned')}
                        </span>
                        <span className="text-2xs text-teal-500 flex items-center gap-0.5">
                          <ExternalLink className="h-3 w-3" /> {t('open')}
                        </span>
                      </div>
                    )}
                    {ev.type === 'field_training' && !ev.isSession && onOpenFieldTimers && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpenFieldTimers(ev.id); }}
                        className="mt-1 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-2xs font-medium text-orange-700 hover:bg-orange-200 transition-colors"
                      >
                        <Timer className="h-3 w-3" /> {t('timers')}
                      </button>
                    )}
                    {ev.type === 'match' && !ev.isSession && onOpenGameTracking && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpenGameTracking(ev.id); }}
                        className="mt-1 inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-2xs font-medium text-purple-700 hover:bg-purple-200 transition-colors"
                      >
                        <Timer className="h-3 w-3" /> {t('gameMinutes')}
                      </button>
                    )}
                  </div>
                </button>
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
  onNavigateToSession,
  onOpenFieldTimers,
  onOpenGameTracking,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onDelete: (id: string) => void;
  onNavigateToSession?: (sessionId: string) => void;
  onOpenFieldTimers?: (eventId: string) => void;
  onOpenGameTracking?: (eventId: string) => void;
}) {
  const t = useTranslations('calendar');
  const locale = useLocale();
  const eventTypeConfig = useEventTypeConfig(t);
  const cfg = eventTypeConfig[event.type] || eventTypeConfig.other;

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
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{event.title}</h3>

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
            'border-blue-200 bg-blue-50'
          }`}>
            <p className="text-xs font-medium text-slate-700">{t('trainingSession')}</p>
            <p className={`mt-0.5 text-sm font-semibold ${
              event.status === 'COMPLETED' ? 'text-green-700' :
              event.status === 'IN_PROGRESS' ? 'text-teal-700' : 'text-blue-700'
            }`}>
              {event.status === 'COMPLETED' ? t('sessionStatusCompleted') : event.status === 'IN_PROGRESS' ? t('sessionStatusInProgress') : t('sessionStatusPlanned')}
            </p>
          </div>
        )}

        {/* Field training → Cronometri button */}
        {event.type === 'field_training' && !event.isSession && onOpenFieldTimers && (
          <button
            onClick={() => onOpenFieldTimers(event.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-orange-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-700"
          >
            <Timer className="h-4 w-4" />
            {t('trainingTimers')}
          </button>
        )}

        {/* Match → Game tracking button */}
        {event.type === 'match' && !event.isSession && onOpenGameTracking && (
          <button
            onClick={() => onOpenGameTracking(event.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700"
          >
            <Timer className="h-4 w-4" />
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
  const { teams, selectedTeamId } = useTeam();
  const eventTypeConfig = useEventTypeConfig(t);
  const dateStr = `${defaultDate.getFullYear()}-${String(defaultDate.getMonth() + 1).padStart(2, '0')}-${String(defaultDate.getDate()).padStart(2, '0')}`;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('other');
  const [teamId, setTeamId] = useState(selectedTeamId || '');
  const [startDate, setStartDate] = useState(dateStr);
  const [startTimeVal, setStartTimeVal] = useState('09:00');
  const [endTimeVal, setEndTimeVal] = useState('10:00');
  const [allDay, setAllDay] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
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
                {Object.entries(eventTypeConfig).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">{t('teamLabel')}</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              >
                <option value="">{t('noTeam')}</option>
                {teams.map((tm) => (
                  <option key={tm.id} value={tm.id}>{tm.name}</option>
                ))}
              </select>
            </div>
          </div>

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
