'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Heart, Moon, Battery, Activity, Brain, Smile, RotateCcw } from 'lucide-react';
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

interface AthleteOption {
  id: string;
  firstName: string;
  lastName: string;
}

// Scala colori uniforme su tutte le colonne: valore basso = rosso, alto = verde.
// Attenzione: colora il VALORE, non il suo significato — su Fatica, Dolore e
// Stress un 5 indica il livello massimo. Vedi la legenda sopra la tabella.
function getVariant(value: number): 'success' | 'warning' | 'danger' {
  return value >= 4 ? 'success' : value >= 3 ? 'warning' : 'danger';
}

/** yyyy-mm-dd nel fuso locale (toISOString sposterebbe il giorno) */
function toInputDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: toInputDate(from), to: toInputDate(to) };
}

export default function WellnessPage() {
  const { selectedTeamId, teams } = useTeam();
  const t = useTranslations('wellness');
  const locale = useLocale();
  const [logs, setLogs] = useState<WellnessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // ─── Filtri ─────────────────────────────────────────────
  const initialRange = useMemo(defaultRange, []);
  const [filterTeamId, setFilterTeamId] = useState<string>(selectedTeamId || '');
  const [filterAthleteId, setFilterAthleteId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>(initialRange.from);
  const [dateTo, setDateTo] = useState<string>(initialRange.to);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);

  // Il filtro squadra parte da quello globale e lo segue finché non lo cambi qui
  useEffect(() => {
    setFilterTeamId(selectedTeamId || '');
    setFilterAthleteId('');
  }, [selectedTeamId]);

  const wellnessFields = [
    { key: 'sleepQuality' as const, label: t('sleepLabel'), icon: Moon, color: 'text-indigo-500', bgColor: 'bg-indigo-50' },
    { key: 'fatigue' as const, label: t('fatigueLabel'), icon: Battery, color: 'text-amber-500', bgColor: 'bg-amber-50' },
    { key: 'soreness' as const, label: t('sorenessLabel'), icon: Activity, color: 'text-red-500', bgColor: 'bg-red-50' },
    { key: 'stress' as const, label: t('stressLabel'), icon: Brain, color: 'text-orange-500', bgColor: 'bg-orange-50' },
    { key: 'mood' as const, label: t('moodLabel'), icon: Smile, color: 'text-green-500', bgColor: 'bg-green-50' },
  ];

  // ─── Elenco atleti per il filtro ────────────────────────
  useEffect(() => {
    let cancelled = false;
    const loadAthletes = async () => {
      try {
        const params = new URLSearchParams({ limit: '100', isActive: 'true' });
        if (filterTeamId) params.set('teamId', filterTeamId);
        const res = await apiFetch<{ data: AthleteOption[] }>(`/athletes?${params}`);
        if (cancelled) return;
        const list = res.data || [];
        setAthletes(list);
        // se l'atleta selezionato non appartiene più alla squadra filtrata, azzera
        setFilterAthleteId((prev) => (prev && !list.some((a) => a.id === prev) ? '' : prev));
      } catch {
        if (!cancelled) setAthletes([]);
      }
    };
    loadAthletes();
    return () => { cancelled = true; };
  }, [filterTeamId]);

  // ─── Caricamento log ────────────────────────────────────
  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (filterAthleteId) params.set('athleteId', filterAthleteId);
      else if (filterTeamId) params.set('teamId', filterTeamId);
      // L'API accetta solo yyyy-mm-dd e salva la data a mezzanotte UTC,
      // quindi gli estremi sono inclusivi così come sono.
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      const res = await apiFetch<ApiResponse>(`/wellness?${params}`);
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filterTeamId, filterAthleteId, dateFrom, dateTo]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const resetFilters = () => {
    const range = defaultRange();
    setFilterTeamId(selectedTeamId || '');
    setFilterAthleteId('');
    setDateFrom(range.from);
    setDateTo(range.to);
  };

  const filtersActive =
    filterAthleteId !== '' ||
    filterTeamId !== (selectedTeamId || '') ||
    dateFrom !== initialRange.from ||
    dateTo !== initialRange.to;

  // Le medie seguono i filtri: sono la media della selezione, non della squadra intera
  const averages = wellnessFields.reduce<Record<string, number>>((acc, field) => {
    if (logs.length === 0) {
      acc[field.key] = 0;
      return acc;
    }
    const sum = logs.reduce((s, log) => s + log[field.key], 0);
    acc[field.key] = Math.round((sum / logs.length) * 10) / 10;
    return acc;
  }, {});

  // Legenda della singola voce: la scala 1-5 con le sue etichette, mostrata
  // passando il mouse sul nome della colonna. Su tutte le voci 5 è il migliore.
  const scaleHint = (labelsKey: string, colLabel: string) => {
    let labels: string[] | null = null;
    try {
      const raw = t.raw(labelsKey);
      if (Array.isArray(raw)) labels = raw as string[];
    } catch {
      labels = null;
    }
    if (!labels) return colLabel;
    return `${colLabel}\n${labels.map((l, i) => `${i + 1} — ${l}`).join('\n')}`;
  };

  const headClass =
    'pb-3 text-center font-medium text-slate-500 dark:text-slate-400 cursor-help underline decoration-dotted decoration-slate-300 underline-offset-4';

  const selectClass =
    'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-teal-500';

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
            <p className="text-2xs text-slate-400 dark:text-slate-500">{t('selectionAverage')}</p>
          </div>
        ))}
      </div>

      {/* AI Wellness Insights */}
      <AIWellnessInsights />

      <div className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('recentLogs')}</h2>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {loading ? '' : t('logsCount', { count: logs.length })}
          </span>
        </div>

        {/* Filtri */}
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-3">
          <label className="flex flex-col gap-1">
            <span className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('filterTeam')}
            </span>
            <select
              value={filterTeamId}
              onChange={(e) => { setFilterTeamId(e.target.value); setFilterAthleteId(''); }}
              className={selectClass}
            >
              <option value="">{t('allTeams')}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('filterAthlete')}
            </span>
            <select
              value={filterAthleteId}
              onChange={(e) => setFilterAthleteId(e.target.value)}
              className={selectClass}
            >
              <option value="">{t('allAthletes')}</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>{a.lastName} {a.firstName}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('dateFrom')}
            </span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className={selectClass}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-2xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('dateTo')}
            </span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className={selectClass}
            />
          </label>

          {filtersActive && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t('resetFilters')}
            </button>
          )}
        </div>

        {/* Legenda colori */}
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2">
          <span className="text-2xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('legendTitle')}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <Badge variant="danger">1–2</Badge> {t('legendLow')}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <Badge variant="warning">3</Badge> {t('legendMid')}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <Badge variant="success">4–5</Badge> {t('legendHigh')}
          </span>
          <span className="text-xs italic text-slate-500 dark:text-slate-400">{t('legendNote')}</span>
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <div className="text-center">
              <Heart className="mx-auto mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-400 dark:text-slate-500">
                {dateFrom || dateTo ? t('noLogsInRange') : t('noWellnessLogs')}
              </p>
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="mt-2 text-sm font-medium text-teal-600 hover:underline"
                >
                  {t('clearDateFilter')}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                  <th className="pb-3 font-medium text-slate-500 dark:text-slate-400">{t('athleteCol')}</th>
                  <th className="pb-3 font-medium text-slate-500 dark:text-slate-400">{t('dateCol')}</th>
                  <th className={headClass} title={scaleHint('sleepLabels', t('sleepCol'))}>{t('sleepCol')}</th>
                  <th className={headClass} title={scaleHint('fatigueLabels', t('fatigueCol'))}>{t('fatigueCol')}</th>
                  <th className={headClass} title={scaleHint('sorenessLabels', t('sorenessCol'))}>{t('sorenessCol')}</th>
                  <th className={headClass} title={scaleHint('stressLabels', t('stressCol'))}>{t('stressCol')}</th>
                  <th className={headClass} title={scaleHint('moodLabels', t('moodCol'))}>{t('moodCol')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="py-3 font-medium text-slate-900 dark:text-white">{log.athlete.firstName} {log.athlete.lastName}</td>
                    <td className="py-3 text-slate-500 dark:text-slate-400">{new Date(log.date).toLocaleDateString(locale)}</td>
                    <td className="py-3 text-center">
                      <Badge variant={getVariant(log.sleepQuality)}>{log.sleepQuality}/5</Badge>
                    </td>
                    <td className="py-3 text-center">
                      <Badge variant={getVariant(log.fatigue)}>{log.fatigue}/5</Badge>
                    </td>
                    <td className="py-3 text-center">
                      <Badge variant={getVariant(log.soreness)}>{log.soreness}/5</Badge>
                    </td>
                    <td className="py-3 text-center">
                      <Badge variant={getVariant(log.stress)}>{log.stress}/5</Badge>
                    </td>
                    <td className="py-3 text-center">
                      <Badge variant={getVariant(log.mood)}>{log.mood}/5</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
