'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Heart, Moon, Frown, Activity, Brain, Smile, CheckCircle2 } from 'lucide-react';

const FIELDS = [
  { key: 'sleepQuality', label: 'Qualità sonno', icon: Moon, low: 'Pessimo', high: 'Eccellente' },
  { key: 'fatigue', label: 'Fatica', icon: Activity, low: 'Riposato', high: 'Esausto' },
  { key: 'soreness', label: 'Dolori muscolari', icon: Frown, low: 'Nessuno', high: 'Molto forte' },
  { key: 'stress', label: 'Stress', icon: Brain, low: 'Rilassato', high: 'Molto stressato' },
  { key: 'mood', label: 'Umore', icon: Smile, low: 'Pessimo', high: 'Ottimo' },
] as const;

type WellnessField = typeof FIELDS[number]['key'];

export default function WellnessPage() {
  const router = useRouter();
  const [sleepHours, setSleepHours] = useState(7);
  const [values, setValues] = useState<Record<WellnessField, number>>({
    sleepQuality: 3, fatigue: 3, soreness: 3, stress: 3, mood: 3,
  });
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);

  // Check if already submitted today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    api.getWellnessHistory({ from: today, to: today }).then((res: { success: boolean; data?: { sleepHours: number; sleepQuality: number; fatigue: number; soreness: number; stress: number; mood: number; notes?: string }[] }) => {
      if (res.success && res.data && res.data.length > 0) {
        const log = res.data[0];
        setSleepHours(log.sleepHours);
        setValues({
          sleepQuality: log.sleepQuality,
          fatigue: log.fatigue,
          soreness: log.soreness,
          stress: log.stress,
          mood: log.mood,
        });
        if (log.notes) setNotes(log.notes);
        setAlreadyDone(true);
      }
    });
  }, []);

  function setValue(key: WellnessField, val: number) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const today = new Date().toISOString().split('T')[0];
    const res = await api.submitWellness({
      date: today,
      sleepHours,
      ...values,
      notes: notes || undefined,
    });

    if (res.success) {
      setSubmitted(true);
      setTimeout(() => router.push('/home'), 1500);
    }
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <CheckCircle2 size={48} className="mb-4 text-green-500" />
        <p className="text-lg font-semibold text-slate-900 dark:text-white">Wellness inviato!</p>
        <p className="mt-1 text-sm text-slate-500">Reindirizzamento...</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Heart size={24} className="text-teal-600" />
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Wellness giornaliero</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {alreadyDone ? 'Puoi aggiornare le risposte' : 'Come ti senti oggi?'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sleep hours */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <Moon size={16} className="text-teal-500" /> Ore di sonno
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={12}
              step={0.5}
              value={sleepHours}
              onChange={(e) => setSleepHours(parseFloat(e.target.value))}
              className="flex-1 accent-teal-500"
            />
            <span className="w-12 text-center text-lg font-bold text-teal-600 dark:text-teal-400">{sleepHours}h</span>
          </div>
        </div>

        {/* Rating fields */}
        {FIELDS.map(({ key, label, icon: Icon, low, high }) => (
          <div key={key} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <label className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Icon size={16} className="text-teal-500" /> {label}
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setValue(key, n)}
                  className={`flex h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold transition ${
                    values[key] === n
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-2xs text-slate-400">
              <span>{low}</span>
              <span>{high}</span>
            </div>
          </div>
        ))}

        {/* Notes */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Note (opzionale)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Dolori specifici, sensazioni, note per il preparatore..."
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-teal-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
        >
          {submitting ? 'Invio...' : alreadyDone ? 'Aggiorna wellness' : 'Invia wellness'}
        </button>
      </form>
    </div>
  );
}
