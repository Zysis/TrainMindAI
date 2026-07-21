'use client';

import { useState, useCallback } from 'react';
import { Sparkles, Loader2, AlertTriangle, TrendingUp, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/auth/fetch';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';

interface Source {
  id: string;
  title: string;
  category: string;
  score: number;
}

interface AIWellnessInsightsProps {
  athleteId?: string;
  athleteName?: string;
}

export function AIWellnessInsights({ athleteId, athleteName }: AIWellnessInsightsProps) {
  const t = useTranslations('ai');
  const DAYS_OPTIONS = [
    { value: 7, label: t('daysOption', { n: 7 }) },
    { value: 14, label: t('daysOption', { n: 14 }) },
    { value: 30, label: t('daysOption', { n: 30 }) },
  ];
  const [days, setDays] = useState(14);
  const [insight, setInsight] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generateInsights = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setInsight('');
    setSources([]);

    try {
      // (Legacy helper — the question payload is built server-side now)

      const res = await apiFetch<{ success: boolean; data: { answer?: string; content?: string; sources?: Source[] } }>('/ai/wellness-insights', {
        method: 'POST',
        body: JSON.stringify({
          athlete_id: athleteId || undefined,
          days,
        }),
      });
      const payload = res.data ?? (res as unknown as { answer?: string; content?: string; sources?: Source[] });
      setInsight(payload.answer || payload.content || '');
      setSources(payload.sources || []);
      setHasGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('unknownError'));
    } finally {
      setIsLoading(false);
    }
  }, [athleteId, athleteName, days]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50">
            <Sparkles className="h-4 w-4 text-teal-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('wellnessTitle')}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {athleteName ? t('insightsFor', { name: athleteName }) : t('teamInsights')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-700"
          >
            {DAYS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <button
            onClick={generateInsights}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : hasGenerated ? (
              <RefreshCw className="h-3.5 w-3.5" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {hasGenerated ? t('regenerate') : t('generateInsights')}
          </button>
        </div>
      </div>

      {/* Initial state */}
      {!hasGenerated && !isLoading && !error && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-700 py-8">
          <TrendingUp className="mb-2 h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {t('generateAnalysisCTA')}
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            {t('aiWillAnalyze')}
          </p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('analyzingWellness')}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{t('aiEvaluatingDays', { n: days })}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-medium text-red-700">{t('errorTitle')}</p>
            <p className="text-xs text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {insight && !isLoading && (
        <div className="space-y-3">
          <div className="max-h-[400px] overflow-y-auto rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
            <MarkdownRenderer content={insight} />
          </div>

          {sources.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-2xs text-slate-400 dark:text-slate-500">{t('sourcesLabel')}</span>
              {sources.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-2xs text-slate-500 dark:text-slate-400"
                >
                  {s.title} ({Math.round(s.score * 100)}%)
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
