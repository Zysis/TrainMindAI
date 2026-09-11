'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
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
    ]).then(([sessRes, wellRes]) => {
      if (sessRes.success && sessRes.data) setSessions(sessRes.data);
      if (wellRes.success && wellRes.data) setWellnessLogs(wellRes.data);
      setLoading(false);
    });
  }, []);

  // Simple wellness score: average of all fields (inverted for fatigue/soreness/stress)
  function wellnessScore(log: WellnessLog): number {
    const positive = log.sleepQuality + log.mood;
    const negative = (6 - log.fatigue) + (6 - log.soreness) + (6 - log.stress);
    return Math.round(((positive + negative) / 25) * 100);
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
      <h2 className="mb-4 text-xl font-bold text-slate-900 dark:text-white">Storico (30 giorni)</h2>

      {/* Tab switcher */}
      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        <button
          onClick={() => setTab('sessions')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            tab === 'sessions' ? 'bg-white text-teal-600 shadow-sm dark:bg-slate-700 dark:text-teal-400' : 'text-slate-500'
          }`}
        >
          <Dumbbell size={14} className="mb-0.5 mr-1 inline" /> Sessioni
        </button>
        <button
          onClick={() => setTab('wellness')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            tab === 'wellness' ? 'bg-white text-teal-600 shadow-sm dark:bg-slate-700 dark:text-teal-400' : 'text-slate-500'
          }`}
        >
          <Heart size={14} className="mb-0.5 mr-1 inline" /> Wellness
        </button>
      </div>

      {/* Sessions tab */}
      {tab === 'sessions' && (
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Nessuna sessione nell&apos;ultimo mese</p>
          ) : (
            sessions.map((s) => (
              <Link key={s.id} href={`/sessions/${s.id}`} className="block">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{s.title}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(s.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
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
            <p className="py-8 text-center text-sm text-slate-400">Nessun dato wellness nell&apos;ultimo mese</p>
          ) : (
            wellnessLogs.map((log) => {
              const score = wellnessScore(log);
              return (
                <div key={log.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {new Date(log.date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {log.sleepHours}h sonno · Qualità {log.sleepQuality}/5
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp size={14} className={score >= 70 ? 'text-green-500' : score >= 40 ? 'text-yellow-500' : 'text-red-500'} />
                      <span className={`text-lg font-bold ${score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {score}%
                      </span>
                    </div>
                  </div>
                  {/* Mini bars */}
                  <div className="mt-2 grid grid-cols-5 gap-1">
                    {[
                      { label: 'Fat', val: 6 - log.fatigue },
                      { label: 'Dol', val: 6 - log.soreness },
                      { label: 'Str', val: 6 - log.stress },
                      { label: 'Son', val: log.sleepQuality },
                      { label: 'Umo', val: log.mood },
                    ].map((item) => (
                      <div key={item.label} className="text-center">
                        <div className="mx-auto h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div
                            className="h-full rounded-full bg-teal-500"
                            style={{ width: `${(item.val / 5) * 100}%` }}
                          />
                        </div>
                        <span className="text-2xs text-slate-400">{item.label}</span>
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
