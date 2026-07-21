'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FileText, Download, Eye, Loader2, CalendarClock } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/auth/fetch';
import { getAccessToken } from '@/lib/auth/api';
import { API_BASE_URL, API_PREFIX } from '@/lib/constants';
import { useTeam } from '@/hooks/use-team';

type Audience = 'STAFF' | 'MEDICAL' | 'TRAINER';
type Format = 'JSON' | 'PDF' | 'DOCX';

function todayMinusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ReportPreview {
  metadata: {
    audience: string;
    organizationName: string;
    periodFrom: string;
    periodTo: string;
    generatedAt: string;
    generatedBy: string;
    teamName?: string;
  };
  summary?: string;
  kpis?: Array<{ label: string; value: string | number; trend?: string }>;
}

export default function ReportsPage() {
  const t = useTranslations('reports');

  const AUDIENCE_OPTIONS = [
    { value: 'STAFF', label: t('audienceStaff') },
    { value: 'MEDICAL', label: t('audienceMedical') },
    { value: 'TRAINER', label: t('audienceTrainer') },
  ];
  const { toast } = useToast();
  const { teams } = useTeam();
  const [teamId, setTeamId] = useState<string>('');
  const [audience, setAudience] = useState<Audience>('STAFF');
  const [periodFrom, setPeriodFrom] = useState(todayMinusDays(30));
  const [periodTo, setPeriodTo] = useState(todayIso());
  const [includeAISummary, setIncludeAISummary] = useState(true);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<Format | null>(null);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [rawJson, setRawJson] = useState<unknown>(null);

  async function handleGeneratePreview() {
    setLoading(true);
    setPreview(null);
    setRawJson(null);
    try {
      const res = await apiFetch<{ success: boolean; data: { report: ReportPreview } }>(
        '/ai/report',
        {
          method: 'POST',
          body: JSON.stringify({
            audience,
            periodFrom,
            periodTo,
            format: 'JSON',
            includeAISummary,
            ...(teamId ? { teamId } : {}),
          }),
        },
      );
      setPreview(res.data.report);
      setRawJson(res.data.report);
      toast('success', t('toastPreviewGenerated'));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('toastUnknownError');
      toast('error', `${t('toastError')}: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(format: 'PDF' | 'DOCX') {
    setDownloading(format);
    try {
      const token = getAccessToken();
      if (!token) {
        toast('error', t('toastSessionExpired'));
        return;
      }

      const res = await fetch(`${API_BASE_URL}${API_PREFIX}/ai/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          audience,
          periodFrom,
          periodTo,
          format,
          includeAISummary,
          ...(teamId ? { teamId } : {}),
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const teamSlug = teamId ? `-${(teams.find((t) => t.id === teamId)?.name || 'team').toLowerCase().replace(/\s+/g, '_')}` : '';
      a.download = `report-${audience.toLowerCase()}${teamSlug}-${periodFrom}_${periodTo}.${format.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast('success', t('toastDownloaded', { format }));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('toastDownloadError');
      toast('error', `${t('toastError')} ${format}: ${message}`);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
        </div>
        <Link
          href="/dashboard/reports/schedules"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700"
        >
          <CalendarClock className="h-4 w-4" />
          {t('schedules')}
        </Link>
      </div>

      {/* ─── Form ─────────────────────────────────────── */}
      <div className="card space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <FileText className="h-5 w-5 text-teal-600" />
          {t('configureReport')}
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label={t('audience')}
            options={AUDIENCE_OPTIONS}
            value={audience}
            onChange={(e) => setAudience(e.target.value as Audience)}
          />
          <Select
            label={t('team')}
            options={[
              { value: '', label: t('allTeams') },
              ...teams.map((t) => ({ value: t.id, label: t.name })),
            ]}
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
          />
          <Input
            label={t('from')}
            type="date"
            value={periodFrom}
            onChange={(e) => setPeriodFrom(e.target.value)}
          />
          <Input
            label={t('to')}
            type="date"
            value={periodTo}
            onChange={(e) => setPeriodTo(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={includeAISummary}
              onChange={(e) => setIncludeAISummary(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500"
            />
            {t('includeAISummary')}
          </label>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleGeneratePreview}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            {loading ? t('generating') : t('preview')}
          </button>
          <button
            type="button"
            onClick={() => handleDownload('PDF')}
            disabled={downloading !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloading === 'PDF' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t('downloadPdf')}
          </button>
          <button
            type="button"
            onClick={() => handleDownload('DOCX')}
            disabled={downloading !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloading === 'DOCX' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t('downloadDocx')}
          </button>
        </div>
      </div>

      {/* ─── Preview ──────────────────────────────────── */}
      {preview && (
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('preview')}{preview.metadata.teamName ? ` — ${preview.metadata.teamName}` : ''}
          </h2>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div>
                <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t('organization')}</p>
                <p className="font-medium text-slate-900 dark:text-white">{preview.metadata.organizationName}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t('audience')}</p>
                <p className="font-medium text-slate-900 dark:text-white">{preview.metadata.audience}</p>
              </div>
              {preview.metadata.teamName && (
                <div>
                  <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t('team')}</p>
                  <p className="font-medium text-slate-900 dark:text-white">{preview.metadata.teamName}</p>
                </div>
              )}
              <div>
                <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t('periodLabel')}</p>
                <p className="font-medium text-slate-900 dark:text-white">
                  {preview.metadata.periodFrom} → {preview.metadata.periodTo}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t('generatedBy')}</p>
                <p className="font-medium text-slate-900 dark:text-white">{preview.metadata.generatedBy}</p>
              </div>
            </div>
          </div>

          {preview.summary && (
            <div className="rounded-lg border-l-4 border-indigo-500 bg-indigo-50 p-4">
              <p className="text-xs font-semibold uppercase text-indigo-700">{t('aiSummary')}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{preview.summary}</p>
            </div>
          )}

          {preview.kpis && preview.kpis.length > 0 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {preview.kpis.map((kpi, i) => (
                <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{kpi.label}</p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">{kpi.value}</p>
                </div>
              ))}
            </div>
          )}

          <details className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('viewFullJson')}
            </summary>
            <pre className="max-h-96 overflow-auto px-4 py-2 text-xs text-slate-700 dark:text-slate-300">
              {JSON.stringify(rawJson, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
