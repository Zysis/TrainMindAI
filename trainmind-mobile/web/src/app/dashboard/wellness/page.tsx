'use client';

import { useEffect, useState } from 'react';
import { Heart, Moon, Battery, Activity, Brain, Smile } from 'lucide-react';
import { apiFetch } from '@/lib/auth/fetch';
import { useTeam } from '@/hooks/use-team';
import { Badge } from '@/components/ui/badge';
import { AIWellnessInsights } from '@/components/ai/ai-wellness-insights';
import { WellnessForm } from '@/components/wellness';
import { useTranslations, useLocale } from 'next-intl';

interface WellnessLog {
  id: string;
  athleteId: string;
  date: string;
  sleepHours: number;
  sleepQuality: number;
  fatigue: number;
  soreness: number;
  stress: number;
  mood: number;
  athlete: { firstName: string; lastName: string };
}

interface ApiResponse {
  success: boolean;
  data: WellnessLog[];
  meta: { total: number };
}

// wellnessFields moved inside component to use translations

function getVariant(key: string, value: number): 'success' | 'warning' | 'danger' {
  if (key === 'mood' || key === 'sleepQuality') {
    return value >= 4 ? 'success' : value >= 3 ? 'warning' : 'danger';
  }
  return value <= 2 ? 'success' : value <= 3 ? 'warning' : 'danger';
}

export default function WellnessPage() {
  const { selectedTeamId } = useTeam();
  const t = useTranslations('wellness');
  const locale = useLocale();
  const [logs, setLogs] = useState<WellnessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const wellnessFields = [
    { key: 'sleepQuality' as const, label: t('sleepLabel'), icon: Moon, color: 'text-indigo-500', bgColor: 'bg-indigo-50' },
    { key: 'fatigue' as const, label: t('fatigueLabel'), icon: Battery, color: 'text-amber-500', bgColor: 'bg-amber-50' },
    { key: 'soreness' as const, label: t('sorenessLabel'), icon: Activity, color: 'text-red-500', bgColor: 'bg-red-50' },
    { key: 'stress' as const, label: t('stressLabel'), icon: Brain, color: 'text-orange-500', bgColor: 'bg-orange-50' },
    { key: 'mood' as const, label: t('moodLabel'), icon: Smile, color: 'text-green-500', bgColor: 'bg-green-50' },
  ];

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (selectedTeamId) params.set('teamId', selectedTeamId);
      const res = await apiFetch<ApiResponse>(`/wellness?${params}`);
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [selectedTeamId]);

  const averages = wellnessFields.reduce<Record<string, number>>((acc, field) => {
    if (logs.length === 0) {
      acc[field.key] = 0;
      return acc;
    }
    const sum = logs.reduce((s, log) => s + log[field.key], 0);
    acc[field.key] = Math.round((sum / logs.length) * 10) / 10;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
        >
          <Heart className="h-4 w-4" />
          {t('logWellness')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {wellnessFields.map((field) => (
          <div key={field.key} className="card text-center">
            <div className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl ${field.bgColor}`}>
              <field.icon className={`h-5 w-5 ${field.color}`} />
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{field.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {loading ? '...' : logs.length === 0 ? '--' : averages[field.key]}
            </p>
            <p className="text-2xs text-slate-400 dark:text-slate-500">{t('teamAverage')}</p>
          </div>
        ))}
      </div>

      {/* AI Wellness Insights */}
      <AIWellnessInsights />

      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">{t('recentLogs')}</h2>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <div className="text-center">
              <Heart className="mx-auto mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-400 dark:text-slate-500">{t('noWellnessLogs')}</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="table-scroll"><table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                  <th className="pb-3 font-medium text-slate-500 dark:text-slate-400">{t('athleteCol')}</th>
                  <th className="pb-3 font-medium text-slate-500 dark:text-slate-400">{t('dateCol')}</th>
                  <th className="pb-3 text-center font-medium text-slate-500 dark:text-slate-400">{t('sleepCol')}</th>
                  <th className="pb-3 text-center font-medium text-slate-500 dark:text-slate-400">{t('fatigueCol')}</th>
                  <th className="pb-3 text-center font-medium text-slate-500 dark:text-slate-400">{t('sorenessCol')}</th>
                  <th className="pb-3 text-center font-medium text-slate-500 dark:text-slate-400">{t('stressCol')}</th>
                  <th className="pb-3 text-center font-medium text-slate-500 dark:text-slate-400">{t('moodCol')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="py-3 font-medium text-slate-900 dark:text-white">{log.athlete.firstName} {log.athlete.lastName}</td>
                    <td className="py-3 text-slate-500 dark:text-slate-400">{new Date(log.date).toLocaleDateString(locale)}</td>
                    <td className="py-3 text-center">
                      <Badge variant={getVariant('sleepQuality', log.sleepQuality)}>{log.sleepQuality}/5</Badge>
                    </td>
                    <td className="py-3 text-center">
                      <Badge variant={getVariant('fatigue', log.fatigue)}>{log.fatigue}/5</Badge>
                    </td>
                    <td className="py-3 text-center">
                      <Badge variant={getVariant('soreness', log.soreness)}>{log.soreness}/5</Badge>
                    </td>
                    <td className="py-3 text-center">
                      <Badge variant={getVariant('stress', log.stress)}>{log.stress}/5</Badge>
                    </td>
                    <td className="py-3 text-center">
                      <Badge variant={getVariant('mood', log.mood)}>{log.mood}/5</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </div>
      {/* Wellness Form */}
      <WellnessForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSaved={loadLogs}
      />
    </div>
  );
}
