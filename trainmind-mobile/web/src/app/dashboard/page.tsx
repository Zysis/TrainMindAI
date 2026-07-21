'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Shield,
  Clock,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/auth/fetch';
import { useAuth } from '@/hooks/use-auth';
import { useTeam } from '@/hooks/use-team';
import { OnboardingChecklist } from '@/components/onboarding/onboarding-checklist';
import { WellnessBar } from '@/components/dashboard/wellness-bar';
import { KpiGrid } from '@/components/dashboard/kpi-grid';
import { AiQuickActions } from '@/components/dashboard/ai-quick-actions';

// ─── Types ───────────────────────────────────────────────

interface DashboardData {
  kpis: {
    totalAthletes: number;
    activeAthletes: number;
    exerciseLibrary: number;
    sessionsLast30d: number;
    activeAlerts: number;
    activeRTPProtocols: number;
    periodizationPlans: number;
    scheduledReports: number;
  };
  wellness: {
    trend: {
      avgFatigue: number;
      avgSoreness: number;
      avgMood: number;
      avgSleep: number;
      avgStress: number;
      totalLogs: number;
    } | null;
    atRisk: Array<{ athlete: string; fatigue: number; soreness: number; mood: number }>;
    recentLogs: Array<{
      fatigue: number;
      soreness: number;
      mood: number;
      sleepQuality: number;
      stress: number;
      date: string;
      athlete: { firstName: string; lastName: string };
    }>;
  };
  injuries: {
    summary: { active: number; recovering: number; resolved: number };
    activeRTP: Array<{
      id: string;
      athlete: string;
      position: string;
      phase: string;
      injuryType: string;
      injuryLocation: string;
      severity: number;
      daysSinceStart: number;
    }>;
  };
}

// ─── Constants ───────────────────────────────────────────

const PHASE_COLORS: Record<string, string> = {
  PHASE_1: 'bg-red-100 text-red-700',
  PHASE_2: 'bg-orange-100 text-orange-700',
  PHASE_3: 'bg-amber-100 text-amber-700',
  PHASE_4: 'bg-blue-100 text-blue-700',
  PHASE_5: 'bg-indigo-100 text-indigo-700',
  CLEARED: 'bg-emerald-100 text-emerald-700',
};


// ─── Page ────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const { selectedTeamId } = useTeam();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const t = useTranslations('dashboard');
  const locale = useLocale();

  const PHASE_SHORT: Record<string, string> = {
    PHASE_1: t('phase1'),
    PHASE_2: t('phase2'),
    PHASE_3: t('phase3'),
    PHASE_4: t('phase4'),
    PHASE_5: t('phase5'),
    CLEARED: t('cleared'),
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = selectedTeamId ? `?teamId=${selectedTeamId}` : '';
        const res = await apiFetch<{ success: boolean; data: DashboardData }>(`/dashboard/overview${params}`);
        setData(res.data);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedTeamId]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  const kpis = data?.kpis;
  const wellness = data?.wellness;
  const injuries = data?.injuries;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('welcome')}, {user?.firstName || 'Coach'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('overview')}</p>
      </div>

      {/* Onboarding Checklist */}
      <OnboardingChecklist />

      {/* KPI Grids */}
      <KpiGrid kpis={kpis} injuries={injuries} t={t} />

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Wellness Trend Card */}
        <div className="card lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('wellness7d')}</h2>
            <Link href="/dashboard/wellness" className="flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-600">
              {t('detail')} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {wellness?.trend ? (
            <div className="space-y-3">
              <WellnessBar label={t('fatigue')} value={wellness.trend.avgFatigue} max={5} invert />
              <WellnessBar label={t('soreness')} value={wellness.trend.avgSoreness} max={5} invert />
              <WellnessBar label={t('mood')} value={wellness.trend.avgMood} max={5} />
              <WellnessBar label={t('sleep')} value={wellness.trend.avgSleep} max={5} />
              <WellnessBar label={t('stress')} value={wellness.trend.avgStress} max={5} invert />
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{t('logsRecorded', { count: wellness.trend.totalLogs })}</p>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">{t('noWellnessData')}</p>
          )}
        </div>

        {/* At-Risk Athletes */}
        <div className="card lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('atRiskAthletes')}</h2>
            <Badge variant={wellness?.atRisk.length ? 'danger' : 'success'}>
              {wellness?.atRisk.length ?? 0}
            </Badge>
          </div>
          {wellness?.atRisk.length ? (
            <div className="space-y-3">
              {wellness.atRisk.map((a, i: number) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-red-100 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-3">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{a.athlete}</span>
                  <div className="flex gap-2">
                    {a.fatigue >= 4 && <Badge variant="danger">{t('fatShort')}: {a.fatigue}</Badge>}
                    {a.soreness >= 4 && <Badge variant="danger">{t('sorShort')}: {a.soreness}</Badge>}
                    {a.mood <= 2 && <Badge variant="warning">{t('moodShort')}: {a.mood}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-8">
              <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-400" />
              <p className="text-sm text-slate-400 dark:text-slate-500">{t('noAtRisk')}</p>
            </div>
          )}
        </div>

        {/* Active RTP Protocols */}
        <div className="card lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('returnToPlay')}</h2>
            <Link href="/dashboard/injuries" className="flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-600">
              {t('manage')} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {injuries?.activeRTP.length ? (
            <div className="space-y-3">
              {injuries.activeRTP.map((rtp) => (
                <Link
                  key={rtp.id}
                  href="/dashboard/injuries"
                  className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-3 transition hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{rtp.athlete}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{rtp.injuryType} · {rtp.position}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PHASE_COLORS[rtp.phase] || 'bg-slate-100 dark:bg-slate-700'}`}>
                      {PHASE_SHORT[rtp.phase]}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                      <Clock className="h-3 w-3" />
                      {rtp.daysSinceStart}{t('daysShort')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-8">
              <Shield className="mb-2 h-8 w-8 text-emerald-400" />
              <p className="text-sm text-slate-400 dark:text-slate-500">{t('noActiveProtocol')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Wellness Table */}
      {wellness?.recentLogs && wellness.recentLogs.length > 0 && (
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('recentWellness')}</h2>
            <Link href="/dashboard/wellness" className="flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-600">
              {t('viewAll')} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <div className="table-scroll"><table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                  <th className="pb-2 font-medium text-slate-500 dark:text-slate-400">{t('athlete')}</th>
                  <th className="pb-2 font-medium text-slate-500 dark:text-slate-400">{t('date')}</th>
                  <th className="pb-2 text-center font-medium text-slate-500 dark:text-slate-400">{t('fatigue')}</th>
                  <th className="pb-2 text-center font-medium text-slate-500 dark:text-slate-400">{t('soreness')}</th>
                  <th className="pb-2 text-center font-medium text-slate-500 dark:text-slate-400">{t('mood')}</th>
                  <th className="pb-2 text-center font-medium text-slate-500 dark:text-slate-400">{t('sleep')}</th>
                </tr>
              </thead>
              <tbody>
                {wellness.recentLogs.map((w, i: number) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="py-2.5 font-medium text-slate-900 dark:text-white">{w.athlete.firstName} {w.athlete.lastName}</td>
                    <td className="py-2.5 text-slate-500 dark:text-slate-400">{new Date(w.date).toLocaleDateString(locale)}</td>
                    <td className="py-2.5 text-center">
                      <Badge variant={w.fatigue >= 4 ? 'danger' : w.fatigue >= 3 ? 'warning' : 'success'}>{w.fatigue}/5</Badge>
                    </td>
                    <td className="py-2.5 text-center">
                      <Badge variant={w.soreness >= 4 ? 'danger' : w.soreness >= 3 ? 'warning' : 'success'}>{w.soreness}/5</Badge>
                    </td>
                    <td className="py-2.5 text-center">
                      <Badge variant={w.mood <= 2 ? 'danger' : w.mood <= 3 ? 'warning' : 'success'}>{w.mood}/5</Badge>
                    </td>
                    <td className="py-2.5 text-center">
                      <Badge variant={w.sleepQuality <= 2 ? 'danger' : w.sleepQuality <= 3 ? 'warning' : 'success'}>{w.sleepQuality}/5</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </div>
      )}

      {/* AI Quick Actions */}
      <AiQuickActions t={t} />
    </div>
  );
}
