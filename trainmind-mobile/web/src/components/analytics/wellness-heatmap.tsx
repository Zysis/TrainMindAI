'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Heart } from 'lucide-react';
import { apiFetch } from '@/lib/auth/fetch';

interface HeatmapEntry {
  athleteId: string;
  athleteName: string;
  date: string;
  sleepQuality: number;
  fatigue: number;
  soreness: number;
  stress: number;
  mood: number;
  wellnessScore: number;
}

interface WellnessHeatmapProps {
  athleteId?: string;
  teamId?: string | null;
  days?: number;
}

// Color scale for wellness score (0-100)
function getScoreColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 65) return 'bg-green-400';
  if (score >= 50) return 'bg-yellow-400';
  if (score >= 35) return 'bg-orange-400';
  return 'bg-red-500';
}

export function WellnessHeatmap({ athleteId, teamId, days = 14 }: WellnessHeatmapProps) {
  const locale = useLocale();
  const t = useTranslations('analyticsExt');
  const tWellness = useTranslations('wellness');
  const [data, setData] = useState<HeatmapEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ days: days.toString() });
        if (athleteId) params.set('athleteId', athleteId);
        if (teamId) params.set('teamId', teamId);
        const res = await apiFetch<{ data: HeatmapEntry[] }>(`/analytics/wellness-heatmap?${params}`);
        setData(res.data || []);
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
          <Heart className="mx-auto mb-2 h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-400 dark:text-slate-500">{t('noWellnessData')}</p>
        </div>
      </div>
    );
  }

  // Group by athlete
  const athletes = [...new Map(data.map((d) => [d.athleteId, d.athleteName])).entries()];

  // Get unique dates (sorted)
  const dates = [...new Set(data.map((d) => d.date))].sort();

  // Build lookup: athleteId -> date -> entry
  const lookup: Record<string, Record<string, HeatmapEntry>> = {};
  for (const entry of data) {
    if (!lookup[entry.athleteId]) lookup[entry.athleteId] = {};
    lookup[entry.athleteId][entry.date] = entry;
  }

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };

  const formatDay = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString(locale, { weekday: 'short' }).slice(0, 2);
  };

  return (
    <div className="card overflow-x-auto">
      <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">{t('heatmapTitle')}</h3>

      <div className="min-w-[600px]">
        {/* Date headers */}
        <div className="flex items-end gap-1 mb-2 ml-32">
          {dates.map((date) => (
            <div key={date} className="w-10 text-center">
              <span className="block text-2xs font-medium text-slate-400 dark:text-slate-500">{formatDay(date)}</span>
              <span className="block text-2xs text-slate-500 dark:text-slate-400">{formatDate(date)}</span>
            </div>
          ))}
        </div>

        {/* Athlete rows */}
        <div className="space-y-1">
          {athletes.map(([athleteId, athleteName]) => (
            <div key={athleteId} className="flex items-center gap-1">
              <div className="w-32 truncate text-sm font-medium text-slate-700">{athleteName}</div>
              {dates.map((date) => {
                const entry = lookup[athleteId]?.[date];
                if (!entry) {
                  return (
                    <div
                      key={date}
                      className="h-10 w-10 rounded-md bg-slate-100 dark:bg-slate-700"
                      title={t('noData')}
                    />
                  );
                }
                return (
                  <div
                    key={date}
                    className={`h-10 w-10 rounded-md flex items-center justify-center text-xs font-bold text-white ${getScoreColor(entry.wellnessScore)} cursor-default transition-transform hover:scale-110`}
                    title={`${athleteName} - ${formatDate(date)}\n${tWellness('score')}: ${entry.wellnessScore}%\n${tWellness('sleepLabel')}: ${entry.sleepQuality}/5\n${tWellness('fatigueLabel')}: ${entry.fatigue}/5\n${tWellness('sorenessLabel')}: ${entry.soreness}/5\n${tWellness('stressLabel')}: ${entry.stress}/5\n${tWellness('moodLabel')}: ${entry.mood}/5`}
                  >
                    {entry.wellnessScore}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
          <span className="text-xs text-slate-500 dark:text-slate-400">{t('scoreLabel')}</span>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-red-500" />
            <span className="text-2xs text-slate-400 dark:text-slate-500">&lt;35</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-orange-400" />
            <span className="text-2xs text-slate-400 dark:text-slate-500">35-50</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-yellow-400" />
            <span className="text-2xs text-slate-400 dark:text-slate-500">50-65</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-green-400" />
            <span className="text-2xs text-slate-400 dark:text-slate-500">65-80</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-green-500" />
            <span className="text-2xs text-slate-400 dark:text-slate-500">&gt;80</span>
          </div>
        </div>
      </div>
    </div>
  );
}
