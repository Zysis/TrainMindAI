'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  AreaChart, Area, BarChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, Clock, Dumbbell, Activity } from 'lucide-react';
import { apiFetch } from '@/lib/auth/fetch';

interface PerformanceData {
  date: string;
  sessions: number;
  totalDuration: number;
  avgRpe: number;
  totalVolume: number;
  totalSets: number;
}

interface AthletePerformance {
  athleteId: string;
  athleteName: string;
  sessions: number;
  totalDuration: number;
  avgRpe: number;
  totalVolume: number;
}

interface PerformanceChartsProps {
  athleteId?: string;
  teamId?: string | null;
  days?: number;
}

export function PerformanceCharts({ athleteId, teamId, days = 30 }: PerformanceChartsProps) {
  const locale = useLocale();
  const t = useTranslations('analyticsExt');
  const tCommon = useTranslations('common');
  const [data, setData] = useState<PerformanceData[]>([]);
  const [perAthlete, setPerAthlete] = useState<AthletePerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ days: days.toString() });
        if (athleteId) params.set('athleteId', athleteId);
        if (teamId) params.set('teamId', teamId);
        const res = await apiFetch<{ data: PerformanceData[]; perAthlete?: AthletePerformance[] }>(`/analytics/performance?${params}`);
        setData(res.data || []);
        setPerAthlete(res.perAthlete || []);
      } catch {
        setData([]);
        setPerAthlete([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [athleteId, teamId, days]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="card flex h-48 items-center justify-center">
        <div className="text-center">
          <TrendingUp className="mx-auto mb-2 h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-400 dark:text-slate-500">{t('noPerformanceData')}</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{t('completeSessionsHint')}</p>
        </div>
      </div>
    );
  }

  // Summary stats
  const totalSessions = data.reduce((s, d) => s + d.sessions, 0);
  const totalDuration = data.reduce((s, d) => s + d.totalDuration, 0);
  const totalVolume = data.reduce((s, d) => s + d.totalVolume, 0);
  const avgRpe = data.filter((d) => d.avgRpe > 0).length > 0
    ? Math.round(data.filter((d) => d.avgRpe > 0).reduce((s, d) => s + d.avgRpe, 0) / data.filter((d) => d.avgRpe > 0).length * 10) / 10
    : 0;

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl bg-teal-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Dumbbell className="h-4 w-4 text-teal-600" />
            <span className="text-xs font-medium text-teal-600">{t('sessions')}</span>
          </div>
          <p className="text-2xl font-bold text-teal-700">{totalSessions}</p>
        </div>
        <div className="rounded-xl bg-blue-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-medium text-blue-600">{t('totalDuration')}</span>
          </div>
          <p className="text-2xl font-bold text-blue-700">{Math.round(totalDuration / 60)}h {totalDuration % 60}m</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-amber-600" />
            <span className="text-xs font-medium text-amber-600">{t('totalVolume')}</span>
          </div>
          <p className="text-2xl font-bold text-amber-700">{totalVolume.toLocaleString()} kg</p>
        </div>
        <div className="rounded-xl bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-red-600" />
            <span className="text-xs font-medium text-red-600">{t('avgRPE')}</span>
          </div>
          <p className="text-2xl font-bold text-red-700">{avgRpe}/10</p>
        </div>
      </div>

      {/* Volume over time — Area chart */}
      <div className="card">
        <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">{t('trainingVolume')}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
              labelFormatter={formatDate}
              formatter={(value: number) => [`${value.toLocaleString()} kg`, 'Volume']}
            />
            <Area
              type="monotone"
              dataKey="totalVolume"
              stroke="#0d9488"
              strokeWidth={2}
              fill="url(#volumeGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* RPE + Duration — Combined line/bar chart */}
      <div className="card">
        <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">{t('rpeAndDuration')}</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12, fill: '#94a3b8' }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#94a3b8' }} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 10]} tick={{ fontSize: 12, fill: '#94a3b8' }} />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
              labelFormatter={formatDate}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="totalDuration" name={t('durationMin')} fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.7} />
            <Line yAxisId="right" type="monotone" dataKey="avgRpe" name="RPE" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Sets per day — Bar chart */}
      <div className="card">
        <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">{t('setsCompletedPerDay')}</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
              labelFormatter={formatDate}
              formatter={(value: number) => [value, t('sets')]}
            />
            <Bar dataKey="totalSets" name={t('sets')} fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-athlete breakdown — visible when viewing team */}
      {perAthlete.length > 0 && (
        <div className="card">
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">{t('detailByAthlete')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                  <th className="pb-2 pr-4 font-medium text-slate-500 dark:text-slate-400">{tCommon('athlete')}</th>
                  <th className="pb-2 pr-4 text-right font-medium text-slate-500 dark:text-slate-400">{t('sessions')}</th>
                  <th className="pb-2 pr-4 text-right font-medium text-slate-500 dark:text-slate-400">{t('duration')}</th>
                  <th className="pb-2 pr-4 text-right font-medium text-slate-500 dark:text-slate-400">{t('avgRPE')}</th>
                  <th className="pb-2 text-right font-medium text-slate-500 dark:text-slate-400">Volume (kg)</th>
                </tr>
              </thead>
              <tbody>
                {perAthlete.map((a) => (
                  <tr key={a.athleteId} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="py-2 pr-4 font-medium text-slate-700">{a.athleteName}</td>
                    <td className="py-2 pr-4 text-right text-slate-600 dark:text-slate-400">{a.sessions}</td>
                    <td className="py-2 pr-4 text-right text-slate-600 dark:text-slate-400">{Math.round(a.totalDuration / 60)}h {a.totalDuration % 60}m</td>
                    <td className="py-2 pr-4 text-right text-slate-600 dark:text-slate-400">{a.avgRpe}/10</td>
                    <td className="py-2 text-right text-slate-600 dark:text-slate-400">{a.totalVolume.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
