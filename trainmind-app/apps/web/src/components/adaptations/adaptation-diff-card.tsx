'use client';

import { useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  XCircle,
  Edit3,
  AlertTriangle,
  Activity,
  Heart,
  Gauge,
  Target,
  X,
  ArrowRight,
  RotateCcw,
  Info,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { apiFetch, ApiError } from '@/lib/auth/fetch';
import { useApiError } from '@/lib/i18n/api-error';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

// ─── Types ──────────────────────────────────────────────

export type AdaptationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'SUPERSEDED' | 'REVERTED';

export interface AdaptationMetrics {
  acwr: number;
  wellnessScore: number;
  rpeAvg: number;
  targetRpeAvg: number;
  completionRate: number;
  sessionsCount: number;
  rpeDeviation: number;
  acuteLoad: number;
  chronicLoad: number;
}

export interface ProposedExercise {
  sessionExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  originalSets?: number | null;
  originalReps?: string | null;
  originalWeight?: number | null;
  originalRestTime?: number | null;
  proposedSets?: number | null;
  proposedReps?: string | null;
  proposedWeight?: number | null;
  proposedRestTime?: number | null;
  action: 'keep' | 'scale' | 'replace' | 'remove';
}

export interface ChangeItem {
  type: 'volume' | 'intensity' | 'exercise' | 'rest';
  description: string;
  delta?: number;
}

export interface AdaptationData {
  adaptationId?: string;
  /** Assente su una proposta appena generata: vale come PENDING. */
  status?: AdaptationStatus;
  metrics: AdaptationMetrics;
  proposal: {
    reason: string;
    aiReasoning: string;
    volumeDelta: number;
    intensityDelta: number;
    changes: ChangeItem[];
    proposedExercises: ProposedExercise[];
    severity: 'info' | 'warning' | 'danger';
  };
  originalPlan: Array<{ sessionExerciseId: string; exerciseName: string }>;
  targetSession: { id: string; title: string; date: string };
  /** Cio' che e' stato scritto sulla sessione; null sulle MODIFIED vecchie. */
  appliedPlan?: ProposedExercise[] | null;
  appliedAt?: string | null;
  reviewedAt?: string | null;
  revertedAt?: string | null;
  reviewNotes?: string | null;
  /** Calcolato dal server: ultima applicata sulla sessione, e sessione ancora pianificata. */
  canRevert?: boolean;
}

interface Props {
  data: AdaptationData;
  onClose?: () => void;
  onReviewed?: (status: string) => void;
  compact?: boolean;
}

type EditableField = 'proposedSets' | 'proposedReps' | 'proposedWeight' | 'proposedRestTime';
const EDITABLE_FIELDS: EditableField[] = ['proposedSets', 'proposedReps', 'proposedWeight', 'proposedRestTime'];

const sameValue = (a: unknown, b: unknown) => {
  const norm = (v: unknown) => (v === '' || v === undefined ? null : v);
  return norm(a) === norm(b);
};

/** "scale" se la riga differisce dai valori di partenza: serve all'evidenziazione. */
function withAction(ex: ProposedExercise): ProposedExercise {
  const differs =
    !sameValue(ex.originalSets, ex.proposedSets) ||
    !sameValue(ex.originalReps, ex.proposedReps) ||
    !sameValue(ex.originalWeight, ex.proposedWeight) ||
    !sameValue(ex.originalRestTime, ex.proposedRestTime);
  return { ...ex, action: differs ? 'scale' : 'keep' };
}

// ─── Component ──────────────────────────────────────────

export function AdaptationDiffCard({ data, onClose, onReviewed, compact }: Props) {
  const { toast } = useToast();
  const t = useTranslations('adaptations');
  const locale = useLocale();
  const tc = useTranslations('common');
  const tSessions = useTranslations('sessions');
  const apiError = useApiError();
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [editedExercises, setEditedExercises] = useState<ProposedExercise[]>(data.proposal.proposedExercises);
  const [editMode, setEditMode] = useState(false);
  const [revertStep, setRevertStep] = useState<null | 'confirm' | 'conflict'>(null);
  const [revertConflict, setRevertConflict] = useState<{ exercises: string[]; unknownApplied: boolean } | null>(null);
  const [reverting, setReverting] = useState(false);

  const { metrics, proposal, targetSession } = data;
  const status: AdaptationStatus = data.status ?? 'PENDING';
  const isPending = status === 'PENDING';
  const wasApplied = status === 'APPROVED' || status === 'MODIFIED' || status === 'REVERTED';
  // Le MODIFIED precedenti al 13/10/2026 non salvavano cosa scrivevano.
  const appliedUnknown = wasApplied && !data.appliedPlan;

  const severityStyles = {
    info: { border: 'border-blue-200', bg: 'bg-blue-50', icon: 'text-blue-500', accent: 'bg-blue-500' },
    warning: { border: 'border-amber-200', bg: 'bg-amber-50', icon: 'text-amber-500', accent: 'bg-amber-500' },
    danger: { border: 'border-red-200', bg: 'bg-red-50', icon: 'text-red-500', accent: 'bg-red-500' },
  }[proposal.severity];

  const zoneLabel = (acwr: number) =>
    acwr < 0.8 ? t('zoneLow') : acwr <= 1.3 ? t('zoneOptimal') : acwr <= 1.5 ? t('zoneHigh') : t('zoneCritical');
  const zoneColor = (acwr: number) =>
    acwr < 0.8 ? 'text-blue-600' : acwr <= 1.3 ? 'text-green-600' : acwr <= 1.5 ? 'text-amber-600' : 'text-red-600';

  const wellnessColor = (score: number) =>
    score >= 70 ? 'text-green-600' : score >= 55 ? 'text-amber-600' : 'text-red-600';

  const fmtDay = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  // Date di sessione salvate come giorno (00:00 UTC): si leggono in UTC, o a
  // ovest di Greenwich cadrebbero il giorno prima.
  const sessionDay = new Date(targetSession.date).toLocaleDateString(locale, {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
  const todayIso = new Date().toISOString().slice(0, 10);
  const sessionIsLater = targetSession.date.slice(0, 10) > todayIso;

  const rows: ProposedExercise[] = isPending
    ? (editMode ? editedExercises : proposal.proposedExercises)
    : (data.appliedPlan ?? proposal.proposedExercises);

  // ─── Review Handler ─────────────────────────────────────

  const editedDiffersFromProposal = editedExercises.some((ex, i) => {
    const p = proposal.proposedExercises[i];
    return !p || EDITABLE_FIELDS.some((f) => !sameValue(ex[f], p[f]));
  });

  const handleReview = async (decision: 'APPROVE' | 'REJECT') => {
    if (!data.adaptationId) {
      toast('error', t('missingId'));
      return;
    }
    // "Applica modifiche" senza aver cambiato niente e' un'approvazione.
    const reviewStatus: 'APPROVED' | 'REJECTED' | 'MODIFIED' = decision === 'REJECT'
      ? 'REJECTED'
      : (editMode && editedDiffersFromProposal ? 'MODIFIED' : 'APPROVED');
    setReviewing(reviewStatus);
    try {
      await apiFetch(`/ai/adaptations/${data.adaptationId}/review`, {
        method: 'POST',
        body: JSON.stringify({
          status: reviewStatus,
          reviewNotes: notes || undefined,
          modifiedPlan: reviewStatus === 'MODIFIED'
            ? editedExercises.map((ex) => ({
                sessionExerciseId: ex.sessionExerciseId,
                proposedSets: ex.proposedSets ?? null,
                proposedReps: ex.proposedReps ? ex.proposedReps : null,
                proposedWeight: ex.proposedWeight ?? null,
                proposedRestTime: ex.proposedRestTime ?? null,
              }))
            : undefined,
        }),
      });
      toast('success', reviewStatus === 'REJECTED' ? t('reviewRejected') : reviewStatus === 'MODIFIED' ? t('reviewModified') : t('reviewApproved'));
      onReviewed?.(reviewStatus);
    } catch (err) {
      toast('error', apiError(err, t('reviewError')));
      setReviewing(null);
    }
  };

  const updateExercise = (idx: number, field: EditableField, value: number | string | null) => {
    setEditedExercises((prev) => {
      const next = [...prev];
      next[idx] = withAction({ ...next[idx], [field]: value });
      return next;
    });
  };

  // ─── Revert Handler ─────────────────────────────────────

  const doRevert = async (force: boolean) => {
    if (!data.adaptationId) return;
    setReverting(true);
    try {
      const res = await apiFetch<{ data: { restoredCount: number; skippedExercises: string[] } }>(
        `/ai/adaptations/${data.adaptationId}/revert`,
        { method: 'POST', body: JSON.stringify({ force }) },
      );
      setRevertStep(null);
      toast('success', t('revertDone'));
      if (res.data.skippedExercises.length > 0) {
        toast('warning', t('revertSkipped', { names: res.data.skippedExercises.join(', ') }));
      }
      onReviewed?.('REVERTED');
    } catch (err) {
      if (!force && err instanceof ApiError && err.code === 'ADAPTATION_REVERT_CONFLICT') {
        const details = (err.details ?? {}) as { exercises?: string[]; unknownApplied?: boolean };
        setRevertConflict({ exercises: details.exercises ?? [], unknownApplied: !!details.unknownApplied });
        setRevertStep('conflict');
      } else {
        setRevertStep(null);
        toast('error', apiError(err, t('revertError')));
      }
    } finally {
      setReverting(false);
    }
  };

  const statusBanner = (() => {
    switch (status) {
      case 'APPROVED':
        return t('bannerApproved', { date: fmtDay(data.appliedAt ?? data.reviewedAt) });
      case 'MODIFIED':
        return t('bannerModified', { date: fmtDay(data.appliedAt ?? data.reviewedAt) });
      case 'REJECTED':
        return t('bannerRejected', { date: fmtDay(data.reviewedAt) });
      case 'SUPERSEDED':
        return t('bannerSuperseded');
      case 'REVERTED':
        return t('bannerReverted', { date: fmtDay(data.revertedAt) });
      default:
        return null;
    }
  })();

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white dark:bg-slate-800 shadow-sm ${severityStyles.border}`}>
      {/* Header */}
      <div className={`flex items-start justify-between gap-3 border-b ${severityStyles.border} ${severityStyles.bg} px-5 py-4`}>
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-800 ${severityStyles.icon} shadow-sm`}>
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{t('aiProposal')}</h3>
              <span className={`rounded-full px-2 py-0.5 text-2xs font-medium uppercase text-white ${severityStyles.accent}`}>
                {proposal.severity === 'danger' ? t('urgent') : proposal.severity === 'warning' ? t('severityWarning') : t('severityInfo')}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              {targetSession.title} — {sessionDay}
            </p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 dark:text-slate-500 hover:bg-white dark:bg-slate-800 hover:text-slate-600 dark:text-slate-400">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Stato di una proposta gia' gestita */}
      {statusBanner && (
        <div className="space-y-1 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-5 py-3 text-xs text-slate-700 dark:text-slate-300">
          <p className="font-medium">{statusBanner}</p>
          {appliedUnknown && <p className="text-slate-500 dark:text-slate-400">{t('appliedUnknownNote')}</p>}
          {data.reviewNotes && (
            <p className="text-slate-500 dark:text-slate-400">{t('notesLabel')}: {data.reviewNotes}</p>
          )}
        </div>
      )}

      {/* Le metriche sono di oggi, anche per una sessione fra qualche giorno */}
      {isPending && (
        <div className="flex items-start gap-2 border-b border-slate-100 dark:border-slate-700 px-5 py-2.5 text-xs text-slate-600 dark:text-slate-400">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
          <span>{sessionIsLater ? t('metricsTodayLater', { date: sessionDay }) : t('metricsToday')}</span>
        </div>
      )}

      {/* Metrics Summary */}
      <div className="grid grid-cols-2 gap-3 border-b border-slate-100 dark:border-slate-700 px-5 py-4 sm:grid-cols-4">
        <MetricBox
          icon={Activity}
          label={t('acwr')}
          value={metrics.acwr.toFixed(2)}
          sublabel={zoneLabel(metrics.acwr)}
          valueColor={zoneColor(metrics.acwr)}
        />
        <MetricBox
          icon={Heart}
          label={t('wellnessLabel')}
          value={`${metrics.wellnessScore}%`}
          sublabel={metrics.wellnessScore >= 70 ? t('wellnessGood') : metrics.wellnessScore >= 55 ? t('wellnessMedium') : t('wellnessLow')}
          valueColor={wellnessColor(metrics.wellnessScore)}
        />
        <MetricBox
          icon={Gauge}
          label={t('avgRpe')}
          value={metrics.rpeAvg.toFixed(1)}
          sublabel={t('targetValue', { value: metrics.targetRpeAvg.toFixed(1) })}
          valueColor="text-slate-900 dark:text-white"
        />
        <MetricBox
          icon={Target}
          label={t('completion')}
          value={`${Math.round(metrics.completionRate * 100)}%`}
          sublabel={`${metrics.sessionsCount} ${tc('sessions')}`}
          valueColor="text-slate-900 dark:text-white"
        />
      </div>

      {/* AI Reasoning */}
      <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className={`mt-0.5 h-4 w-4 flex-shrink-0 ${severityStyles.icon}`} />
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900 dark:text-white">{t('aiReasoning')}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{proposal.aiReasoning}</p>
          </div>
        </div>

        {proposal.changes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {proposal.changes.map((c, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                  c.delta && c.delta > 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                }`}
              >
                {c.delta && c.delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {c.description}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Diff Table */}
      {!compact && (
        <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              {isPending ? t('exerciseComparison') : t('appliedComparison')}
            </h4>
            {/* Correggibile sempre, anche quando la regola non cambia niente. */}
            {data.adaptationId && isPending && rows.length > 0 && (
              <button
                onClick={() => {
                  if (editMode) setEditedExercises(proposal.proposedExercises);
                  setEditMode(!editMode);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700"
              >
                <Edit3 className="h-3.5 w-3.5" />
                {editMode ? t('endEdit') : tc('edit')}
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                  <th className="px-2 py-2 text-left font-medium">{t('exerciseColumn')}</th>
                  <th className="px-2 py-2 text-center font-medium">{tSessions('sets')}</th>
                  <th className="px-2 py-2 text-center font-medium">{tSessions('reps')}</th>
                  <th className="px-2 py-2 text-center font-medium">{tSessions('weight')}</th>
                  <th className="px-2 py-2 text-center font-medium">{tSessions('rest')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                {rows.map((ex, idx) => (
                  <tr key={ex.sessionExerciseId} className={ex.action !== 'keep' ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1.5">
                        {ex.action === 'keep' ? (
                          <Minus className="h-3 w-3 text-slate-300" />
                        ) : (
                          <ArrowRight className="h-3 w-3 text-amber-500" />
                        )}
                        <span className="font-medium text-slate-700 dark:text-slate-300">{ex.exerciseName}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      {editMode ? (
                        <EditCell kind="int" value={ex.proposedSets} onChange={(v) => updateExercise(idx, 'proposedSets', v)} />
                      ) : (
                        <DiffValue original={ex.originalSets} proposed={ex.proposedSets} />
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {editMode ? (
                        <EditCell kind="text" value={ex.proposedReps} onChange={(v) => updateExercise(idx, 'proposedReps', v)} />
                      ) : (
                        <DiffValue original={ex.originalReps} proposed={ex.proposedReps} />
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {editMode ? (
                        <EditCell kind="decimal" value={ex.proposedWeight} onChange={(v) => updateExercise(idx, 'proposedWeight', v)} />
                      ) : (
                        <DiffValue original={ex.originalWeight} proposed={ex.proposedWeight} unit="kg" />
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {editMode ? (
                        <EditCell kind="int" value={ex.proposedRestTime} onChange={(v) => updateExercise(idx, 'proposedRestTime', v)} />
                      ) : (
                        <DiffValue original={ex.originalRestTime} proposed={ex.proposedRestTime} unit="s" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions — solo su una proposta ancora da decidere */}
      {data.adaptationId && isPending && (
        <div className="space-y-3 px-5 py-4">
          {showNotes && (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('addNotes')}
              rows={2}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleReview('APPROVE')}
              disabled={!!reviewing}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700 disabled:opacity-50"
            >
              {reviewing === 'APPROVED' || reviewing === 'MODIFIED' ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {editMode ? t('applyChanges') : t('approve')}
            </button>
            <button
              onClick={() => handleReview('REJECT')}
              disabled={!!reviewing}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              {reviewing === 'REJECTED' ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {t('reject')}
            </button>
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              {showNotes ? t('hideNotes') : t('addNotes')}
            </button>
          </div>
        </div>
      )}

      {/* Ripristino di un adattamento applicato */}
      {data.adaptationId && (status === 'APPROVED' || status === 'MODIFIED') && (
        <div className="px-5 py-4">
          {data.canRevert ? (
            <button
              onClick={() => setRevertStep('confirm')}
              disabled={reverting}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              {t('revert')}
            </button>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('revertUnavailable')}</p>
          )}
        </div>
      )}

      <ConfirmDialog
        open={revertStep === 'confirm'}
        tone="default"
        title={t('revertTitle')}
        message={t('revertMessage', { session: targetSession.title })}
        detail={t('revertDetail')}
        confirmLabel={t('revert')}
        busy={reverting}
        busyLabel={t('reverting')}
        onConfirm={() => doRevert(false)}
        onClose={() => setRevertStep(null)}
      />
      <ConfirmDialog
        open={revertStep === 'conflict'}
        tone="danger"
        title={t('revertConflictTitle')}
        message={revertConflict?.unknownApplied ? t('revertUnknownMessage') : t('revertConflictMessage')}
        detail={revertConflict && revertConflict.exercises.length > 0 && !revertConflict.unknownApplied
          ? t('revertConflictExercises', { names: revertConflict.exercises.join(', ') })
          : undefined}
        confirmLabel={t('revertAnyway')}
        busy={reverting}
        busyLabel={t('reverting')}
        onConfirm={() => doRevert(true)}
        onClose={() => setRevertStep(null)}
      />
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────

function MetricBox({
  icon: Icon,
  label,
  value,
  sublabel,
  valueColor,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  sublabel: string;
  valueColor: string;
}) {
  return (
    <div className="rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-3">
      <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className={`mt-1 text-lg font-bold ${valueColor}`}>{value}</p>
      <p className="text-2xs text-slate-400 dark:text-slate-500">{sublabel}</p>
    </div>
  );
}

function DiffValue({
  original,
  proposed,
  unit = '',
}: {
  original?: number | string | null;
  proposed?: number | string | null;
  unit?: string;
}) {
  const show = (v: number | string | null | undefined) => (v != null && v !== '' ? `${v}${unit}` : '—');

  if (sameValue(original, proposed)) {
    return <span className="text-slate-600 dark:text-slate-400">{show(proposed)}</span>;
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <span className="text-slate-400 dark:text-slate-500 line-through">{show(original)}</span>
      <ArrowRight className="h-2.5 w-2.5 text-slate-400 dark:text-slate-500" />
      <span className="font-semibold text-teal-600">{show(proposed)}</span>
    </div>
  );
}

/**
 * Cella modificabile. Il campo vuoto vale "nessun valore" (null): su un
 * esercizio a corpo libero toglie il sovraccarico, come nella scheda sessione.
 */
function EditCell({
  kind,
  value,
  onChange,
}: {
  kind: 'int' | 'decimal' | 'text';
  value?: number | string | null;
  onChange: (v: number | string | null) => void;
}) {
  const base = 'rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1 py-0.5 text-center text-xs focus:border-teal-500 focus:outline-none';
  if (kind === 'text') {
    return (
      <input
        type="text"
        maxLength={20}
        value={value == null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value.trim() === '' ? null : e.target.value)}
        className={`w-16 ${base}`}
      />
    );
  }
  return (
    <input
      type="number"
      min={0}
      step={kind === 'decimal' ? 0.5 : 1}
      value={value == null ? '' : String(value)}
      onChange={(e) => {
        const raw = e.target.value.trim();
        if (raw === '') return onChange(null);
        const n = kind === 'int' ? parseInt(raw, 10) : parseFloat(raw);
        if (Number.isNaN(n) || n < 0) return;
        onChange(n);
      }}
      className={`${kind === 'decimal' ? 'w-16' : 'w-14'} ${base}`}
    />
  );
}
