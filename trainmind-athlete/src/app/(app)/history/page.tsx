'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { dateLocale } from '@/lib/i18n/dates';
import { Dumbbell, Heart, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface Session {
  id: string;
  title: string;
  date: string;
  duration: number;
  status: string;
  myLog?: { actualRpe?: number } | null;
}

interface WellnessLog {
  id: string;
  date: string;
  sleepHours: number;
  sleepQuality: number;
  fatigue: number;
  soreness: number;
  stress: number;
  mood: number;
}

type Tab = 'sessions' | 'wellness';

export default function HistoryPage() {
  const t = useTranslations('history');
  const locale = useLocale();
  const df = dateLocale(locale);
  const [tab, setTab] = useState<Tab>('sessions');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [wellnessLogs, setWellnessLogs] = useState<WellnessLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    Promise.all([
      api.getSessions({ from: thirtyDaysAgo, to: today, limit: '50' }) as Promise<{ success: boolean; data?: Session[] }>,
      api.getWellnessHistory({ from: thirtyDaysAgo, to: today, limit: '30' }) as Promise<{ success: boolean; data?: WellnessLog[] }>,
    ])
      .then(([sessRes, wellRes]) => {
        if (sessRes.success && sessRes.data) setSessions(sessRes.data);
        if (wellRes.success && wellRes.data) setWellnessLogs(wellRes.data);
      })
      // Senza questo ramo una chiamata fallita lasciava `loading` a true per
      // sempre e la pagina restava bloccata sulla rotellina.
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  /**
   * Punteggio wellness (0-100). Deve dare lo STESSO numero che vede il
   * preparatore: è la formula di `calculateWellnessScore` in
   * `@trainmind/utils`, che l'API usa per la heatmap e per gli alert.
   *
   * Qui si ribaltavano Fatica, Dolore e Stress con `(6 - x)`. Era giusto prima
   * della migrazione `wellness_scale_flip`; da allora su tutte e cinque le voci
   * 5 è la condizione migliore, e il ribaltamento capovolgeva il punteggio: una
   * giornata perfetta risultava 52% all'atleta e 100% al preparatore.
   */
  function wellnessScore(log: WellnessLog): number {
    const sum = log.sleepQuality + log.fatigue + log.soreness + log.stress + log.mood;
    return Math.round((sum / 25) * 100);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <h2 className="mb-4 text-xl font-bold text-slate-900 dark:text-white">{t('title')}</h2>

      {/* Tab switcher */}
      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        <button
          onClick={() => setTab('sessions')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            tab === 'sessions' ? 'bg-white text-teal-600 shadow-sm dark:bg-slate-700 dark:text-teal-400' : 'text-slate-500'
          }`}
        >
          <Dumbbell size={14} className="mb-0.5 mr-1 inline" /> {t('tabSessions')}
        </button>
        <button
          onClick={() => setTab('wellness')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            tab === 'wellness' ? 'bg-white text-teal-600 shadow-sm dark:bg-slate-700 dark:text-teal-400' : 'text-slate-500'
          }`}
        >
          <Heart size={14} className="mb-0.5 mr-1 inline" /> {t('tabWellness')}
        </button>
      </div>

      {/* Sessions tab */}
      {tab === 'sessions' && (
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">{t('emptySessions')}</p>
          ) : (
            sessions.map((s) => (
              <Link key={s.id} href={`/sessions/${s.id}`} className="block">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{s.title}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(s.date).toLocaleDateString(df, { day: 'numeric', month: 'short' })}
                      {' · '}{s.duration} min
                      {s.myLog?.actualRpe && ` · RPE ${s.myLog.actualRpe}`}
                    </p>
                  </div>
                  {s.myLog?.actualRpe && (
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white ${
                      s.myLog.actualRpe <= 3 ? 'bg-green-500' :
                      s.myLog.actualRpe <= 6 ? 'bg-yellow-500' :
                      s.myLog.actualRpe <= 8 ? 'bg-orange-500' : 'bg-red-500'
                    }`}>
                      {s.myLog.actualRpe}
                    </div>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {/* Wellness tab */}
      {tab === 'wellness' && (
        <div className="space-y-2">
          {wellnessLogs.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">{t('emptyWellness')}</p>
          ) : (
            wellnessLogs.map((log) => {
              const score = wellnessScore(log);
              return (
                <div key={log.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {new Date(log.date).toLocaleDateString(df, { weekday: 'short', day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {/* Una cifra decimale basta: le ore arrivano dal
                            cursore a mezz'ore, ma i dati vecchi hanno valori
                            come 6.77 e si leggeva "6.77h sonno". */}
                        {t('sleepSummary', {
                          hours: Math.round(log.sleepHours * 10) / 10,
                          quality: log.sleepQuality,
                        })}
                      </p>
                    </div>
                    {/* Stesse soglie della heatmap del preparatore (verde da
                        65, rosso sotto 35): un punteggio non può essere verde
                        di qua e giallo di là. */}
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} className={score >= 65 ? 'text-green-500' : score >= 35 ? 'text-yellow-500' : 'text-red-500'} />
                      <span className={`text-lg font-bold ${score >= 65 ? 'text-green-600' : score >= 35 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {score}%
                      </span>
                    </div>
                  </div>
                  {/* Mini bars */}
                  <div className="mt-2 grid grid-cols-5 gap-1">
                    {/* Nessun ribaltamento: 5 è il meglio su tutte e cinque le
                        voci, quindi la barra piena è sempre la condizione
                        buona. Prima Fatica, Dolore e Stress erano al contrario
                        e la barra mostrava pieno il giorno peggiore. */}
                    {[
                      { key: 'barFatigue', val: log.fatigue },
                      { key: 'barSoreness', val: log.soreness },
                      { key: 'barStress', val: log.stress },
                      { key: 'barSleep', val: log.sleepQuality },
                      { key: 'barMood', val: log.mood },
                    ].map((item) => (
                      <div key={item.key} className="text-center">
                        <div className="mx-auto h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div
                            className="h-full rounded-full bg-teal-500"
                            style={{ width: `${(item.val / 5) * 100}%` }}
                          />
                        </div>
                        <span className="text-2xs text-slate-400">{t(item.key)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
