'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Dumbbell, Clock, ChevronRight, CheckCircle2, Eye } from 'lucide-react';

interface Session {
  id: string;
  title: string;
  date: string;
  duration: number;
  status: string;
  sessionExercises: { id: string }[];
  myLog?: { viewedAt?: string; actualRpe?: number } | null;
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  PLANNED: { text: 'Programmata', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  IN_PROGRESS: { text: 'In corso', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' },
  COMPLETED: { text: 'Completata', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  CANCELLED: { text: 'Cancellata', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load current week sessions
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    api.getSessions({
      from: monday.toISOString().split('T')[0],
      to: sunday.toISOString().split('T')[0],
    }).then((res: { success: boolean; data?: Session[] }) => {
      if (res.success && res.data) {
        setSessions(res.data);
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

  // Group by day
  const grouped = sessions.reduce<Record<string, Session[]>>((acc, s) => {
    const day = s.date ? new Date(s.date).toISOString().split('T')[0] : 'senza-data';
    if (!acc[day]) acc[day] = [];
    acc[day].push(s);
    return acc;
  }, {});

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6 px-4 py-6">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">Sessioni della settimana</h2>

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
          <Dumbbell size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Nessuna sessione programmata questa settimana</p>
        </div>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, daySessions]) => (
            <section key={day}>
              <h3 className={`mb-2 text-sm font-semibold uppercase tracking-wider ${
                day === today ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'
              }`}>
                {day === today ? '📍 Oggi' : formatDay(day)}
              </h3>
              <div className="space-y-2">
                {daySessions.map((session) => {
                  const status = STATUS_LABEL[session.status] || STATUS_LABEL.PLANNED;
                  return (
                    <Link key={session.id} href={`/sessions/${session.id}`} className="block">
                      <div className="rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-card dark:border-slate-700 dark:bg-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-900/40">
                            <Dumbbell size={18} className="text-teal-600 dark:text-teal-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium text-slate-900 dark:text-white">{session.title}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1"><Clock size={11} /> {session.duration} min</span>
                              <span>{session.sessionExercises.length} esercizi</span>
                              <span className={`rounded-full px-2 py-0.5 text-2xs font-medium ${status.color}`}>
                                {status.text}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {session.myLog?.viewedAt && <Eye size={14} className="text-teal-500" />}
                            {session.myLog?.actualRpe && <CheckCircle2 size={14} className="text-green-500" />}
                            <ChevronRight size={16} className="text-slate-300" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))
      )}
    </div>
  );
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' });
}
