'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Sparkles,
  Play,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  Edit3,
  User,
  Users,
  Loader2,
  Brain,
  History,
  RotateCcw,
  Info,
} from 'lucide-react';
import { apiFetch } from '@/lib/auth/fetch';
import { useApiError } from '@/lib/i18n/api-error';
import { useToast } from '@/components/ui/toast';
import {
  AdaptationDiffCard,
  type AdaptationData,
  type AdaptationStatus,
} from '@/components/adaptations/adaptation-diff-card';

// ─── Types ──────────────────────────────────────────────

interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
}

interface Team {
  id: string;
  name: string;
  color: string | null;
}

interface Adaptation {
  id: string;
  status: AdaptationStatus;
  mode: 'team' | 'individual';
  teamName: string | null;
  reason: string;
  aiReasoning: string | null;
  metrics: AdaptationData['metrics'];
  originalPlan: Array<{ sessionExerciseId: string; exerciseName: string }>;
  proposedPlan: AdaptationData['proposal']['proposedExercises'];
  appliedPlan: AdaptationData['proposal']['proposedExercises'] | null;
  changes: AdaptationData['proposal']['changes'];
  volumeDelta: number | null;
  intensityDelta: number | null;
  trainingSessionId: string | null;
  targetSession: { id: string; title: string; date: string; status: string } | null;
  appliedAt: string | null;
  reviewedAt: string | null;
  revertedAt: string | null;
  reviewNotes: string | null;
  canRevert: boolean;
  createdAt: string;
  /** null sulle proposte di squadra */
  athlete: Athlete | null;
  proposedBy: { firstName: string; lastName: string };
  reviewedBy: { firstName: string; lastName: string } | null;
}

/** Una sessione che si puo' adattare (GET /ai/adapt/sessions). */
interface AdaptableSession {
  id: string;
  title: string;
  date: string;
  aiModified: boolean;
  pendingAdaptationId: string | null;
}

const STATUS_FILTERS: Array<'' | AdaptationStatus> = ['', 'PENDING', 'APPROVED', 'MODIFIED', 'REJECTED', 'SUPERSEDED', 'REVERTED'];

// ─── Page Component ─────────────────────────────────────

export default function AdaptationsPage() {
  const t = useTranslations('adaptations');
  const tCommon = useTranslations('common');
  const apiError = useApiError();
  const locale = useLocale();
  const { toast } = useToast();
  const [adaptations, setAdaptations] = useState<Adaptation[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [modeFilter, setModeFilter] = useState<'' | 'team' | 'individual'>('');
  const [athleteFilter, setAthleteFilter] = useState<string>('');
  const [teamFilter, setTeamFilter] = useState<string>('');
  const [generating, setGenerating] = useState(false);

  // Generation mode
  const [genMode, setGenMode] = useState<'team' | 'individual'>('team');
  const [genTeamId, setGenTeamId] = useState('');
  const [genAthleteId, setGenAthleteId] = useState('');

  // Sessione da adattare: pianificate da oggi a +7 giorni
  const [candidates, setCandidates] = useState<AdaptableSession[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [genSessionId, setGenSessionId] = useState('');
  const [maxDaysAhead, setMaxDaysAhead] = useState(7);

  const [activeProposal, setActiveProposal] = useState<AdaptationData | null>(null);

  // ─── Fetching ───────────────────────────────────────────

  const fetchAdaptations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (modeFilter) params.set('mode', modeFilter);
      if (athleteFilter) params.set('athleteId', athleteFilter);
      if (teamFilter) params.set('teamId', teamFilter);
      const res = await apiFetch<{ data: Adaptation[] }>(`/ai/adaptations?${params}`);
      setAdaptations(res.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [statusFilter, modeFilter, athleteFilter, teamFilter]);

  const genSubjectId = genMode === 'team' ? genTeamId : genAthleteId;

  // In un ref: dentro le dipendenze di useCallback una funzione che cambia a
  // ogni render rifarebbe la fetch all'infinito.
  const notifyError = useRef<(err: unknown) => void>(() => {});
  notifyError.current = (err: unknown) => toast('error', apiError(err, t('sessionsLoadError')));

  const fetchCandidates = useCallback(async () => {
    if (!genSubjectId) {
      setCandidates([]);
      setGenSessionId('');
      return;
    }
    setLoadingCandidates(true);
    try {
      const params = new URLSearchParams({ mode: genMode });
      params.set(genMode === 'team' ? 'teamId' : 'athleteId', genSubjectId);
      const res = await apiFetch<{ data: AdaptableSession[]; meta?: { maxDaysAhead?: number } }>(
        `/ai/adapt/sessions?${params}`,
      );
      const list = res.data || [];
      setCandidates(list);
      if (res.meta?.maxDaysAhead) setMaxDaysAhead(res.meta.maxDaysAhead);
      // La prima gia' selezionata; se quella scelta prima c'e' ancora, resta.
      setGenSessionId((prev) => (list.some((s) => s.id === prev) ? prev : list[0]?.id ?? ''));
    } catch (err) {
      setCandidates([]);
      setGenSessionId('');
      notifyError.current(err);
    }
    setLoadingCandidates(false);
  }, [genMode, genSubjectId]);

  const fetchAthletes = async () => {
    try {
      const res = await apiFetch<{ data: Athlete[] }>('/athletes?limit=100');
      setAthletes(res.data || []);
    } catch { /* ignore */ }
  };

  const fetchTeams = async () => {
    try {
      const res = await apiFetch<{ data: Team[] }>('/teams');
      setTeams(res.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchAdaptations();
  }, [fetchAdaptations]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  useEffect(() => {
    fetchAthletes();
    fetchTeams();
  }, []);

  // ─── Actions ────────────────────────────────────────────

  const selectedCandidate = candidates.find((s) => s.id === genSessionId) || null;

  const generateAdaptation = async () => {
    if (genMode === 'team' && !genTeamId) {
      toast('error', t('selectTeam'));
      return;
    }
    if (genMode === 'individual' && !genAthleteId) {
      toast('error', t('selectAthlete'));
      return;
    }
    if (!genSessionId) {
      toast('error', t('selectSession'));
      return;
    }
    setGenerating(true);
    try {
      const body = genMode === 'team'
        ? { mode: 'team', teamId: genTeamId, trainingSessionId: genSessionId }
        : { mode: 'individual', athleteId: genAthleteId, trainingSessionId: genSessionId };
      const res = await apiFetch<{ data: AdaptationData & { supersededCount?: number } }>('/ai/adapt', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setActiveProposal({ ...res.data, status: 'PENDING' });
      toast('success', t('proposalGenerated'));
      if (res.data.supersededCount && res.data.supersededCount > 0) {
        toast('info', t('supersededNotice'));
      }
      fetchAdaptations();
      fetchCandidates();
    } catch (err: unknown) {
      toast('error', apiError(err, t('generateProposalError')));
    }
    setGenerating(false);
  };

  const openAdaptation = (a: Adaptation) => {
    setActiveProposal({
      adaptationId: a.id,
      status: a.status,
      metrics: a.metrics,
      proposal: {
        reason: a.reason,
        aiReasoning: a.aiReasoning || '',
        volumeDelta: a.volumeDelta || 0,
        intensityDelta: a.intensityDelta || 0,
        changes: a.changes || [],
        proposedExercises: a.proposedPlan || [],
        severity: a.metrics?.acwr > 1.5 ? 'danger' : a.metrics?.wellnessScore < 55 ? 'warning' : 'info',
      },
      originalPlan: a.originalPlan || [],
      targetSession: {
        id: a.targetSession?.id || a.trainingSessionId || '',
        title: a.targetSession?.title || t('session'),
        date: a.targetSession?.date || a.createdAt,
      },
      appliedPlan: a.appliedPlan,
      appliedAt: a.appliedAt,
      reviewedAt: a.reviewedAt,
      revertedAt: a.revertedAt,
      reviewNotes: a.reviewNotes,
      canRevert: a.canRevert,
    });
  };

  // ─── Helpers ────────────────────────────────────────────

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  // Le date di sessione sono giorni salvati a mezzanotte UTC: si leggono in UTC.
  const formatSessionDay = (d: string) =>
    new Date(d).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

  const statusIcons: Record<AdaptationStatus, { Icon: typeof Clock; color: string; bg: string }> = {
    PENDING: { Icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    APPROVED: { Icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    REJECTED: { Icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    MODIFIED: { Icon: Edit3, color: 'text-blue-600', bg: 'bg-blue-50' },
    SUPERSEDED: { Icon: History, color: 'text-slate-500', bg: 'bg-slate-100' },
    REVERTED: { Icon: RotateCcw, color: 'text-violet-600', bg: 'bg-violet-50' },
  };

  const statusLabels: Record<AdaptationStatus, string> = {
    PENDING: t('pending'),
    APPROVED: t('approved'),
    REJECTED: t('rejected'),
    MODIFIED: t('modified'),
    SUPERSEDED: t('superseded'),
    REVERTED: t('reverted'),
  };

  const canGenerate = !!genSubjectId && !!genSessionId;

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Brain className="h-6 w-6 text-teal-600" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {/* Generate New Adaptation */}
      <div className="rounded-xl border border-teal-100 dark:border-teal-900 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-slate-800 dark:to-slate-800 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('generate')}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {genMode === 'team' ? t('teamModeDesc') : t('individualModeDesc')}
            </p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="mt-4 flex gap-1 rounded-lg bg-white dark:bg-slate-900/70 p-1">
          <button
            onClick={() => setGenMode('team')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
              genMode === 'team' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            {t('teamMode')}
          </button>
          <button
            onClick={() => setGenMode('individual')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
              genMode === 'individual' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            {t('individualMode')}
          </button>
        </div>

        {/* Squadra/atleta, sessione, pulsante */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {genMode === 'team' ? (
            <select
              value={genTeamId}
              onChange={(e) => setGenTeamId(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            >
              <option value="">{t('selectTeam')}</option>
              {teams.map((tm) => (
                <option key={tm.id} value={tm.id}>{tm.name}</option>
              ))}
            </select>
          ) : (
            <select
              value={genAthleteId}
              onChange={(e) => setGenAthleteId(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            >
              <option value="">{t('selectAthlete')}</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
              ))}
            </select>
          )}
          <select
            value={genSessionId}
            onChange={(e) => setGenSessionId(e.target.value)}
            disabled={!genSubjectId || loadingCandidates || candidates.length === 0}
            aria-label={t('sessionToAdapt')}
            className="min-w-0 flex-[1.4] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none disabled:opacity-60"
          >
            {!genSubjectId ? (
              <option value="">{t('sessionPickSubjectFirst')}</option>
            ) : loadingCandidates ? (
              <option value="">{tCommon('loading')}</option>
            ) : candidates.length === 0 ? (
              <option value="">{t('noAdaptableSessions', { days: maxDaysAhead })}</option>
            ) : (
              candidates.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatSessionDay(s.date)} — {s.title}
                  {s.pendingAdaptationId ? ` · ${t('pendingMarker')}` : ''}
                </option>
              ))
            )}
          </select>
          <button
            onClick={generateAdaptation}
            disabled={!canGenerate || generating}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700 disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {t('generateBtn')}
          </button>
        </div>

        {/* Avvisi: metriche di oggi, finestra di 7 giorni, proposta da sostituire */}
        <div className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-400">
          <p className="flex items-start gap-1.5">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
            <span>{t('windowNotice', { days: maxDaysAhead })}</span>
          </p>
          {selectedCandidate?.pendingAdaptationId && (
            <p className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
              <History className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>{t('willSupersede')}</span>
            </p>
          )}
        </div>
      </div>

      {/* Active Proposal Detail */}
      {activeProposal && (
        <AdaptationDiffCard
          // La chiave azzera lo stato interno (correzioni, note) passando da
          // una proposta all'altra.
          key={activeProposal.adaptationId ?? 'new'}
          data={activeProposal}
          onClose={() => setActiveProposal(null)}
          onReviewed={() => {
            setActiveProposal(null);
            fetchAdaptations();
            fetchCandidates();
          }}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <Filter className="h-4 w-4 text-slate-400 dark:text-slate-500" />
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {s === '' ? tCommon('all') : statusLabels[s]}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <select
          value={modeFilter}
          onChange={(e) => {
            const v = e.target.value as '' | 'team' | 'individual';
            setModeFilter(v);
            if (v === 'team') setAthleteFilter('');
            if (v === 'individual') setTeamFilter('');
          }}
          aria-label={t('modeFilter')}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:border-teal-500 focus:outline-none"
        >
          <option value="">{t('allModes')}</option>
          <option value="team">{t('teamMode')}</option>
          <option value="individual">{t('individualMode')}</option>
        </select>
        {modeFilter !== 'individual' && (
          <select
            value={teamFilter}
            onChange={(e) => {
              setTeamFilter(e.target.value);
              if (e.target.value) setAthleteFilter('');
            }}
            aria-label={t('teamFilter')}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:border-teal-500 focus:outline-none"
          >
            <option value="">{t('allTeams')}</option>
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>{tm.name}</option>
            ))}
          </select>
        )}
        {modeFilter !== 'team' && (
          <select
            value={athleteFilter}
            onChange={(e) => {
              setAthleteFilter(e.target.value);
              if (e.target.value) setTeamFilter('');
            }}
            aria-label={t('athleteFilter')}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:border-teal-500 focus:outline-none"
          >
            <option value="">{t('allAthletes')}</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
            ))}
          </select>
        )}
      </div>

      {/* Adaptations List */}
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
          </div>
        ) : adaptations.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2">
            <Sparkles className="h-10 w-10 text-slate-200" />
            <p className="text-sm text-slate-400 dark:text-slate-500">{t('noAdaptations')}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{t('noAdaptationsHint')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {adaptations.map((a) => {
              const sIcon = statusIcons[a.status] ?? statusIcons.PENDING;
              const SIcon = sIcon.Icon;
              const isTeam = a.mode === 'team';
              const subject = isTeam
                ? (a.teamName || t('teamMode'))
                : (a.athlete ? `${a.athlete.firstName} ${a.athlete.lastName}` : t('individualMode'));
              return (
                <button
                  key={a.id}
                  onClick={() => openAdaptation(a)}
                  className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${sIcon.bg}`}>
                    <SIcon className={`h-5 w-5 ${sIcon.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{subject}</p>
                          <span className={`rounded px-1.5 py-0.5 text-2xs font-medium ${
                            isTeam ? 'bg-purple-100 text-purple-700' : 'bg-cyan-100 text-cyan-700'
                          }`}>
                            {isTeam ? t('teamMode') : t('individualMode')}
                          </span>
                        </div>
                        {a.targetSession && (
                          <p className="mt-0.5 text-xs font-medium text-teal-700 dark:text-teal-400">
                            {t('session')}: {a.targetSession.title} — {formatSessionDay(a.targetSession.date)}
                          </p>
                        )}
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">{a.reason}</p>
                      </div>
                      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-2xs font-medium ${sIcon.bg} ${sIcon.color}`}>
                        {statusLabels[a.status] ?? a.status}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-2xs text-slate-400 dark:text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {a.proposedBy.firstName} {a.proposedBy.lastName}
                      </span>
                      <span>{formatDate(a.createdAt)}</span>
                      {a.volumeDelta != null && a.volumeDelta !== 0 && (
                        <span className={a.volumeDelta > 0 ? 'text-green-600' : 'text-orange-600'}>
                          Vol {a.volumeDelta > 0 ? '+' : ''}{Math.round(a.volumeDelta * 100)}%
                        </span>
                      )}
                      {a.intensityDelta != null && a.intensityDelta !== 0 && (
                        <span className={a.intensityDelta > 0 ? 'text-green-600' : 'text-orange-600'}>
                          Int {a.intensityDelta > 0 ? '+' : ''}{Math.round(a.intensityDelta * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
