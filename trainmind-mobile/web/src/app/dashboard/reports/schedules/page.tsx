'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Play,
  Pause,
  Pencil,
  Trash2,
  Loader2,
  CalendarClock,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCw,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { apiFetch } from '@/lib/auth/fetch';

// ─── Types ───────────────────────────────────────────────

interface Schedule {
  id: string;
  name: string;
  audience: string;
  format: string;
  cronExpression: string;
  timezone: string;
  periodDays: number;
  recipients: string[];
  includeAISummary: boolean;
  isActive: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  nextRunAt: string | null;
  createdAt: string;
  createdBy: { id: string; firstName: string; lastName: string; email: string };
  _count: { runs: number };
}

interface ScheduleForm {
  name: string;
  audience: string;
  format: string;
  cronExpression: string;
  timezone: string;
  periodDays: number;
  recipients: string;
  includeAISummary: boolean;
  isActive: boolean;
}

const EMPTY_FORM: ScheduleForm = {
  name: '',
  audience: 'STAFF',
  format: 'PDF',
  cronExpression: '0 8 * * 1',
  timezone: 'Europe/Rome',
  periodDays: 7,
  recipients: '',
  includeAISummary: true,
  isActive: true,
};

// Option arrays are built inside the component to access t()

// ─── Helpers ─────────────────────────────────────────────

// cronToHuman is now inside the component to access CRON_PRESETS

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// StatusBadge is now inside the component to access t()

// ─── Page ────────────────────────────────────────────────

export default function SchedulesPage() {
  const { toast } = useToast();
  const t = useTranslations('reports');
  const locale = useLocale();

  const AUDIENCE_OPTIONS = [
    { value: 'STAFF', label: t('audienceStaff') },
    { value: 'MEDICAL', label: t('audienceMedical') },
    { value: 'TRAINER', label: t('audienceTrainer') },
  ];

  const FORMAT_OPTIONS = [
    { value: 'PDF', label: 'PDF' },
    { value: 'DOCX', label: 'DOCX' },
    { value: 'JSON', label: 'JSON' },
  ];

  const CRON_PRESETS = [
    { value: '0 8 * * 1', label: t('cronMonday8') },
    { value: '0 8 * * 1-5', label: t('cronWeekdays8') },
    { value: '0 9 1 * *', label: t('cronFirstOfMonth9') },
    { value: '0 18 * * 5', label: t('cronFriday18') },
    { value: 'custom', label: t('cronCustom') },
  ];

  const PERIOD_OPTIONS = [
    { value: '7', label: t('lastNDays', { n: 7 }) },
    { value: '14', label: t('lastNDays', { n: 14 }) },
    { value: '30', label: t('lastNDays', { n: 30 }) },
    { value: '90', label: t('lastNDays', { n: 90 }) },
  ];

  function cronToHuman(expr: string): string {
    const preset = CRON_PRESETS.find((p) => p.value === expr);
    if (preset) return preset.label;
    return `Cron: ${expr}`;
  }

  function StatusBadge({ status }: { status: string | null }) {
    if (!status) return <span className="text-xs text-slate-400 dark:text-slate-500">{t('neverRun')}</span>;
    const cfg: Record<string, { icon: React.ReactNode; cls: string; label: string }> = {
      SUCCESS: {
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        cls: 'bg-emerald-50 text-emerald-700',
        label: t('statusOk'),
      },
      FAILED: {
        icon: <XCircle className="h-3.5 w-3.5" />,
        cls: 'bg-red-50 text-red-700',
        label: t('statusFailed'),
      },
      SKIPPED: {
        icon: <Clock className="h-3.5 w-3.5" />,
        cls: 'bg-amber-50 text-amber-700',
        label: t('statusSkipped'),
      },
    };
    const c = cfg[status] ?? cfg.SKIPPED;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c.cls}`}>
        {c.icon} {c.label}
      </span>
    );
  }

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [form, setForm] = useState<ScheduleForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [useCustomCron, setUseCustomCron] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Fetch ──
  const fetchSchedules = useCallback(async () => {
    try {
      const res = await apiFetch<{ success: boolean; data: { schedules: Schedule[] } }>(
        '/reports/schedules',
      );
      setSchedules(res.data.schedules);
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('toastLoadError'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // ── Open create / edit ──
  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setUseCustomCron(false);
    setShowModal(true);
  }

  function openEdit(s: Schedule) {
    setEditing(s);
    const isPreset = CRON_PRESETS.some((p) => p.value === s.cronExpression);
    setUseCustomCron(!isPreset);
    setForm({
      name: s.name,
      audience: s.audience,
      format: s.format,
      cronExpression: s.cronExpression,
      timezone: s.timezone,
      periodDays: s.periodDays,
      recipients: s.recipients.join(', '),
      includeAISummary: s.includeAISummary,
      isActive: s.isActive,
    });
    setShowModal(true);
  }

  // ── Submit create/update ──
  async function handleSubmit() {
    const recipientList = form.recipients
      .split(/[,;\s]+/)
      .map((r) => r.trim())
      .filter(Boolean);

    if (!form.name.trim()) {
      toast('error', t('toastNameRequired'));
      return;
    }
    if (recipientList.length === 0) {
      toast('error', t('toastRecipientsRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        audience: form.audience,
        format: form.format,
        cronExpression: form.cronExpression,
        timezone: form.timezone,
        periodDays: form.periodDays,
        recipients: recipientList,
        includeAISummary: form.includeAISummary,
        isActive: form.isActive,
      };

      if (editing) {
        await apiFetch(`/reports/schedules/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast('success', t('toastScheduleUpdated'));
      } else {
        await apiFetch('/reports/schedules', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast('success', t('toastScheduleCreated'));
      }
      setShowModal(false);
      fetchSchedules();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('toastSaveError'));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Toggle active ──
  async function toggleActive(s: Schedule) {
    try {
      await apiFetch(`/reports/schedules/${s.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      toast('success', s.isActive ? t('toastSchedulePaused') : t('toastScheduleReactivated'));
      fetchSchedules();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('toastToggleError'));
    }
  }

  // ── Run now ──
  async function runNow(s: Schedule) {
    setRunningId(s.id);
    try {
      await apiFetch(`/reports/schedules/${s.id}/run`, { method: 'POST' });
      toast('success', t('toastReportSent', { name: s.name }));
      fetchSchedules();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('toastManualRunFailed'));
    } finally {
      setRunningId(null);
    }
  }

  // ── Delete ──
  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await apiFetch(`/reports/schedules/${id}`, { method: 'DELETE' });
      toast('success', t('toastScheduleDeleted'));
      fetchSchedules();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('toastDeleteError'));
    } finally {
      setDeletingId(null);
    }
  }

  // ── Form field updater ──
  function setField<K extends keyof ScheduleForm>(key: K, value: ScheduleForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ─── Render ────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/reports"
            className="rounded-lg p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('schedulesSubtitle')}</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
        >
          <Plus className="h-4 w-4" />
          {t('newSchedule')}
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        </div>
      ) : schedules.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16">
          <CalendarClock className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('noSchedules')}</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            {t('noSchedulesDesc')}
          </p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            {t('createSchedule')}
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="table-scroll"><table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">{t('colName')}</th>
                <th className="px-4 py-3">{t('audience')}</th>
                <th className="px-4 py-3">{t('colFrequency')}</th>
                <th className="px-4 py-3">{t('colRecipients')}</th>
                <th className="px-4 py-3">{t('colLastRun')}</th>
                <th className="px-4 py-3">{t('colNextRun')}</th>
                <th className="px-4 py-3">{t('colStatus')}</th>
                <th className="px-4 py-3 text-right">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {schedules.map((s) => (
                <tr key={s.id} className={!s.isActive ? 'opacity-50' : ''}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 dark:text-white">{s.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {s.format} · {s.periodDays}gg
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {AUDIENCE_OPTIONS.find((a) => a.value === s.audience)?.label ?? s.audience}
                  </td>
                  <td className="px-4 py-3 text-xs">{cronToHuman(s.cronExpression)}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-600 dark:text-slate-400">{s.recipients.length} email</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{fmtDate(s.lastRunAt, locale)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{fmtDate(s.nextRunAt, locale)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.lastRunStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => runNow(s)}
                        disabled={runningId === s.id}
                        title={t('runNow')}
                        className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700 hover:text-teal-700 disabled:opacity-50"
                      >
                        {runningId === s.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCw className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => toggleActive(s)}
                        title={s.isActive ? t('suspend') : t('reactivate')}
                        className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700 hover:text-amber-600"
                      >
                        {s.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => openEdit(s)}
                        title={t('editLabel')}
                        className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-300"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        disabled={deletingId === s.id}
                        title={t('deleteLabel')}
                        className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        {deletingId === s.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? t('editSchedule') : t('newSchedule')}
        size="lg"
        footer={
          <>
            <button
              onClick={() => setShowModal(false)}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700"
            >
              {t('cancelLabel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? t('saveChanges') : t('createLabel')}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={t('scheduleName')}
            placeholder={t('scheduleNamePlaceholder')}
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('audience')}
              options={AUDIENCE_OPTIONS}
              value={form.audience}
              onChange={(e) => setField('audience', e.target.value)}
            />
            <Select
              label={t('format')}
              options={FORMAT_OPTIONS}
              value={form.format}
              onChange={(e) => setField('format', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('colFrequency')}
              options={CRON_PRESETS}
              value={useCustomCron ? 'custom' : form.cronExpression}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setUseCustomCron(true);
                } else {
                  setUseCustomCron(false);
                  setField('cronExpression', e.target.value);
                }
              }}
            />
            <Select
              label={t('dataPeriod')}
              options={PERIOD_OPTIONS}
              value={String(form.periodDays)}
              onChange={(e) => setField('periodDays', Number(e.target.value))}
            />
          </div>

          {useCustomCron && (
            <Input
              label={t('cronExpression')}
              placeholder="0 8 * * 1"
              value={form.cronExpression}
              onChange={(e) => setField('cronExpression', e.target.value)}
            />
          )}

          <Input
            label={t('recipients')}
            placeholder="trainer@team.com, medico@team.com"
            value={form.recipients}
            onChange={(e) => setField('recipients', e.target.value)}
          />

          <div className="flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.includeAISummary}
                onChange={(e) => setField('includeAISummary', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500"
              />
              Includi riassunto AI
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setField('isActive', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-teal-600 focus:ring-teal-500"
              />
              Attiva subito
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
