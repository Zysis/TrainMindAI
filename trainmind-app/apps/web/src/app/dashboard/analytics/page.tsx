'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Activity, Users, Heart, TrendingUp, Info, RotateCcw, ClipboardCheck } from 'lucide-react';
import { PerformanceCharts, WellnessHeatmap, AcwrChart, TeamOverview, AttendancePanel } from '@/components/analytics';
import { useTeam } from '@/hooks/use-team';
import { apiFetch } from '@/lib/auth/fetch';

type Tab = 'team' | 'performance' | 'wellness' | 'acwr' | 'attendance';

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
  { key: 'attendance', labelKey: 'tabAttendance', icon: ClipboardCheck },
];

/** yyyy-mm-dd nel fuso locale (toISOString sposterebbe il giorno) */
function toInputDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 90);
  return { from: toInputDate(from), to: toInputDate(to) };
}

export default function AnalyticsPage() {
  const t = useTranslations('analytics');
  const { selectedTeamId, teams } = useTeam();

  const [activeTab, setActiveTab] = useState<Tab>('team');

  // ─── Filtri, condivisi da tutte le sotto-schede ─────────
  const initialRange = useMemo(defaultRange, []);
  const [filterTeamId, setFilterTeamId] = useState<string>(selectedTeamId || '');
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>(initialRange.from);
  const [dateTo, setDateTo] = useState<string>(initialRange.to);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);

  // Il filtro squadra parte da quello globale e lo segue finché non lo cambi qui
  useEffect(() => {
    setFilterTeamId(selectedTeamId || '');
    setSelectedAthleteId('');
  }, [selectedTeamId]);

  // Elenco atleti, ristretto alla squadra filtrata
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const params = new URLSearchParams({ limit: '100' });
        if (filterTeamId) params.set('teamId', filterTeamId);
        const res = await apiFetch<{ data: AthleteOption[] }>(`/athletes?${params}`);
        if (cancelled) return;
        const list = res.data || [];
        setAthletes(list);
        setSelectedAthleteId((prev) => (prev && !list.some((a) => a.id === prev) ? '' : prev));
      } catch {
        if (!cancelled) setAthletes([]);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [filterTeamId]);

  const resetFilters = () => {
    const range = defaultRange();
    setFilterTeamId(selectedTeamId || '');
    setSelectedAthleteId('');
    setDateFrom(range.from);
    setDateTo(range.to);
  };

  const filtersActive =
    selectedAthleteId !== '' ||
    filterTeamId !== (selectedTeamId || '') ||
    dateFrom !== initialRange.from ||
    dateTo !== initialRange.to;

  // La scheda Squadra è una fotografia dello stato attuale: finestre fisse,
  // nessun filtro atleta.
  const isTeamTab = activeTab === 'team';

  const athleteId = selectedAthleteId || undefined;
  const teamId = filterTeamId || null;

  const fieldClass =
    'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-teal-500 disabled:cursor-not-allowed disabled:opacity-50';
  const fieldLabel =
    'text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
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
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Filtri condivisi da tutte le sotto-schede */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3">
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>{t('filterTeam')}</span>
          <select
            value={filterTeamId}
            onChange={(e) => { setFilterTeamId(e.target.value); setSelectedAthleteId(''); }}
            className={fieldClass}
          >
            <option value="">{t('allTeams')}</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>
            {t('athlete')}
            {isTeamTab && (
              <span className="ml-1 normal-case tracking-normal text-slate-400 dark:text-slate-500">
                ({t('notApplicable')})
              </span>
            )}
          </span>
          <select
            value={selectedAthleteId}
            disabled={isTeamTab}
            onChange={(e) => setSelectedAthleteId(e.target.value)}
            className={fieldClass}
          >
            <option value="">{t('allAthletes')}</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>{a.lastName} {a.firstName}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>
            {t('dateFrom')}
            {isTeamTab && (
              <span className="ml-1 normal-case tracking-normal text-slate-400 dark:text-slate-500">
                ({t('notApplicable')})
              </span>
            )}
          </span>
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            disabled={isTeamTab}
            onChange={(e) => setDateFrom(e.target.value)}
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>{t('dateTo')}</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            disabled={isTeamTab}
            onChange={(e) => setDateTo(e.target.value)}
            className={fieldClass}
          />
        </label>

        {filtersActive && (
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t('resetFilters')}
          </button>
        )}
      </div>

      {isTeamTab && (
        <div className="flex items-start gap-2 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-900/20 px-4 py-2.5">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
          <p className="text-xs text-blue-800 dark:text-blue-200">{t('teamTabNote')}</p>
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'team' && <TeamOverview teamId={teamId} />}
      {activeTab === 'performance' && (
        <PerformanceCharts athleteId={athleteId} teamId={teamId} dateFrom={dateFrom} dateTo={dateTo} />
      )}
      {activeTab === 'wellness' && (
        <WellnessHeatmap athleteId={athleteId} teamId={teamId} dateFrom={dateFrom} dateTo={dateTo} />
      )}
      {activeTab === 'acwr' && (
        <AcwrChart athleteId={athleteId} teamId={teamId} dateFrom={dateFrom} dateTo={dateTo} />
      )}
      {activeTab === 'attendance' && (
        <AttendancePanel athleteId={athleteId} teamId={teamId} dateFrom={dateFrom} dateTo={dateTo} />
      )}
    </div>
  );
}
