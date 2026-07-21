'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Activity, Users, Heart, TrendingUp, User } from 'lucide-react';
import { PerformanceCharts, WellnessHeatmap, AcwrChart, TeamOverview } from '@/components/analytics';
import { useTeam } from '@/hooks/use-team';
import { apiFetch } from '@/lib/auth/fetch';

type Tab = 'team' | 'performance' | 'wellness' | 'acwr';

interface AthleteOption {
  id: string;
  firstName: string;
  lastName: string;
}

const tabKeys: Array<{ key: Tab; labelKey: string; icon: typeof Activity }> = [
  { key: 'team', labelKey: 'tabTeam', icon: Users },
  { key: 'performance', labelKey: 'tabPerformance', icon: TrendingUp },
  { key: 'wellness', labelKey: 'tabWellness', icon: Heart },
  { key: 'acwr', labelKey: 'tabAcwr', icon: Activity },
];

const showAthleteFilter = (tab: Tab) => tab !== 'team';

export default function AnalyticsPage() {
  const t = useTranslations('analytics');
  const [activeTab, setActiveTab] = useState<Tab>('team');
  const [days, setDays] = useState(30);
  const { selectedTeamId } = useTeam();
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | undefined>(undefined);

  // Load athletes (filtered by team when a team is selected)
  useEffect(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams({ limit: '100' });
        if (selectedTeamId) params.set('teamId', selectedTeamId);
        const res = await apiFetch<{ data: AthleteOption[] }>(`/athletes?${params}`);
        setAthletes(res.data || []);
      } catch {
        setAthletes([]);
      }
    };
    load();
    // Reset athlete selection when team changes
    setSelectedAthleteId(undefined);
  }, [selectedTeamId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('period')}:</span>
          {[7, 14, 30, 60, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                days === d
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {d}{t('daysShort')}
            </button>
          ))}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-700 p-1">
        {tabKeys.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Athlete filter — visible on individual tabs */}
      {showAthleteFilter(activeTab) && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5">
          <User className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{t('athlete')}:</span>
          <select
            value={selectedAthleteId || ''}
            onChange={(e) => setSelectedAthleteId(e.target.value || undefined)}
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-sm focus:border-teal-500 focus:outline-none"
          >
            <option value="">{t('allAthletes')}</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.lastName} {a.firstName}
              </option>
            ))}
          </select>
          {selectedAthleteId && (
            <button
              onClick={() => setSelectedAthleteId(undefined)}
              className="rounded-lg bg-slate-100 dark:bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-200 transition-colors"
            >
              {t('reset')}
            </button>
          )}
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'team' && <TeamOverview teamId={selectedTeamId} />}
      {activeTab === 'performance' && (
        <PerformanceCharts athleteId={selectedAthleteId} days={days} teamId={selectedTeamId} />
      )}
      {activeTab === 'wellness' && (
        <WellnessHeatmap athleteId={selectedAthleteId} days={days} teamId={selectedTeamId} />
      )}
      {activeTab === 'acwr' && (
        <AcwrChart athleteId={selectedAthleteId} days={days} teamId={selectedTeamId} />
      )}
    </div>
  );
}
