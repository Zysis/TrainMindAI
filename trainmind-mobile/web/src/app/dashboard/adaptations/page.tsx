'use client';

import { useEffect, useState, useCallback } from 'react';
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
} from 'lucide-react';
import { apiFetch } from '@/lib/auth/fetch';
import { useToast } from '@/components/ui/toast';
import { AdaptationDiffCard, type AdaptationData } from '@/components/adaptations/adaptation-diff-card';

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
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED';
  mode: 'team' | 'individual';
  teamName: string | null;
  reason: string;
  aiReasoning: string | null;
  metrics: AdaptationData['metrics'];
  originalPlan: Array<{ sessionExerciseId: string; exerciseName: string }>;
  proposedPlan: AdaptationData['proposal']['proposedExercises'];
  changes: AdaptationData['proposal']['changes'];
  volumeDelta: number | null;
  intensityDelta: number | null;
  trainingSessionId: string | null;
  targetSession: { id: string; title: string; date: string } | null;
  appliedAt: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  athlete: Athlete;
  proposedBy: { firstName: string; lastName: string };
  reviewedBy: { firstName: string; lastName: string } | null;
}

// ─── Page Component ─────────────────────────────────────

export default function AdaptationsPage() {
  const t = useTranslations('adaptations');
  const locale = useLocale();
  const { toast } = useToast();
  const [adaptations, setAdaptations] = useState<Adaptation[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [athleteFilter, setAthleteFilter] = useState<string>('');
  const [generating, setGenerating] = useState(false);

  // Generation mode
  const [genMode, setGenMode] = useState<'team' | 'individual'>('team');
  const [genTeamId, setGenTeamId] = useState('');
  const [genAthleteId, setGenAthleteId] = useState('');

  const [activeProposal, setActiveProposal] = useState<AdaptationData | null>(null);

  // ─── Fetching ───────────────────────────────────────────

  const fetchAdaptations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (athleteFilter) params.set('athleteId', athleteFilter);
      const res = await apiFetch<{ data: Adaptation[] }>(`/ai/adaptations?${params}`);
      setAdaptations(res.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [statusFilter, athleteFilter]);

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
    fetchAthletes();
    fetchTeams();
  }, []);

  // ─── Actions ────────────────────────────────────────────

  const generateAdaptation = async () => {
    if (genMode === 'team' && !genTeamId) {
      toast('error', t('selectTeam'));
      return;
    }
    if (genMode === 'individual' && !genAthleteId) {
      toast('error', t('selectAthlete'));
      return;
    }
    setGenerating(true);
    try {
      const body = genMode === 'team'
        ? { mode: 'team', teamId: genTeamId }
        : { mode: 'individual', athleteId: genAthleteId };
      const res = await apiFetch<{ data: AdaptationData }>('/ai/adapt', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setActiveProposal(res.data);
      toast('success', 'Proposta generata');
      fetchAdaptations();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Errore generazione proposta';
      toast('error', message);
    }
    setGenerating(false);
  };

  const openAdaptation = (a: Adaptation) => {
    setActiveProposal({
      adaptationId: a.id,
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
        title: a.targetSession?.title || 'Sessione',
        date: a.targetSession?.date || a.createdAt,
      },
    });
  };

  // ─── Helpers ────────────────────────────────────────────

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const statusIcons = {
    PENDING: { Icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    APPROVED: { Icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    REJECTED: { Icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    MODIFIED: { Icon: Edit3, color: 'text-blue-600', bg: 'bg-blue-50' },
  };

  const statusLabels = {
    PENDING: 'In attesa',
    APPROVED: 'Approvato',
    REJECTED: 'Rifiutato',
    MODIFIED: 'Modificato',
  };

  const canGenerate = genMode === 'team' ? !!genTeamId : !!genAthleteId;

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
      <div className="rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50 to-cyan-50 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Genera proposta adattamento</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {genMode === 'team'
                ? 'Analizza sessioni di squadra precedenti e adatta la prossima sessione di squadra'
                : 'Analizza sessioni individuali e di squadra dell\'atleta e adatta la prossima sessione individuale'}
            </p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="mt-4 flex gap-1 rounded-lg bg-white dark:bg-slate-800/70 p-1">
          <button
            onClick={() => setGenMode('team')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
              genMode === 'team' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Squadra
          </button>
          <button
            onClick={() => setGenMode('individual')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
              genMode === 'individual' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            Individuale
          </button>
        </div>

        {/* Selector + Generate Button */}
        <div className="mt-3 flex gap-2">
          {genMode === 'team' ? (
            <select
              value={genTeamId}
              onChange={(e) => setGenTeamId(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            >
              <option value="">Seleziona squadra...</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          ) : (
            <select
              value={genAthleteId}
              onChange={(e) => setGenAthleteId(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            >
              <option value="">Seleziona atleta...</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
              ))}
            </select>
          )}
          <button
            onClick={generateAdaptation}
            disabled={!canGenerate || generating}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700 disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Genera
          </button>
        </div>
      </div>

      {/* Active Proposal Detail */}
      {activeProposal && (
        <AdaptationDiffCard
          data={activeProposal}
          onClose={() => setActiveProposal(null)}
          onReviewed={() => {
            setActiveProposal(null);
            fetchAdaptations();
          }}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <Filter className="h-4 w-4 text-slate-400 dark:text-slate-500" />
        <div className="flex gap-1">
          {['', 'PENDING', 'APPROVED', 'REJECTED', 'MODIFIED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s ? 'bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {s === '' ? 'Tutti' : statusLabels[s as keyof typeof statusLabels]}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-slate-200" />
        <select
          value={athleteFilter}
          onChange={(e) => setAthleteFilter(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:border-teal-500 focus:outline-none"
        >
          <option value="">Tutti gli atleti</option>
          {athletes.map((a) => (
            <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
          ))}
        </select>
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
            <p className="text-sm text-slate-400 dark:text-slate-500">Nessun adattamento trovato</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Genera una nuova proposta sopra</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {adaptations.map((a) => {
              const sIcon = statusIcons[a.status];
              const SIcon = sIcon.Icon;
              const isTeam = a.mode === 'team';
              return (
                <button
                  key={a.id}
                  onClick={() => openAdaptation(a)}
                  className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700"
                >
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${sIcon.bg}`}>
                    <SIcon className={`h-5 w-5 ${sIcon.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {isTeam
                              ? (a.teamName || 'Squadra')
                              : `${a.athlete.firstName} ${a.athlete.lastName}`}
                          </p>
                          <span className={`rounded px-1.5 py-0.5 text-2xs font-medium ${
                            isTeam ? 'bg-purple-100 text-purple-700' : 'bg-cyan-100 text-cyan-700'
                          }`}>
                            {isTeam ? 'Squadra' : 'Individuale'}
                          </span>
                        </div>
                        {a.targetSession && (
                          <p className="mt-0.5 text-xs font-medium text-teal-700">
                            Sessione: {a.targetSession.title} — {formatDate(a.targetSession.date)}
                          </p>
                        )}
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">{a.reason}</p>
                      </div>
                      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-2xs font-medium ${sIcon.bg} ${sIcon.color}`}>
                        {statusLabels[a.status]}
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
