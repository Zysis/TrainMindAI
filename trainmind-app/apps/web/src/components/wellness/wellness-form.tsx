'use client';

import { useEffect, useMemo, useState } from 'react';
import { Heart, Moon, Battery, Activity, Brain, Smile, X, Save } from 'lucide-react';
import { apiFetch } from '@/lib/auth/fetch';
import { useToast } from '@/components/ui/toast';
import { useTranslations } from 'next-intl';

interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
}

interface WellnessFormProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  /** Pre-select a specific athlete */
  preselectedAthleteId?: string;
}

interface WellnessField {
  key: string;
  label: string;
  icon: typeof Moon;
  color: string;
  bgColor: string;
  labels: string[];
  description: string;
}

interface WellnessFieldDef {
  key: string;
  labelKey: string;
  icon: typeof Moon;
  color: string;
  bgColor: string;
  labelsKey: string;
  descKey: string;
}

const wellnessFieldDefs: WellnessFieldDef[] = [
  { key: 'sleepQuality', labelKey: 'sleepQuality', icon: Moon, color: 'text-indigo-500', bgColor: 'bg-indigo-50', labelsKey: 'sleepLabels', descKey: 'sleepDesc' },
  { key: 'fatigue', labelKey: 'fatigue', icon: Battery, color: 'text-amber-500', bgColor: 'bg-amber-50', labelsKey: 'fatigueLabels', descKey: 'fatigueDesc' },
  { key: 'soreness', labelKey: 'soreness', icon: Activity, color: 'text-red-500', bgColor: 'bg-red-50', labelsKey: 'sorenessLabels', descKey: 'sorenessDesc' },
  { key: 'stress', labelKey: 'stress', icon: Brain, color: 'text-orange-500', bgColor: 'bg-orange-50', labelsKey: 'stressLabels', descKey: 'stressDesc' },
  { key: 'mood', labelKey: 'mood', icon: Smile, color: 'text-green-500', bgColor: 'bg-green-50', labelsKey: 'moodLabels', descKey: 'moodDesc' },
];

export function WellnessForm({ open, onClose, onSaved, preselectedAthleteId }: WellnessFormProps) {
  const { toast } = useToast();
  const t = useTranslations('wellness');
  const tCommon = useTranslations('common');
  const wellnessFields: WellnessField[] = useMemo(
    () =>
      wellnessFieldDefs.map((d) => ({
        key: d.key,
        label: t(d.labelKey),
        icon: d.icon,
        color: d.color,
        bgColor: d.bgColor,
        labels: t.raw(d.labelsKey) as string[],
        description: t(d.descKey),
      })),
    [t]
  );
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [athleteId, setAthleteId] = useState(preselectedAthleteId || '');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sleepHours, setSleepHours] = useState(7);
  const [values, setValues] = useState<Record<string, number>>({
    sleepQuality: 3,
    fatigue: 2,
    soreness: 2,
    stress: 2,
    mood: 3,
  });
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Load athletes
  useEffect(() => {
    if (!open) return;
    const loadAthletes = async () => {
      try {
        const res = await apiFetch<{ data: Athlete[] }>('/athletes?limit=100');
        setAthletes(res.data);
        if (!athleteId && res.data.length > 0) {
          setAthleteId(preselectedAthleteId || res.data[0].id);
        }
      } catch { /* ignore */ }
    };
    loadAthletes();
  }, [open]);

  const updateValue = (key: string, val: number) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    if (!athleteId) {
      toast('error', t('selectAthlete'));
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athleteId,
          date,
          sleepHours,
          sleepQuality: values.sleepQuality,
          fatigue: values.fatigue,
          soreness: values.soreness,
          stress: values.stress,
          mood: values.mood,
          notes: notes || undefined,
        }),
      });
      toast('success', t('logged'));
      onSaved?.();
      onClose();
    } catch {
      toast('error', t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Slide-in panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white dark:bg-slate-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-5 py-4">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('modalTitle')}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Athlete + date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{tCommon('athlete')}</label>
              <select
                value={athleteId}
                onChange={(e) => setAthleteId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="">{t('select')}</option>
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.firstName} {a.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('dateLabel')}</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Sleep hours */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('sleepHours')}</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={12}
                step={0.5}
                value={sleepHours}
                onChange={(e) => setSleepHours(parseFloat(e.target.value))}
                className="flex-1 accent-indigo-500"
              />
              <span className="w-12 text-center text-lg font-bold text-slate-900 dark:text-white">{sleepHours}h</span>
            </div>
          </div>

          {/* Wellness sliders */}
          {wellnessFields.map((field) => {
            const val = values[field.key];
            const Icon = field.icon;
            return (
              <div key={field.key}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${field.bgColor}`}>
                    <Icon className={`h-4 w-4 ${field.color}`} />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-slate-700">{field.label}</span>
                    <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{field.description}</span>
                  </div>
                </div>

                {/* Visual scale buttons */}
                <div className="flex gap-2 mt-2">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      onClick={() => updateValue(field.key, v)}
                      className={`flex-1 rounded-lg py-2.5 text-center transition-all ${
                        val === v
                          ? 'bg-teal-700 text-white font-semibold shadow-sm scale-105'
                          : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700'
                      }`}
                    >
                      <span className="block text-lg font-bold">{v}</span>
                      <span className="block text-2xs mt-0.5 leading-tight">{field.labels[v - 1]}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('notesLabel')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notesPlaceholder')}
              rows={3}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-5 py-4">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900"
            >
              {tCommon('cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !athleteId}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {saving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? t('saving') : tCommon('save')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
