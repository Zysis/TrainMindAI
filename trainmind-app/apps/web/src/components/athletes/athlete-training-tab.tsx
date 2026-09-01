'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  Calendar, CalendarClock, ChevronDown, ChevronRight, Dumbbell, Sparkles, Users, User,
} from 'lucide-react';
import { apiFetch } from '@/lib/auth/fetch';
import { useApiError } from '@/lib/i18n/api-error';
import { Badge } from '@/components/ui/badge';
import { WeekdayPicker } from '@/components/ui/weekday-picker';

// ─── Tipi ────────────────────────────────────────────────────

interface PlanSession {
  id: string;
  title: string;
  date: string | null;
  duration: number | null;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  rpe: number | null;
  exerciseCount: number;
}

interface PlanWeek {
  id: string;
  weekNumber: number;
  sessions: PlanSession[];
}

interface Plan {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  aiGenerated: boolean;
  trainingDays: number[];
  source: 'individual' | 'team';
  teamName: string | null;
  weeks: PlanWeek[];
}

interface DoneSession {
  id: string;
  title: string;
  date: string | null;
  duration: number | null;
  rpe: number | null;
  load: number | null;
  fromAttendance: boolean;
}

interface CalendarEventRow {
  id: string;
  title: string;
  type: string;
  startTime: string;
  endTime: string;
  teamName: string | null;
  personal: boolean;
  sheetId: string | null;
  sheetStatus: string | null;
}

interface Summary {
  plansCount: number;
  eventsCount: number;
  plannedSessions: number;
  completedSessions: number;
  sheetsClosed: number;
  present: number;
  attendanceRate: number | null;
  totalLoad: number;
  avgRpe: number | null;
}

interface Payload {
  plans: Plan[];
  events: CalendarEventRow[];
  completed: DoneSession[];
  summary: Summary;
}

// ─── Componente ──────────────────────────────────────────────

export function AthleteTrainingTab({ athleteId }: { athleteId: string }) {
  const t = useTranslations('athletes');
  const locale = useLocale();
  const apiError = useApiError();

  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openPlans, setOpenPlans] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: Payload }>(`/athletes/${athleteId}/training`);
      setData(res.data);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
    // apiError cambia a ogni render: escluso di proposito, altrimenti il
    // caricamento si ripete all'infinito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId]);

  useEffect(() => { load(); }, [load]);

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const fmtShort = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

  const toggle = (id: string) =>
    setOpenPlans((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  if (loading) {
    return (
      <div className="card flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <div className="card py-10 text-center text-sm text-red-600">{error}</div>;
  }

  if (!data || (data.plans.length === 0 && data.completed.length === 0 && data.events.length === 0)) {
    return (
      <div className="card flex h-48 items-center justify-center">
        <div className="text-center">
          <Calendar className="mx-auto mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400 dark:text-slate-500">{t('noTrainingData')}</p>
        </div>
      </div>
    );
  }

  const s = data.summary;
  const statusTone: Record<string, string> = {
    COMPLETED: 'text-green-600 dark:text-green-400',
    IN_PROGRESS: 'text-teal-600 dark:text-teal-400',
    CANCELLED: 'text-red-500',
    PLANNED: 'text-slate-400 dark:text-slate-500',
  };

  return (
    <div className="space-y-5">
      {/* Riepilogo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card py-3">
          <p className="text-2xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('sumPlanned')}</p>
          <p className="mt-0.5 text-xl font-bold text-slate-900 dark:text-white">{s.plannedSessions}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{t('sumPlansCount', { n: s.plansCount })}</p>
        </div>
        <div className="card py-3">
          <p className="text-2xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('sumCompleted')}</p>
          <p className="mt-0.5 text-xl font-bold text-slate-900 dark:text-white">{s.completedSessions}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{t('sumAvgRpe', { v: s.avgRpe ?? '—' })}</p>
        </div>
        <div className="card py-3">
          <p className="text-2xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('sumAttendance')}</p>
          <p className="mt-0.5 text-xl font-bold text-slate-900 dark:text-white">
            {s.attendanceRate != null ? `${s.attendanceRate}%` : '—'}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {t('sumPresentOn', { present: s.present, total: s.sheetsClosed })}
          </p>
        </div>
        <div className="card py-3">
          <p className="text-2xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('sumLoad')}</p>
          <p className="mt-0.5 text-xl font-bold text-teal-700 dark:text-teal-300">
            {s.totalLoad > 0 ? s.totalLoad.toLocaleString(locale) : '—'}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{t('sumLoadHint')}</p>
        </div>
      </div>

      {/* Programmato */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
          {t('plannedSection')}
        </h3>
        {data.plans.length === 0 ? (
          <p className="card py-6 text-center text-sm text-slate-400 dark:text-slate-500">{t('noPlans')}</p>
        ) : (
          <div className="space-y-2">
            {data.plans.map((plan) => {
              const open = openPlans.has(plan.id);
              const total = plan.weeks.reduce((n, w) => n + w.sessions.length, 0);
              const done = plan.weeks.reduce(
                (n, w) => n + w.sessions.filter((x) => x.status === 'COMPLETED').length, 0);
              return (
                <div key={plan.id} className="card p-0 overflow-hidden">
                  <button
                    onClick={() => toggle(plan.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    {open ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400" />
                          : <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/training/${plan.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-slate-900 dark:text-white hover:text-teal-700"
                        >
                          {plan.name}
                        </Link>
                        <Badge variant={plan.source === 'team' ? 'info' : 'default'}
                               className="inline-flex items-center gap-1">
                          {plan.source === 'team' ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
                          {plan.source === 'team' ? (plan.teamName ?? t('sourceTeam')) : t('sourceIndividual')}
                        </Badge>
                        {plan.aiGenerated && (
                          <Badge variant="teal" className="inline-flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            {t('aiGenerated')}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {fmtDate(plan.startDate)} → {fmtDate(plan.endDate)} · {t('nSessionsDone', { done, total })}
                      </p>
                    </div>
                    {plan.trainingDays?.length > 0 && (
                      <WeekdayPicker value={plan.trainingDays} readOnly />
                    )}
                  </button>

                  {open && (
                    <div className="border-t border-slate-100 dark:border-slate-700">
                      {total === 0 ? (
                        <p className="px-4 py-5 text-center text-xs text-slate-400 dark:text-slate-500">
                          {t('planEmpty')}
                        </p>
                      ) : (
                        plan.weeks.filter((w) => w.sessions.length > 0).map((w) => (
                          <div key={w.id} className="border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                            <p className="bg-slate-50 dark:bg-slate-900 px-4 py-1.5 text-2xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              {t('weekN', { n: w.weekNumber })}
                            </p>
                            {w.sessions.map((x) => (
                              <Link
                                key={x.id}
                                href={`/dashboard/sessions/${x.id}`}
                                className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                              >
                                <Dumbbell className={`h-4 w-4 flex-shrink-0 ${statusTone[x.status]}`} />
                                <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-300">
                                  {x.title}
                                </span>
                                <span className="flex-shrink-0 text-xs text-slate-400 dark:text-slate-500">
                                  {t('nExercises', { n: x.exerciseCount })}
                                </span>
                                <span className="w-20 flex-shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">
                                  {fmtShort(x.date)}
                                </span>
                              </Link>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Eventi creati dal Calendario */}
      {data.events.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
            {t('eventsSection')} ({data.events.length})
          </h3>
          <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">{t('eventsHint')}</p>
          <div className="card p-0 divide-y divide-slate-100 dark:divide-slate-700">
            {data.events.map((e) => {
              const done = e.sheetStatus === 'COMPLETED';
              const row = (
                <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                  <CalendarClock className={`h-4 w-4 flex-shrink-0 ${done ? 'text-green-600' : 'text-slate-400'}`} />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-300">
                    {e.title}
                  </span>
                  <Badge variant="outline">{t('eventCreated')}</Badge>
                  {e.personal
                    ? <Badge variant="default">{t('eventPersonal')}</Badge>
                    : e.teamName && <Badge variant="info">{e.teamName}</Badge>}
                  {e.sheetStatus && (
                    <Badge variant={done ? 'success' : 'info'}>
                      {done ? t('eventDone') : t('eventPlanned')}
                    </Badge>
                  )}
                  <span className="w-24 flex-shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">
                    {fmtShort(e.startTime)}
                  </span>
                </div>
              );
              // Con un foglio presenze si va al foglio, altrimenti al calendario.
              return e.sheetId ? (
                <Link key={e.id} href={`/dashboard/field-training/${e.id}`}
                      className="block hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  {row}
                </Link>
              ) : (
                <div key={e.id}>{row}</div>
              );
            })}
          </div>
        </div>
      )}

      {/* Svolto */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
          {t('doneSection')}
        </h3>
        <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">{t('doneHint')}</p>
        {data.completed.length === 0 ? (
          <p className="card py-6 text-center text-sm text-slate-400 dark:text-slate-500">{t('noDone')}</p>
        ) : (
          <div className="card p-0 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('colDate')}</th>
                  <th className="px-4 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('colSession')}</th>
                  <th className="px-4 py-2 text-right text-2xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('colDuration')}</th>
                  <th className="px-4 py-2 text-right text-2xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('colRpe')}</th>
                  <th className="px-4 py-2 text-right text-2xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('colLoad')}</th>
                </tr>
              </thead>
              <tbody>
                {data.completed.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 dark:border-slate-700/60">
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500 dark:text-slate-400">{fmtShort(c.date)}</td>
                    <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300">{c.title}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-sm tabular-nums text-slate-600 dark:text-slate-300">
                      {c.duration != null ? `${c.duration}'` : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-sm tabular-nums text-slate-600 dark:text-slate-300">
                      {c.rpe ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-sm font-semibold tabular-nums text-teal-700 dark:text-teal-300">
                      {c.load != null ? c.load.toLocaleString(locale) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
