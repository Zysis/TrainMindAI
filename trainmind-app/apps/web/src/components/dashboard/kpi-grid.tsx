'use client';

import {
  Users, Dumbbell, AlertTriangle, Calendar,
  Shield, Layers, BarChart3, Activity,
} from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';

interface KpiData {
  totalAthletes: number;
  activeAthletes: number;
  exerciseLibrary: number;
  sessionsLast30d: number;
  activeAlerts: number;
  activeRTPProtocols: number;
  periodizationPlans: number;
  scheduledReports: number;
}

interface InjurySummary {
  active: number;
  recovering: number;
  resolved: number;
}

interface KpiGridProps {
  kpis: KpiData | undefined;
  injuries: { summary: InjurySummary } | undefined;
  t: (key: string, values?: Record<string, string | number>) => string;
}

export function KpiGrid({ kpis, injuries, t }: KpiGridProps) {
  return (
    <>
      {/* KPI Grid -- row 1 */}
      <div data-tour="stat-cards" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={t('activeAthletes')} value={kpis?.totalAthletes ?? 0} subtitle={t('withRecentActivity', { count: kpis?.activeAthletes ?? 0 })} icon={Users} iconColor="bg-teal-100 text-teal-700" />
        <StatCard label={t('sessions30d')} value={kpis?.sessionsLast30d ?? 0} subtitle={t('completedSub')} icon={Calendar} iconColor="bg-blue-100 text-blue-700" />
        <StatCard label={t('exercisesLabel')} value={kpis?.exerciseLibrary ?? 0} subtitle={t('inLibrary')} icon={Dumbbell} iconColor="bg-violet-100 text-violet-700" />
        <StatCard label={t('injuriesLabel')} value={injuries?.summary.active ?? 0} subtitle={t('recoveringSub', { count: injuries?.summary.recovering ?? 0 })} icon={AlertTriangle} iconColor="bg-red-100 text-red-700" />
      </div>

      {/* KPI Grid -- row 2 (secondary) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={t('rtpProtocols')} value={kpis?.activeRTPProtocols ?? 0} subtitle={t('activeSub')} icon={Shield} iconColor="bg-amber-100 text-amber-700" />
        <StatCard label={t('periodizationPlans')} value={kpis?.periodizationPlans ?? 0} subtitle={t('configuredSub')} icon={Layers} iconColor="bg-indigo-100 text-indigo-700" />
        <StatCard label={t('scheduledReports')} value={kpis?.scheduledReports ?? 0} subtitle={t('activeSub')} icon={BarChart3} iconColor="bg-emerald-100 text-emerald-700" />
        <StatCard label={t('activeAlerts')} value={kpis?.activeAlerts ?? 0} subtitle={t('monitoringRules')} icon={Activity} iconColor="bg-pink-100 text-pink-700" />
      </div>
    </>
  );
}
