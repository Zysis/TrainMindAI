'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Users, Shield, AlertTriangle, TrendingUp, Heart } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { apiFetch } from '@/lib/auth/fetch';
import { Badge } from '@/components/ui/badge';

interface AthleteOverview {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  wellnessScore: number | null;
  latestWellness: {
    sleepQuality: number;
    fatigue: number;
    soreness: number;
    stress: number;
    mood: number;
  } | null;
  acwr: number;
  riskZone: 'low' | 'optimal' | 'high' | 'danger';
  sessionsThisWeek: number;
  acuteLoad: number;
  chronicLoad: number;
}

interface TeamSummary {
  totalAthletes: number;
  zoneCounts: { low: number; optimal: number; high: number; danger: number };
  avgTeamWellness: number | null;
}

interface TeamOverviewData {
  athletes: AthleteOverview[];
  summary: TeamSummary;
}

const ZONE_STYLE_DEFS = {
  low: { labelKey: 'lowLoad', color: '#3b82f6', variant: 'default' as const, icon: Shield },
  optimal: { labelKey: 'optimal', color: '#22c55e', variant: 'success' as const, icon: TrendingUp },
  high: { labelKey: 'attention', color: '#f59e0b', variant: 'warning' as const, icon: AlertTriangle },
  danger: { labelKey: 'risk', color: '#ef4444', variant: 'danger' as const, icon: AlertTriangle },
} as const;

interface TeamOverviewProps {
  teamId?: string | null;
}

export function TeamOverview({ teamId }: TeamOverviewProps) {
  const t = useTranslations('analyticsExt');
  const tCommon = useTranslations('common');
  const zoneStyles = useMemo(
    () => ({
      low: { ...ZONE_STYLE_DEFS.low, label: t(ZONE_STYLE_DEFS.low.labelKey) },
      optimal: { ...ZONE_STYLE_DEFS.optimal, label: t(ZONE_STYLE_DEFS.optimal.labelKey) },
      high: { ...ZONE_STYLE_DEFS.high, label: t(ZONE_STYLE_DEFS.high.labelKey) },
      danger: { ...ZONE_STYLE_DEFS.danger, label: t(ZONE_STYLE_DEFS.danger.labelKey) },
    }),
    [t]
  );
  const [data, setData] = useState<TeamOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'risk' | 'wellness' | 'name'>('risk');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = teamId ? `?teamId=${teamId}` : '';
        const res = await apiFetch<{ data: TeamOverviewData }>(`/analytics/team-overview${params}`);
        setData(res.data);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [teamId]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card flex h-48 items-center justify-center">
        <div className="text-center">
          <Users className="mx-auto mb-2 h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-400 dark:text-slate-500">{t('noData')}</p>
        </div>
      </div>
    );
  }

  const { athletes, summary } = data;

  // Sort athletes
  const sorted = [...athletes].sort((a, b) => {
    if (sortBy === 'risk') {
      const order = { danger: 0, high: 1, optimal: 2, low: 3 };
      return order[a.riskZone] - order[b.riskZone];
    }
    if (sortBy === 'wellness') {
      return (a.wellnessScore ?? 0) - (b.wellnessScore ?? 0);
    }
    return a.lastName.localeCompare(b.lastName);
  });

  // Pie chart data
  const pieData = [
    { name: t('optimal'), value: summary.zoneCounts.optimal, color: '#22c55e' },
    { name: t('lowLoad'), value: summary.zoneCounts.low, color: '#3b82f6' },
    { name: t('attention'), value: summary.zoneCounts.high, color: '#f59e0b' },
    { name: t('risk'), value: summary.zoneCounts.danger, color: '#ef4444' },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card text-center">
          <Users className="mx-auto mb-2 h-6 w-6 text-slate-400 dark:text-slate-500" />
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{summary.totalAthletes}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('activeAthletes')}</p>
        </div>
        <div className="card text-center">
          <Heart className="mx-auto mb-2 h-6 w-6 text-red-400" />
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            {summary.avgTeamWellness !== null ? `${summary.avgTeamWellness}%` : '--'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('teamWellness')}</p>
        </div>
        <div className="card text-center">
          <TrendingUp className="mx-auto mb-2 h-6 w-6 text-green-500" />
          <p className="text-3xl font-bold text-green-600">{summary.zoneCounts.optimal}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('inOptimalZone')}</p>
        </div>
        <div className="card text-center">
          <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-red-500" />
          <p className="text-3xl font-bold text-red-600">{summary.zoneCounts.high + summary.zoneCounts.danger}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('inRiskZone')}</p>
        </div>
      </div>

      {/* Pie chart + Zone breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">{t('teamAcwrDistribution')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number, name: string) => [value, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {pieData.map((d) => (
              <span key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name}: {d.value}
              </span>
            ))}
          </div>
        </div>

        {/* At-risk athletes */}
        <div className="card">
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">{t('athletesToMonitor')}</h3>
          {athletes.filter((a) => a.riskZone === 'high' || a.riskZone === 'danger' || (a.wellnessScore !== null && a.wellnessScore < 50)).length === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <div className="text-center">
                <Shield className="mx-auto mb-2 h-8 w-8 text-green-400" />
                <p className="text-sm text-green-600 font-medium">{t('noAthletesAtRisk')}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {athletes
                .filter((a) => a.riskZone === 'high' || a.riskZone === 'danger' || (a.wellnessScore !== null && a.wellnessScore < 50))
                .slice(0, 5)
                .map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-900 px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        {a.firstName} {a.lastName}
                      </span>
                      <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{a.position}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.wellnessScore !== null && a.wellnessScore < 50 && (
                        <span className="text-xs font-medium text-red-600">W: {a.wellnessScore}%</span>
                      )}
                      <Badge variant={zoneStyles[a.riskZone].variant}>
                        ACWR {a.acwr.toFixed(2)}
                      </Badge>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Full athlete table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{t('allAthletes')}</h3>
          <div className="flex gap-1">
            {[
              { key: 'risk', label: t('risk') },
              { key: 'wellness', label: t('wellness') },
              { key: 'name', label: t('name') },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key as typeof sortBy)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  sortBy === opt.key ? 'bg-teal-100 text-teal-700' : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="table-scroll"><table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                <th className="pb-3 font-medium text-slate-500 dark:text-slate-400">{tCommon('athlete')}</th>
                <th className="pb-3 text-center font-medium text-slate-500 dark:text-slate-400">{t('wellness')}</th>
                <th className="pb-3 text-center font-medium text-slate-500 dark:text-slate-400">ACWR</th>
                <th className="pb-3 text-center font-medium text-slate-500 dark:text-slate-400">{t('zone')}</th>
                <th className="pb-3 text-center font-medium text-slate-500 dark:text-slate-400">{t('sessions7d')}</th>
                <th className="pb-3 text-center font-medium text-slate-500 dark:text-slate-400">Carico acuto</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 dark:border-slate-700">
                  <td className="py-2.5">
                    <span className="font-medium text-slate-900 dark:text-white">{a.firstName} {a.lastName}</span>
                    <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{a.position}</span>
                  </td>
                  <td className="py-2.5 text-center">
                    {a.wellnessScore !== null ? (
                      <span className={`text-sm font-medium ${a.wellnessScore >= 65 ? 'text-green-600' : a.wellnessScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {a.wellnessScore}%
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500">--</span>
                    )}
                  </td>
                  <td className="py-2.5 text-center font-medium text-slate-900 dark:text-white">{a.acwr.toFixed(2)}</td>
                  <td className="py-2.5 text-center">
                    <Badge variant={zoneStyles[a.riskZone].variant}>{zoneStyles[a.riskZone].label}</Badge>
                  </td>
                  <td className="py-2.5 text-center text-slate-700">{a.sessionsThisWeek}</td>
                  <td className="py-2.5 text-center text-slate-700">{a.acuteLoad}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  );
}
