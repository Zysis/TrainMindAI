'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api';
import { Dumbbell, Heart, ChevronRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface Session {
  id: string;
  title: string;
  date: string;
  duration: number;
  status: string;
  sessionExercises: { id: string }[];
  myLog?: { viewedAt?: string; actualRpe?: number; exerciseChecks?: Record<string, boolean> } | null;
}

interface WellnessLog {
  id: string;
  date: string;
}

export default function HomePage() {
  const { user } = useAuthStore();
  const [todaySession, setTodaySession] = useState<Session | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [wellnessDone, setWellnessDone] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    Promise.all([
      api.getSessions({ from: today, to: today }) as Promise<{ success: boolean; data?: Session[] }>,
      api.getSessions({ from: today, to: weekEnd, status: 'PLANNED' }) as Promise<{ success: boolean; data?: Session[] }>,
      api.getWellnessHistory({ from: today, to: today }) as Promise<{ success: boolean; data?: WellnessLog[] }>,
    ]).then(([todayRes, weekRes, wellnessRes]) => {
      if (todayRes.success && todayRes.data?.length) {
        setTodaySession(todayRes.data[0]);
      }
      if (weekRes.success && weekRes.data) {
        // Exclude today's session
        setUpcomingSessions(weekRes.data.filter((s) => s.date !== todayRes.data?.[0]?.date).slice(0, 3));
      }
      if (wellnessRes.success && wellnessRes.data?.length) {
        setWellnessDone(true);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  const greeting = getGreeting();
  const firstName = user?.athlete?.firstName || 'Atleta';

  return (
    <div className="space-y-6 px-4 py-6">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          {greeting}, {firstName}! 👋
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Wellness CTA */}
      {!wellnessDone ? (
        <Link href="/wellness" className="block">
          <div className="rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50 p-4 transition hover:border-teal-400 dark:border-teal-700 dark:bg-teal-950/30">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900">
                <Heart size={20} className="text-teal-600 dark:text-teal-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-teal-800 dark:text-teal-300">Wellness giornaliero</p>
                <p className="text-xs text-teal-600 dark:text-teal-500">Compila il tuo check-in di oggi</p>
              </div>
              <ChevronRight size={18} className="text-teal-400" />
            </div>
          </div>
        </Link>
      ) : (
        <div className="flex items-center gap-2 rounded-xl bg-success-50 px-4 py-3 dark:bg-success-700/20">
          <CheckCircle2 size={18} className="text-success-500" />
          <span className="text-sm font-medium text-success-700 dark:text-success-500">
            Wellness di oggi completato
          </span>
        </div>
      )}

      {/* Today's Session */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Allenamento di oggi
        </h3>
        {todaySession ? (
          <Link href={`/sessions/${todaySession.id}`} className="block">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card transition hover:shadow-card-hover dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900">
                  <Dumbbell size={24} className="text-teal-600 dark:text-teal-400" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white">{todaySession.title}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {todaySession.duration} min
                    </span>
                    <span>{todaySession.sessionExercises.length} esercizi</span>
                    {todaySession.myLog?.viewedAt && (
                      <span className="flex items-center gap-1 text-teal-600">
                        <CheckCircle2 size={12} /> Visto
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={18} className="mt-1 text-slate-300" />
              </div>
            </div>
          </Link>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-800">
            <AlertCircle size={24} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Nessuna sessione programmata per oggi</p>
          </div>
        )}
      </section>

      {/* Upcoming */}
      {upcomingSessions.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Prossime sessioni
          </h3>
          <div className="space-y-2">
            {upcomingSessions.map((session) => (
              <Link key={session.id} href={`/sessions/${session.id}`} className="block">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:shadow-card dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{session.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(session.date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {' · '}{session.duration} min
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}
