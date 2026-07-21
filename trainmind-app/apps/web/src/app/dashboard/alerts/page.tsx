'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Bell,
  AlertTriangle,
  Info,
  XCircle,
  CheckCircle2,
  CheckCheck,
  Filter,
  Plus,
  Settings2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Play,
  X,
  ChevronLeft,
  ChevronRight,
  Zap,
  Shield,
} from 'lucide-react';
import { apiFetch } from '@/lib/auth/fetch';
import { useToast } from '@/components/ui/toast';

// ─── Types ──────────────────────────────────────────────

interface Notification {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  data: Record<string, unknown> | null;
  alertRule: { name: string; type: string } | null;
}

interface AlertRule {
  id: string;
  name: string;
  description: string | null;
  type: string;
  condition: { metric: string; operator: string; threshold: number };
  severity: string;
  isActive: boolean;
  athleteId: string | null;
  cooldownMinutes: number;
  lastTriggeredAt: string | null;
  createdAt: string;
  athlete: { id: string; firstName: string; lastName: string } | null;
  _count: { notifications: number };
}

interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
}

interface NotificationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  unreadCount: number;
}

// ─── Constants ──────────────────────────────────────────

const severityIcons: Record<string, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  danger: XCircle,
  success: CheckCircle2,
};

const severityColors: Record<string, string> = {
  info: 'text-blue-600 bg-blue-50 border-blue-200',
  warning: 'text-amber-600 bg-amber-50 border-amber-200',
  danger: 'text-red-600 bg-red-50 border-red-200',
  success: 'text-green-600 bg-green-50 border-green-200',
};

const severityBadge: Record<string, string> = {
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  success: 'bg-green-100 text-green-700',
};

const RULE_TYPE_KEYS: Record<string, string> = {
  acwr_high: 'ruleTypeACWRHigh',
  acwr_danger: 'ruleTypeACWRDanger',
  wellness_low: 'ruleTypeWellnessLow',
  missed_session: 'ruleTypeMissedSession',
  missed_wellness: 'ruleTypeMissingWellness',
  streak: 'ruleTypeConsecutive',
  custom: 'ruleTypeCustom',
};

const METRIC_LABEL_KEYS: Record<string, string | null> = {
  acwr: null, // ACWR is international term — no translation
  wellness_score: 'metricWellnessScore',
  fatigue: 'metricFatigue',
  soreness: 'metricSoreness',
};

const OPERATOR_KEYS: Record<string, string> = {
  '>': 'opGreater',
  '<': 'opLess',
  '>=': 'opGreaterEq',
  '<=': 'opLessEq',
  '==': 'opEqual',
};

// ─── Alert Rule Presets ─────────────────────────────────

const RULE_PRESET_DEFS = [
  { nameKey: 'presetACWRHigh', type: 'acwr_high' as const, condition: { metric: 'acwr', operator: '>' as const, threshold: 1.3 }, severity: 'warning' as const },
  { nameKey: 'presetACWRDanger', type: 'acwr_danger' as const, condition: { metric: 'acwr', operator: '>' as const, threshold: 1.5 }, severity: 'danger' as const },
  { nameKey: 'presetWellnessLow', type: 'wellness_low' as const, condition: { metric: 'wellness_score', operator: '<' as const, threshold: 40 }, severity: 'warning' as const },
  { nameKey: 'presetFatigueHigh', type: 'custom' as const, condition: { metric: 'fatigue', operator: '>' as const, threshold: 4 }, severity: 'warning' as const },
];

// ─── Page Component ─────────────────────────────────────

export default function AlertsPage() {
  const t = useTranslations('alerts');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { toast } = useToast();
  const [tab, setTab] = useState<'notifications' | 'rules'>('notifications');

  // Localized lookup tables
  const ruleTypeLabels = useMemo<Record<string, string>>(() => {
    const r: Record<string, string> = {};
    for (const [k, key] of Object.entries(RULE_TYPE_KEYS)) r[k] = t(key);
    return r;
  }, [t]);
  const metricLabels = useMemo<Record<string, string>>(() => {
    const r: Record<string, string> = {};
    for (const [k, key] of Object.entries(METRIC_LABEL_KEYS)) r[k] = key ? t(key) : k.toUpperCase();
    return r;
  }, [t]);
  const operatorLabels = useMemo<Record<string, string>>(() => {
    const r: Record<string, string> = {};
    for (const [k, key] of Object.entries(OPERATOR_KEYS)) r[k] = t(key);
    return r;
  }, [t]);
  const rulePresets = useMemo(
    () => RULE_PRESET_DEFS.map((d) => ({ ...d, name: t(d.nameKey) })),
    [t]
  );

  // Notification state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [meta, setMeta] = useState<NotificationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  // Alert rules state
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [checkingAlerts, setCheckingAlerts] = useState(false);

  // ─── Data Fetching ──────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    setLoadingNotifs(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (severityFilter) params.set('severity', severityFilter);
      if (unreadOnly) params.set('unreadOnly', 'true');
      const res = await apiFetch<{ data: Notification[]; meta: NotificationMeta }>(`/notifications?${params}`);
      setNotifications(res.data || []);
      setMeta(res.meta || null);
    } catch { /* ignore */ }
    setLoadingNotifs(false);
  }, [page, severityFilter, unreadOnly]);

  const fetchRules = async () => {
    setLoadingRules(true);
    try {
      const res = await apiFetch<{ data: AlertRule[] }>('/alerts/rules');
      setRules(res.data || []);
    } catch { /* ignore */ }
    setLoadingRules(false);
  };

  const fetchAthletes = async () => {
    try {
      const res = await apiFetch<{ data: Athlete[] }>('/athletes?limit=100');
      setAthletes(res.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Sync when topbar marks notifications as read
  useEffect(() => {
    const onSync = () => fetchNotifications();
    window.addEventListener('notifications-changed', onSync);
    return () => window.removeEventListener('notifications-changed', onSync);
  }, [fetchNotifications]);

  useEffect(() => {
    if (tab === 'rules') {
      fetchRules();
      fetchAthletes();
    }
  }, [tab]);

  // ─── Notification Actions ───────────────────────────────

  const markAsRead = async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PUT', body: JSON.stringify({}) });
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n));
      if (meta) setMeta({ ...meta, unreadCount: Math.max(0, meta.unreadCount - 1) });
      window.dispatchEvent(new Event('notifications-changed'));
    } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    try {
      await apiFetch('/notifications/read-all', { method: 'PUT', body: JSON.stringify({}) });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      if (meta) setMeta({ ...meta, unreadCount: 0 });
      window.dispatchEvent(new Event('notifications-changed'));
      toast('success', t('markAllSuccess'));
    } catch { /* ignore */ }
  };

  // ─── Alert Rule Actions ─────────────────────────────────

  const toggleRule = async (rule: AlertRule) => {
    try {
      await apiFetch(`/alerts/rules/${rule.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, isActive: !r.isActive } : r));
      toast('success', !rule.isActive ? t('ruleStatusActivated') : t('ruleStatusDeactivated'));
    } catch {
      toast('error', t('updateError'));
    }
  };

  const deleteRule = async (id: string) => {
    try {
      await apiFetch(`/alerts/rules/${id}`, { method: 'DELETE' });
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast('success', t('ruleDeleted'));
    } catch {
      toast('error', t('ruleDeleteError'));
    }
  };

  const runAlertCheck = async () => {
    setCheckingAlerts(true);
    try {
      const res = await apiFetch<{ data: { checked: number; triggered: number } }>('/alerts/check', { method: 'POST', body: JSON.stringify({}) });
      toast('success', t('checkSummary', { checked: res.data.checked, triggered: res.data.triggered }));
      fetchNotifications();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('checkError'));
    }
    setCheckingAlerts(false);
  };

  // ─── Time Formatting ───────────────────────────────────

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return t('now');
    if (diffMin < 60) return t('minutesAgo', { n: diffMin });
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return t('hoursAgo', { n: diffH });
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return t('daysAgo', { n: diffD });
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runAlertCheck}
            disabled={checkingAlerts}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700 disabled:opacity-50"
          >
            {checkingAlerts ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {t('runCheck')}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-lg bg-slate-100 dark:bg-slate-700 p-1">
        <button
          onClick={() => setTab('notifications')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'notifications' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white'
          }`}
        >
          <Bell className="h-4 w-4" />
          {t('notifications')}
          {meta && meta.unreadCount > 0 && (
            <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-2xs font-bold text-white">
              {meta.unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('rules')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'rules' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white'
          }`}
        >
          <Settings2 className="h-4 w-4" />
          {t('alertRules')}
          <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-2xs font-medium text-slate-600 dark:text-slate-400">
            {rules.length}
          </span>
        </button>
      </div>

      {/* ═══ Notifications Tab ═══ */}
      {tab === 'notifications' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
            <Filter className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <div className="flex gap-1">
              {['', 'info', 'warning', 'danger', 'success'].map((s) => (
                <button
                  key={s}
                  onClick={() => { setSeverityFilter(s); setPage(1); }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    severityFilter === s
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {s === '' ? t('severityAll') : s === 'info' ? t('severityInfo') : s === 'warning' ? t('severityWarning') : s === 'danger' ? t('severityDanger') : t('severitySuccess')}
                </button>
              ))}
            </div>
            <div className="h-5 w-px bg-slate-200" />
            <button
              onClick={() => { setUnreadOnly(!unreadOnly); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                unreadOnly ? 'bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {t('unreadOnly')}
            </button>
            {meta && meta.unreadCount > 0 && (
              <>
                <div className="flex-1" />
                <button
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-800"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  {t('markAllReadShort')}
                </button>
              </>
            )}
          </div>

          {/* Notification List */}
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            {loadingNotifs ? (
              <div className="flex h-40 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2">
                <Bell className="h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-400 dark:text-slate-500">{t('noNotifications')}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((n) => {
                  const Icon = severityIcons[n.severity] || Info;
                  const colors = severityColors[n.severity] || severityColors.info;
                  const badge = severityBadge[n.severity] || severityBadge.info;
                  return (
                    <div
                      key={n.id}
                      className={`flex gap-4 px-5 py-4 transition-colors ${!n.isRead ? 'bg-teal-50/40' : 'hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700'}`}
                    >
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border ${colors}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm ${!n.isRead ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                              {n.title}
                            </p>
                            <span className={`rounded-full px-2 py-0.5 text-2xs font-medium ${badge}`}>
                              {n.severity}
                            </span>
                          </div>
                          <span className="flex-shrink-0 text-xs text-slate-400 dark:text-slate-500">{formatTime(n.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{n.message}</p>
                        <div className="mt-2 flex items-center gap-3">
                          {n.alertRule && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-2xs text-slate-500 dark:text-slate-400">
                              <Zap className="h-3 w-3" />
                              {n.alertRule.name}
                            </span>
                          )}
                          {n.data && Boolean((n.data as Record<string, unknown>).athleteName) && (
                            <span className="text-2xs text-slate-400 dark:text-slate-500">
                              {t('athletePrefix')} {String((n.data as Record<string, unknown>).athleteName)}
                            </span>
                          )}
                          {!n.isRead && (
                            <button
                              onClick={() => markAsRead(n.id)}
                              className="ml-auto text-2xs font-medium text-teal-600 hover:text-teal-700"
                            >
                              {t('markAsRead')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 px-5 py-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('pagination', { page: meta.page, total: meta.totalPages, count: meta.total })}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700 hover:text-slate-600 dark:text-slate-400 disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                    disabled={page === meta.totalPages}
                    className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700 hover:text-slate-600 dark:text-slate-400 disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Alert Rules Tab ═══ */}
      {tab === 'rules' && (
        <div className="space-y-4">
          {/* Quick Presets */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('presetRules')}</h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('presetRulesDesc')}</p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-teal-700"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('custom')}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {rulePresets.map((preset) => (
                <button
                  key={preset.type + preset.condition.threshold}
                  onClick={async () => {
                    try {
                      await apiFetch('/alerts/rules', {
                        method: 'POST',
                        body: JSON.stringify(preset),
                      });
                      toast('success', `${t('ruleCreated')}: "${preset.name}"`);
                      fetchRules();
                    } catch {
                      toast('error', t('ruleCreateError'));
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:shadow-sm ${
                    preset.severity === 'danger'
                      ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                      : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  <Shield className="h-3.5 w-3.5" />
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Rules List */}
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            {loadingRules ? (
              <div className="flex h-40 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
              </div>
            ) : rules.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2">
                <Settings2 className="h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-400 dark:text-slate-500">{t('noRules')}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {rules.map((rule) => {
                  const cond = rule.condition;
                  return (
                    <div key={rule.id} className={`flex items-center gap-4 px-5 py-4 ${!rule.isActive ? 'opacity-50' : ''}`}>
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                        rule.severity === 'danger' ? 'bg-red-50 text-red-500' : rule.severity === 'warning' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'
                      }`}>
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{rule.name}</p>
                          <span className={`rounded-full px-2 py-0.5 text-2xs font-medium ${severityBadge[rule.severity] || severityBadge.info}`}>
                            {rule.severity}
                          </span>
                          <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-2xs text-slate-500 dark:text-slate-400">
                            {ruleTypeLabels[rule.type] || rule.type}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-medium">{metricLabels[cond.metric] || cond.metric}</span>{' '}
                          {operatorLabels[cond.operator] || cond.operator}{' '}
                          <span className="font-medium">{cond.threshold}</span>
                          {rule.athlete && ` — ${rule.athlete.firstName} ${rule.athlete.lastName}`}
                          {!rule.athlete && ` — ${t('allAthletes')}`}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-2xs text-slate-400 dark:text-slate-500">
                          <span>{rule._count.notifications} notifiche generate</span>
                          <span>Cooldown: {rule.cooldownMinutes / 60}h</span>
                          {rule.lastTriggeredAt && <span>{t('lastTrigger')} {formatTime(rule.lastTriggeredAt)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleRule(rule)}
                          className="rounded-lg p-2 text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700 hover:text-slate-600 dark:text-slate-400"
                          title={rule.isActive ? t('deactivate') : t('activate')}
                        >
                          {rule.isActive ? <ToggleRight className="h-5 w-5 text-teal-600" /> : <ToggleLeft className="h-5 w-5" />}
                        </button>
                        <button
                          onClick={() => deleteRule(rule.id)}
                          className="rounded-lg p-2 text-slate-400 dark:text-slate-500 transition-colors hover:bg-red-50 hover:text-red-500"
                          title={tCommon('delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Create Rule Modal ═══ */}
      {showCreateModal && (
        <CreateRuleModal
          athletes={athletes}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); fetchRules(); toast('success', t('ruleCreated')); }}
        />
      )}
    </div>
  );
}

// ─── Create Rule Modal ──────────────────────────────────

function CreateRuleModal({
  athletes,
  onClose,
  onCreated,
}: {
  athletes: Athlete[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations('alerts');
  const tCommon = useTranslations('common');
  const ruleTypeLabels = useMemo<Record<string, string>>(() => {
    const r: Record<string, string> = {};
    for (const [k, key] of Object.entries(RULE_TYPE_KEYS)) r[k] = t(key);
    return r;
  }, [t]);
  const metricLabels = useMemo<Record<string, string>>(() => {
    const r: Record<string, string> = {};
    for (const [k, key] of Object.entries(METRIC_LABEL_KEYS)) r[k] = key ? t(key) : k.toUpperCase();
    return r;
  }, [t]);
  const operatorLabels = useMemo<Record<string, string>>(() => {
    const r: Record<string, string> = {};
    for (const [k, key] of Object.entries(OPERATOR_KEYS)) r[k] = t(key);
    return r;
  }, [t]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('custom');
  const [metric, setMetric] = useState('acwr');
  const [operator, setOperator] = useState('>');
  const [threshold, setThreshold] = useState(1.5);
  const [severity, setSeverity] = useState('warning');
  const [athleteId, setAthleteId] = useState('');
  const [cooldownH, setCooldownH] = useState(24);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await apiFetch('/alerts/rules', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          type,
          condition: { metric, operator, threshold },
          severity,
          athleteId: athleteId || undefined,
          cooldownMinutes: cooldownH * 60,
        }),
      });
      onCreated();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('newRule')}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700 hover:text-slate-600 dark:text-slate-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {/* Nome */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('ruleName')}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('ruleNamePlaceholder')}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Descrizione */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{tCommon('description')}</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('descPlaceholder')}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Tipo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('ruleType')}</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:border-teal-500 focus:outline-none"
              >
                {Object.entries(ruleTypeLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('severity')}</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:border-teal-500 focus:outline-none"
              >
                <option value="info">{t('severityInfo')}</option>
                <option value="warning">{t('severityWarning')}</option>
                <option value="danger">{t('severityDanger')}</option>
              </select>
            </div>
          </div>

          {/* Condizione */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('threshold')}</label>
            <div className="flex gap-2">
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:border-teal-500 focus:outline-none"
              >
                {Object.entries(metricLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-2 text-center text-sm text-slate-700 dark:text-slate-300 focus:border-teal-500 focus:outline-none"
              >
                {Object.entries(operatorLabels).map(([k]) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <input
                type="number"
                step="0.1"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-24 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Atleta + Cooldown */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{tCommon('athlete')}</label>
              <select
                value={athleteId}
                onChange={(e) => setAthleteId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:border-teal-500 focus:outline-none"
              >
                <option value="">{t('allAthletes')}</option>
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Cooldown (h)</label>
              <input
                type="number"
                min={1}
                max={168}
                value={cooldownH}
                onChange={(e) => setCooldownH(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-700 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
          >
            {saving && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
            {t('newRule')}
          </button>
        </div>
      </div>
    </div>
  );
}
