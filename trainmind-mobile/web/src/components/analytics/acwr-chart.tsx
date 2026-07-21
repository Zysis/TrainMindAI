'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';
import { AlertTriangle, Shield, TrendingUp } from 'lucide-react';
import { apiFetch } from '@/lib/auth/fetch';

interface AcwrEntry {
  athleteId: string;
  athleteName: string;
  weekEnd: string;
  acuteLoad: number;
  chronicLoad: number;
  acwr: number;
  zone: 'low' | 'optimal' | 'high' | 'danger';
}

interface AcwrChartProps {
  athleteId?: string;
  teamId?: string | null;
  days?: number;
}

const ZONE_DEFS = {
  low: { labelKey: 'zoneUndertraining', color: 'text-blue-600', bg: 'bg-blue-50', icon: Shield },
  optimal: { labelKey: 'zoneOptimal', color: 'text-green-600', bg: 'bg-green-50', icon: TrendingUp },
  high: { labelKey: 'zoneModerateRisk', color: 'text-amber-600', bg: 'bg-amber-50', icon: AlertTriangle },
  danger: { labelKey: 'zoneHighRisk', color: 'text-red-600', bg: 'bg-red-50', icon: AlertTriangle },
} as const;

export function AcwrChart({ athleteId, teamId, days = 60 }: AcwrChartProps) {
  const locale = useLocale();
  const t = useTranslations('analyticsExt');
  const tCommon = useTranslations('common');
  const zoneConfig = useMemo(
    () => ({
      low: { ...ZONE_DEFS.low, label: t(ZONE_DEFS.low.labelKey) },
      optimal: { ...ZONE_DEFS.optimal, label: t(ZONE_DEFS.optimal.labelKey) },
      high: { ...ZONE_DEFS.high, label: t(ZONE_DEFS.high.labelKey) },
      danger: { ...ZONE_DEFS.danger, label: t(ZONE_DEFS.danger.labelKey) },
    }),
    [t]
  );
  const [data, setData] = useState<AcwrEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChartAthlete, setSelectedChartAthlete] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ days: days.toString() });
        if (athleteId) params.set('athleteId', athleteId);
        if (teamId) params.set('teamId', teamId);
        const res = await apiFetch<{ data: AcwrEntry[] }>(`/analytics/acwr?${params}`);
        setData(res.data || []);
        setSelectedChartAthlete(null);
      } catch {
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [athleteId, teamId, days]);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="card flex h-48 items-center justify-center">
        <div className="text-center">
          <TrendingUp className="mx-auto mb-2 h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-400 dark:text-slate-500">{t('insufficientData')}</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{t('needsThreeWeeks')}</p>
        </div>
      </div>
    );
  }

  // When athleteId is provided, API already filters — use all data directly.
  // When no athleteId, show team average ACWR line + per-athlete summary table.
  const athletes = [...new Map(data.map((d) => [d.athleteId, d.athleteName])).entries()];

  // Build team-average chart data when no specific athlete
  const chartData = athleteId
    ? data
    : selectedChartAthlete
    ? data.filter((d) => d.athleteId === selectedChartAthlete)
    : (() => {
        // Average ACWR across all athletes per weekEnd
        const weekMap = new Map<string, { sum: number; count: number; acuteSum: number; chronicSum: number }>();
        for (const d of data) {
          if (!weekMap.has(d.weekEnd)) weekMap.set(d.weekEnd, { sum: 0, count: 0, acuteSum: 0, chronicSum: 0 });
          const w = weekMap.get(d.weekEnd)!;
          w.sum += d.acwr;
          w.count++;
          w.acuteSum += d.acuteLoad;
          w.chronicSum += d.chronicLoad;
        }
        return Array.from(weekMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([weekEnd, w]) => ({
            athleteId: 'team',
            athleteName: 'Media team',
            weekEnd,
            acuteLoad: Math.round(w.acuteSum / w.count),
            chronicLoad: Math.round(w.chronicSum / w.count),
            acwr: Math.round((w.sum / w.count) * 100) / 100,
            zone: (() => {
              const avg = w.sum / w.count;
              if (avg < 0.8) return 'low' as const;
              if (avg <= 1.3) return 'optimal' as const;
              if (avg <= 1.5) return 'high' as const;
              return 'danger' as const;
            })(),
          }));
      })();

  const latestAcwr = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  // Per-athlete latest ACWR for summary table
  const athleteLatestAcwr = !athleteId
    ? athletes.map(([id, name]) => {
        const athleteData = data.filter((d) => d.athleteId === id);
        const latest = athleteData.length > 0 ? athleteData[athleteData.length - 1] : null;
        return { athleteId: id, athleteName: name, latest };
      }).filter((a) => a.latest !== null)
    : [];

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{t('acwrTitle')}</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500">{t('optimalRange')}</p>
        </div>
        {athleteId && latestAcwr && (
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{latestAcwr.athleteName}</span>
        )}
      </div>

      {/* Current ACWR badge */}
      {latestAcwr && (
        <div className="flex items-center gap-3">
          <div className={`rounded-xl px-4 py-2 ${zoneConfig[latestAcwr.zone].bg}`}>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('currentACWR')}</span>
            <p className={`text-2xl font-bold ${zoneConfig[latestAcwr.zone].color}`}>
              {latestAcwr.acwr.toFixed(2)}
            </p>
          </div>
          <div>
            <div className={`flex items-center gap-1.5 ${zoneConfig[latestAcwr.zone].color}`}>
              {(() => {
                const Icon = zoneConfig[latestAcwr.zone].icon;
                return <Icon className="h-4 w-4" />;
              })()}
              <span className="text-sm font-medium">{zoneConfig[latestAcwr.zone].label}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('acuteShort')}: {latestAcwr.acuteLoad} | {t('chronicShort')}: {latestAcwr.chronicLoad}
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="weekEnd" tickFormatter={formatDate} tick={{ fontSize: 12, fill: '#94a3b8' }} />
          <YAxis domain={[0, 2.2]} tick={{ fontSize: 12, fill: '#94a3b8' }} />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
            labelFormatter={formatDate}
            formatter={(value: number, name: string) => {
              if (name === 'ACWR') return [value.toFixed(2), name];
              return [value, name];
            }}
          />
          {/* Zone backgrounds */}
          <ReferenceArea y1={0} y2={0.8} fill="#3b82f6" fillOpacity={0.05} />
          <ReferenceArea y1={0.8} y2={1.3} fill="#22c55e" fillOpacity={0.08} />
          <ReferenceArea y1={1.3} y2={1.5} fill="#f59e0b" fillOpacity={0.08} />
          <ReferenceArea y1={1.5} y2={2.2} fill="#ef4444" fillOpacity={0.08} />
          {/* Reference lines */}
          <ReferenceLine y={0.8} stroke="#3b82f6" strokeDasharray="5 5" />
          <ReferenceLine y={1.3} stroke="#22c55e" strokeDasharray="5 5" />
          <ReferenceLine y={1.5} stroke="#ef4444" strokeDasharray="5 5" />
          <Line
            type="monotone"
            dataKey="acwr"
            name="ACWR"
            stroke="#0d9488"
            strokeWidth={3}
            dot={{ r: 4, fill: '#0d9488' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Zone legend */}
      <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-100 dark:border-slate-700 text-xs">
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-blue-200" /> &lt;0.8 {t('zoneUndertraining')}</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-green-200" /> 0.8–1.3 {t('optimal')}</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-amber-200" /> 1.3–1.5 {t('zoneModerateRisk')}</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-red-200" /> &gt;1.5 {t('zoneHighRisk')}</span>
      </div>

      {/* Per-athlete ACWR summary — visible when viewing team */}
      {athleteLatestAcwr.length > 1 && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
          <h4 className="mb-3 text-sm font-semibold text-slate-700">{t('acwrByAthlete')}</h4>
          <div className="overflow-x-auto">
            <div className="table-scroll"><table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                  <th className="pb-2 pr-4 font-medium text-slate-500 dark:text-slate-400">{tCommon('athlete')}</th>
                  <th className="pb-2 pr-4 text-right font-medium text-slate-500 dark:text-slate-400">ACWR</th>
                  <th className="pb-2 pr-4 text-right font-medium text-slate-500 dark:text-slate-400">{t('acuteLoad')}</th>
                  <th className="pb-2 pr-4 text-right font-medium text-slate-500 dark:text-slate-400">{t('chronicLoad')}</th>
                  <th className="pb-2 font-medium text-slate-500 dark:text-slate-400">{t('zone')}</th>
                </tr>
              </thead>
              <tbody>
                {athleteLatestAcwr.map((a) => {
                  const zone = a.latest!.zone;
                  const zoneInfo = zoneConfig[zone];
                  return (
                    <tr
                      key={a.athleteId}
                      className="border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900"
                      onClick={() => setSelectedChartAthlete(selectedChartAthlete === a.athleteId ? null : a.athleteId)}
                    >
                      <td className={`py-2 pr-4 font-medium ${selectedChartAthlete === a.athleteId ? 'text-teal-700' : 'text-slate-700 dark:text-slate-300'}`}>
                        {a.athleteName}
                      </td>
                      <td className={`py-2 pr-4 text-right font-semibold ${zoneInfo.color}`}>
                        {a.latest!.acwr.toFixed(2)}
                      </td>
                      <td className="py-2 pr-4 text-right text-slate-600 dark:text-slate-400">{a.latest!.acuteLoad}</td>
                      <td className="py-2 pr-4 text-right text-slate-600 dark:text-slate-400">{a.latest!.chronicLoad}</td>
                      <td className="py-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${zoneInfo.bg} ${zoneInfo.color}`}>
                          {zoneInfo.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </div>
          {selectedChartAthlete && (
            <button
              onClick={() => setSelectedChartAthlete(null)}
              className="mt-2 text-xs text-teal-600 hover:text-teal-700 font-medium"
            >
              {t('backToTeamAvg')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
