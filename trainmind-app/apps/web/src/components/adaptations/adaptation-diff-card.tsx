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
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { apiFetch } from '@/lib/auth/fetch';
import { useToast } from '@/components/ui/toast';

// ─── Types ──────────────────────────────────────────────

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
}

interface Props {
  data: AdaptationData;
  onClose?: () => void;
  onReviewed?: (status: string) => void;
  compact?: boolean;
}

// ─── Component ──────────────────────────────────────────

export function AdaptationDiffCard({ data, onClose, onReviewed, compact }: Props) {
  const { toast } = useToast();
  const t = useTranslations('adaptations');
  const locale = useLocale();
  const tc = useTranslations('common');
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [editedExercises, setEditedExercises] = useState<ProposedExercise[]>(data.proposal.proposedExercises);
  const [editMode, setEditMode] = useState(false);

  const { metrics, proposal, targetSession } = data;

  const severityStyles = {
    info: { border: 'border-blue-200', bg: 'bg-blue-50', icon: 'text-blue-500', accent: 'bg-blue-500' },
    warning: { border: 'border-amber-200', bg: 'bg-amber-50', icon: 'text-amber-500', accent: 'bg-amber-500' },
    danger: { border: 'border-red-200', bg: 'bg-red-50', icon: 'text-red-500', accent: 'bg-red-500' },
  }[proposal.severity];

  const zoneLabel = (acwr: number) =>
    acwr < 0.8 ? 'Bassa' : acwr <= 1.3 ? 'Ottimale' : acwr <= 1.5 ? 'Alta' : 'Critica';
  const zoneColor = (acwr: number) =>
    acwr < 0.8 ? 'text-blue-600' : acwr <= 1.3 ? 'text-green-600' : acwr <= 1.5 ? 'text-amber-600' : 'text-red-600';

  const wellnessColor = (score: number) =>
    score >= 70 ? 'text-green-600' : score >= 55 ? 'text-amber-600' : 'text-red-600';

  // ─── Review Handler ─────────────────────────────────────

  const handleReview = async (status: 'APPROVED' | 'REJECTED' | 'MODIFIED') => {
    if (!data.adaptationId) {
      toast('error', t('missingId'));
      return;
    }
    setReviewing(status);
    try {
      await apiFetch(`/ai/adaptations/${data.adaptationId}/review`, {
        method: 'POST',
        body: JSON.stringify({
          status,
          reviewNotes: notes || undefined,
          modifiedPlan: status === 'MODIFIED' ? editedExercises : undefined,
        }),
      });
      toast('success', t('proposalGenerated'));

      onReviewed?.(status);
    } catch {
      toast('error', t('reviewError'));
      setReviewing(null);
    }
  };

  const updateExercise = (idx: number, field: keyof ProposedExercise, value: number | string | null) => {
    setEditedExercises((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

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
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Adattamento AI proposto</h3>
              <span className={`rounded-full px-2 py-0.5 text-2xs font-medium uppercase text-white ${severityStyles.accent}`}>
                {proposal.severity === 'danger' ? 'Urgente' : proposal.severity === 'warning' ? 'Avviso' : 'Info'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              {targetSession.title} —{' '}
              {new Date(targetSession.date).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 dark:text-slate-500 hover:bg-white dark:bg-slate-800 hover:text-slate-600 dark:text-slate-400">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Metrics Summary */}
      <div className="grid grid-cols-2 gap-3 border-b border-slate-100 dark:border-slate-700 px-5 py-4 sm:grid-cols-4">
        <MetricBox
          icon={Activity}
          label="ACWR"
          value={metrics.acwr.toFixed(2)}
          sublabel={zoneLabel(metrics.acwr)}
          valueColor={zoneColor(metrics.acwr)}
        />
        <MetricBox
          icon={Heart}
          label={t('wellnessLabel')}
          value={`${metrics.wellnessScore}%`}
          sublabel={metrics.wellnessScore >= 70 ? 'Buono' : metrics.wellnessScore >= 55 ? 'Medio' : 'Basso'}
          valueColor={wellnessColor(metrics.wellnessScore)}
        />
        <MetricBox
          icon={Gauge}
          label="RPE Medio"
          value={metrics.rpeAvg.toFixed(1)}
          sublabel={`Target ${metrics.targetRpeAvg.toFixed(1)}`}
          valueColor="text-slate-900 dark:text-white"
        />
        <MetricBox
          icon={Target}
          label={t('completion')}
          value={`${Math.round(metrics.completionRate * 100)}%`}
          sublabel={`${metrics.sessionsCount} sessioni`}
          valueColor="text-slate-900 dark:text-white"
        />
      </div>

      {/* AI Reasoning */}
      <div className="border-b border-slate-100 dark:border-slate-700 px-5 py-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className={`mt-0.5 h-4 w-4 flex-shrink-0 ${severityStyles.icon}`} />
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900 dark:text-white">Motivazione AI</p>
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
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Confronto esercizi</h4>
            {data.adaptationId && proposal.proposedExercises.some((e) => e.action !== 'keep') && (
              <button
                onClick={() => setEditMode(!editMode)}
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
                  <th className="px-2 py-2 text-left font-medium">Esercizio</th>
                  <th className="px-2 py-2 text-center font-medium">Serie</th>
                  <th className="px-2 py-2 text-center font-medium">Rip.</th>
                  <th className="px-2 py-2 text-center font-medium">Peso</th>
                  <th className="px-2 py-2 text-center font-medium">Rec.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(editMode ? editedExercises : proposal.proposedExercises).map((ex, idx) => (
                  <tr key={ex.sessionExerciseId} className={ex.action !== 'keep' ? 'bg-amber-50/40' : ''}>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1.5">
                        {ex.action === 'keep' ? (
                          <Minus className="h-3 w-3 text-slate-300" />
                        ) : (
                          <ArrowRight className="h-3 w-3 text-amber-500" />
                        )}
                        <span className="font-medium text-slate-700">{ex.exerciseName}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <DiffValue
                        original={ex.originalSets}
                        proposed={ex.proposedSets}
                        editable={editMode}
                        onEdit={(v) => updateExercise(idx, 'proposedSets', v as number)}
                      />
                    </td>
                    <td className="px-2 py-2 text-center text-slate-600 dark:text-slate-400">{ex.proposedReps || '—'}</td>
                    <td className="px-2 py-2 text-center">
                      <DiffValue
                        original={ex.originalWeight}
                        proposed={ex.proposedWeight}
                        unit="kg"
                        editable={editMode}
                        onEdit={(v) => updateExercise(idx, 'proposedWeight', v as number)}
                      />
                    </td>
                    <td className="px-2 py-2 text-center text-slate-600 dark:text-slate-400">
                      {ex.proposedRestTime ? `${ex.proposedRestTime}s` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      {data.adaptationId && (
        <div className="space-y-3 px-5 py-4">
          {showNotes && (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('addNotes')}
              rows={2}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleReview(editMode ? 'MODIFIED' : 'APPROVED')}
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
              onClick={() => handleReview('REJECTED')}
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
              className="inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700"
            >
              {showNotes ? t('hideNotes') : t('addNotes')}
            </button>
          </div>
        </div>
      )}
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
  editable,
  onEdit,
}: {
  original?: number | null;
  proposed?: number | null;
  unit?: string;
  editable?: boolean;
  onEdit?: (v: number) => void;
}) {
  const changed = original !== proposed;

  if (editable && proposed !== null && proposed !== undefined) {
    return (
      <input
        type="number"
        value={proposed}
        onChange={(e) => onEdit?.(Number(e.target.value))}
        className="w-14 rounded border border-slate-200 dark:border-slate-700 px-1 py-0.5 text-center text-xs focus:border-teal-500 focus:outline-none"
      />
    );
  }

  if (!changed) {
    return <span className="text-slate-600 dark:text-slate-400">{proposed != null ? `${proposed}${unit}` : '—'}</span>;
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <span className="text-slate-400 dark:text-slate-500 line-through">{original != null ? `${original}${unit}` : '—'}</span>
      <ArrowRight className="h-2.5 w-2.5 text-slate-400 dark:text-slate-500" />
      <span className="font-semibold text-teal-600">{proposed != null ? `${proposed}${unit}` : '—'}</span>
    </div>
  );
}
