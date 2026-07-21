'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Calendar, Clock, Users, Plus, ChevronDown, ChevronRight,
  Dumbbell, Trash2, CheckCircle2, Circle, PlayCircle, XCircle, Layers, Upload, Loader2, Search, Sparkles,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { apiFetch } from '@/lib/auth/fetch';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';

interface TrainingSession {
  id: string;
  title: string;
  date: string;
  duration: number | null;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  rpe: number | null;
  notes: string | null;
  aiModified: boolean;
  athlete: { id: string; firstName: string; lastName: string } | null;
  _count: { sessionExercises: number };
}

interface MicrocycleInfo {
  id: string;
  weekNumber: number;
  loadPercent: number;
  intensity: string;
  sessionsCount: number;
  focusAreas: string[];
  isDeload: boolean;
  mesocycle: { name: string; phase: string };
}

interface Week {
  id: string;
  weekNumber: number;
  notes: string | null;
  microcycle: MicrocycleInfo | null;
  trainingSessions: TrainingSession[];
}

interface Plan {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  athlete: { id: string; firstName: string; lastName: string; position: string; photoUrl: string | null } | null;
  createdBy: { id: string; firstName: string; lastName: string };
  periodizationPlan: { id: string; name: string; type: string } | null;
  weeks: Week[];
}

interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
}

const STATUS_CONFIG_DEFS: Record<string, { labelKey: string; variant: 'default' | 'teal' | 'success' | 'danger'; icon: typeof Circle }> = {
  PLANNED: { labelKey: 'statusPlanned', variant: 'default', icon: Circle },
  IN_PROGRESS: { labelKey: 'statusInProgress', variant: 'teal', icon: PlayCircle },
  COMPLETED: { labelKey: 'statusCompleted', variant: 'success', icon: CheckCircle2 },
  CANCELLED: { labelKey: 'cancelled', variant: 'danger', icon: XCircle },
};

function formatDate(date: string, locale: string) {
  return new Date(date).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function TrainingPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('training');
  const tCommon = useTranslations('common');
  const tExercises = useTranslations('exercises');
  const locale = useLocale();
  const planId = params.id as string;
  const statusConfig = useMemo(
    () => Object.fromEntries(
      Object.entries(STATUS_CONFIG_DEFS).map(([k, v]) => [k, { ...v, label: t(v.labelKey) }])
    ) as Record<string, { label: string; variant: 'default' | 'teal' | 'success' | 'danger'; icon: typeof Circle }>,
    [t]
  );

  const [plan, setPlan] = useState<Plan | null>(null);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [showAddSession, setShowAddSession] = useState<string | null>(null); // weekId
  const [creating, setCreating] = useState(false);

  // Add session state (unified modal: create or import from library)
  const [addSessionTab, setAddSessionTab] = useState<'import' | 'create'>('import');
  const [templates, setTemplates] = useState<Array<{
    id: string; title: string; duration: number; notes: string | null;
    _count: { sessionExercises: number };
    sessionExercises: Array<{ exercise: { name: string; category: string } }>;
  }>>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [importingTemplate, setImportingTemplate] = useState(false);

  const openAddSession = async (weekId: string) => {
    setShowAddSession(weekId);
    setAddSessionTab('import');
    setTemplateSearch('');
    setLoadingTemplates(true);
    try {
      const res = await apiFetch<{ success: boolean; data: typeof templates }>('/training/sessions?templates=1&limit=100');
      setTemplates(res.data || []);
    } catch {
      toast('error', t('loadSessionsError'));
    } finally {
      setLoadingTemplates(false);
    }
  };

  const importTemplate = async (templateId: string) => {
    if (!showAddSession) return;
    setImportingTemplate(true);
    try {
      await apiFetch(`/training/session-templates/${templateId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekId: showAddSession,
          date: sessionForm.date,
        }),
      });
      toast('success', t('sessionImported'));
      setShowAddSession(null);
      loadPlan();
    } catch {
      toast('error', t('sessionImportError'));
    } finally {
      setImportingTemplate(false);
    }
  };

  const filteredTemplates = templates.filter((t) =>
    t.title.toLowerCase().includes(templateSearch.toLowerCase()),
  );

  const [sessionForm, setSessionForm] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    duration: '75',
    notes: '',
    athleteId: '',
  });

  const loadPlan = async () => {
    try {
      const res = await apiFetch<{ success: boolean; data: Plan }>(`/training/plans/${planId}`);
      setPlan(res.data);
      // Auto-expand first 2 weeks
      const firstWeeks = res.data.weeks.slice(0, 2).map((w) => w.id);
      setExpandedWeeks(new Set(firstWeeks));
    } catch {
      toast('error', t('planNotFound'));
      router.push('/dashboard/training');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlan();
    apiFetch<{ data: Athlete[] }>('/athletes?limit=100').then((r) => setAthletes(r.data)).catch(() => {});
  }, [planId]);

  const toggleWeek = (weekId: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekId)) next.delete(weekId);
      else next.add(weekId);
      return next;
    });
  };

  const handleCreateSession = async () => {
    if (!sessionForm.title || !sessionForm.date || !showAddSession) return;
    setCreating(true);
    try {
      await apiFetch(`/training/weeks/${showAddSession}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: sessionForm.title,
          date: sessionForm.date,
          duration: parseInt(sessionForm.duration) || undefined,
          notes: sessionForm.notes || undefined,
          athleteId: sessionForm.athleteId || undefined,
        }),
      });
      toast('success', t('sessionCreated'));
      setShowAddSession(null);
      setSessionForm({ title: '', date: new Date().toISOString().split('T')[0], duration: '75', notes: '', athleteId: '' });
      loadPlan();
    } catch {
      toast('error', t('sessionCreateError'));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await apiFetch(`/training/sessions/${sessionId}`, { method: 'DELETE' });
      toast('success', t('sessionDeleted'));
      loadPlan();
    } catch {
      toast('error', t('sessionDeleteError'));
    }
  };

  const handleUpdateStatus = async (sessionId: string, status: string) => {
    try {
      await apiFetch(`/training/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      loadPlan();
    } catch {
      toast('error', t('statusUpdateError'));
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (!plan) return null;

  const totalSessions = plan.weeks.reduce((sum, w) => sum + w.trainingSessions.length, 0);
  const completedSessions = plan.weeks.reduce(
    (sum, w) => sum + w.trainingSessions.filter((s) => s.status === 'COMPLETED').length,
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/training"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-teal-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToPlans')}
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{plan.name}</h1>
            {plan.description && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{plan.description}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(plan.startDate, locale)} — {formatDate(plan.endDate, locale)}
              </span>
              <span className="flex items-center gap-1">
                <Dumbbell className="h-3.5 w-3.5" />
                {completedSessions}/{totalSessions} {t('sessionsCompleted')}
              </span>
              {plan.athlete && (
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {plan.athlete.firstName} {plan.athlete.lastName} ({plan.athlete.position})
                </span>
              )}
              {plan.periodizationPlan && (
                <Link
                  href="/dashboard/periodization"
                  className="flex items-center gap-1 text-teal-600 hover:text-teal-700 hover:underline"
                >
                  <Layers className="h-3.5 w-3.5" />
                  {t('fromLabel')} {plan.periodizationPlan.name}
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {totalSessions > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{t('progress')}</span>
              <span>{Math.round((completedSessions / totalSessions) * 100)}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-teal-600 transition-all"
                style={{ width: `${(completedSessions / totalSessions) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Weeks accordion */}
      <div className="space-y-3">
        {plan.weeks.map((week) => {
          const isExpanded = expandedWeeks.has(week.id);
          const weekCompleted = week.trainingSessions.filter((s) => s.status === 'COMPLETED').length;

          return (
            <div key={week.id} className="card overflow-hidden !p-0">
              {/* Week header */}
              <button
                onClick={() => toggleWeek(week.id)}
                className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  )}
                  <div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{t('week')} {week.weekNumber}</span>
                    {week.microcycle && (
                      <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-xs font-medium text-teal-700">
                        {week.microcycle.mesocycle.name} · {week.microcycle.loadPercent}%
                        {week.microcycle.isDeload && <span className="text-indigo-600">({t('deload')})</span>}
                      </span>
                    )}
                    {!week.microcycle && week.notes && (
                      <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">— {week.notes}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {weekCompleted}/{week.trainingSessions.length} {t('completed')}
                  </span>
                  {week.trainingSessions.length > 0 && (
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-teal-500"
                        style={{
                          width: `${week.trainingSessions.length > 0 ? (weekCompleted / week.trainingSessions.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </button>

              {/* Sessions list */}
              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-700">
                  {week.trainingSessions.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                      Nessuna sessione in questa settimana
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50 dark:divide-slate-700">
                      {week.trainingSessions.map((session) => {
                        const sc = statusConfig[session.status];
                        const StatusIcon = sc.icon;
                        return (
                          <div key={session.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900/50 dark:hover:bg-slate-700/50">
                            <StatusIcon className={`h-5 w-5 flex-shrink-0 ${
                              session.status === 'COMPLETED' ? 'text-green-500' :
                              session.status === 'IN_PROGRESS' ? 'text-teal-500' :
                              session.status === 'CANCELLED' ? 'text-red-400' :
                              'text-slate-300'
                            }`} />

                            <Link
                              href={`/dashboard/sessions/${session.id}`}
                              className="flex-1 hover:text-teal-700"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-900 dark:text-white">{session.title}</span>
                                <Badge variant={sc.variant} className="text-2xs">{sc.label}</Badge>
                                {session.aiModified && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-2xs font-medium text-violet-700">
                                    <Sparkles className="h-3 w-3" />
                                    AI
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                                <span>{formatDate(session.date, locale)}</span>
                                {session.duration && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> {session.duration} min
                                  </span>
                                )}
                                {session._count.sessionExercises > 0 && (
                                  <span>{session._count.sessionExercises} {tCommon('exercises')}</span>
                                )}
                                {session.rpe && <span>RPE {session.rpe}/10</span>}
                              </div>
                            </Link>

                            {/* Quick status actions */}
                            <div className="flex items-center gap-1">
                              {session.status === 'PLANNED' && (
                                <button
                                  onClick={() => handleUpdateStatus(session.id, 'COMPLETED')}
                                  className="rounded p-1.5 text-slate-400 dark:text-slate-500 hover:bg-green-50 hover:text-green-600"
                                  title={t('markAsCompleted')}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteSession(session.id)}
                                className="rounded p-1.5 text-slate-400 dark:text-slate-500 hover:bg-red-50 hover:text-red-600"
                                title={t('deleteSession')}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add session button */}
                  <div className="flex items-center gap-3 border-t border-slate-100 dark:border-slate-700 px-5 py-3">
                    <button
                      onClick={() => openAddSession(week.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-800"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t('addSession')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Aggiungi Sessione Modal — unified with import from library */}
      <Modal
        open={!!showAddSession}
        onClose={() => setShowAddSession(null)}
        title={t('addSessionModal')}
        size="lg"
      >
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setAddSessionTab('import')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                addSessionTab === 'import'
                  ? 'border-teal-700 text-teal-700'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-300'
              }`}
            >
              <Upload className="mr-1.5 inline h-4 w-4" />
              {t('importFromLibrary')}
            </button>
            <button
              onClick={() => setAddSessionTab('create')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                addSessionTab === 'create'
                  ? 'border-teal-700 text-teal-700'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-300'
              }`}
            >
              <Plus className="mr-1.5 inline h-4 w-4" />
              {t('createNew')}
            </button>
          </div>

          {/* Date picker — shared by both tabs */}
          <Input
            label={t('dateRequired')}
            type="date"
            value={sessionForm.date}
            onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })}
          />

          {addSessionTab === 'import' ? (
            /* Import from template library */
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder={t('searchSessionLibrary')}
                  className="input-field w-full pl-10"
                />
              </div>
              {loadingTemplates ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Dumbbell className="mb-2 h-8 w-8 text-slate-300" />
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {templates.length === 0
                      ? t('noSessionsInLibrary')
                      : tCommon('noResults')}
                  </p>
                  {templates.length === 0 && (
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{t('createSessionsHint')}</p>
                  )}
                </div>
              ) : (
                <div className="max-h-[400px] space-y-2 overflow-y-auto">
                  {filteredTemplates.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t.title}</p>
                        <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                          <span>{t.duration} min</span>
                          <span>{t._count.sessionExercises} {tCommon('exercises')}</span>
                        </div>
                        {t.sessionExercises.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {t.sessionExercises.slice(0, 4).map((se, i) => (
                              <span key={i} className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-2xs text-slate-600 dark:text-slate-400">
                                {se.exercise.name}
                              </span>
                            ))}
                            {t._count.sessionExercises > 4 && (
                              <span className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-2xs text-slate-400 dark:text-slate-500">
                                +{t._count.sessionExercises - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => importTemplate(t.id)}
                        disabled={importingTemplate || !sessionForm.date}
                        className="ml-3 inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {t('importBtn')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Create new session directly */
            <div className="space-y-4">
              <Input
                label={t('sessionTitle')}
                value={sessionForm.title}
                onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                placeholder="es. Forza - Upper Body"
              />
              <Input
                label={t('durationMinutes')}
                type="number"
                value={sessionForm.duration}
                onChange={(e) => setSessionForm({ ...sessionForm, duration: e.target.value })}
                placeholder="75"
              />
              {!plan.athlete && (
                <Select
                  label={t('athleteOptional')}
                  value={sessionForm.athleteId}
                  onChange={(e) => setSessionForm({ ...sessionForm, athleteId: e.target.value })}
                  options={[
                    { value: '', label: t('allTeam') },
                    ...athletes.map((a) => ({
                      value: a.id,
                      label: `${a.firstName} ${a.lastName}`,
                    })),
                  ]}
                />
              )}
              <Input
                label={t('notesLabel')}
                value={sessionForm.notes}
                onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })}
                placeholder={t('optionalNotes')}
              />
              <div className="flex justify-end">
                <button
                  onClick={handleCreateSession}
                  disabled={creating || !sessionForm.title || !sessionForm.date}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  {creating ? t('creating') : t('createSession')}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
