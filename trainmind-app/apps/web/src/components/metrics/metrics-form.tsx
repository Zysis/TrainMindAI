'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { X, Save, TrendingUp, TrendingDown, Minus, Calculator } from 'lucide-react';
import { apiFetch } from '@/lib/auth/fetch';
import { useToast } from '@/components/ui/toast';

// ============================================================
// Types
// ============================================================

interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
}

interface Metric {
  id: string;
  type: string;
  value: number;
  unit: string;
  date: string;
  notes: string | null;
}

interface MetricType {
  key: string;
  label: string;
  unit: string;
  description: string;
  min: number;
  max: number;
  step: number;
  higherIsBetter: boolean;
  category: 'anthropometric' | 'strength' | 'speed' | 'endurance' | 'flexibility' | 'functional';
}

interface MetricCategory {
  key: string;
  label: string;
}

interface MetricTypeDef {
  key: string;
  labelKey: string;
  unit: string;
  descKey: string;
  min: number;
  max: number;
  step: number;
  higherIsBetter: boolean;
  category: 'anthropometric' | 'strength' | 'speed' | 'endurance' | 'flexibility' | 'functional';
}

interface MetricCategoryDef {
  key: string;
  labelKey: string;
}

interface MetricsFormProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  preselectedAthleteId?: string;
  /** Filter to show only specific categories (e.g. ['anthropometric'] or ['strength','speed','endurance','flexibility']) */
  filterCategories?: string[];
}

// ============================================================
// Metric categories & type definitions
// ============================================================

const metricCategoryDefs: MetricCategoryDef[] = [
  { key: 'anthropometric', labelKey: 'catAnthropometric' },
  { key: 'strength', labelKey: 'catStrength' },
  { key: 'speed', labelKey: 'catSpeed' },
  { key: 'endurance', labelKey: 'catEndurance' },
  { key: 'flexibility', labelKey: 'catFlexibility' },
  { key: 'functional', labelKey: 'catFunctional' },
];

const metricTypeDefs: MetricTypeDef[] = [
  // ── Anthropometric ──
  { key: 'height', labelKey: 'mt_height', unit: 'cm', descKey: 'mtDesc_height', min: 100, max: 250, step: 0.5, higherIsBetter: true, category: 'anthropometric' },
  { key: 'body_weight', labelKey: 'mt_body_weight', unit: 'kg', descKey: 'mtDesc_body_weight', min: 30, max: 180, step: 0.1, higherIsBetter: false, category: 'anthropometric' },
  { key: 'wing_span', labelKey: 'mt_wing_span', unit: 'cm', descKey: 'mtDesc_wing_span', min: 100, max: 280, step: 0.5, higherIsBetter: true, category: 'anthropometric' },
  { key: 'body_fat', labelKey: 'mt_body_fat', unit: '%', descKey: 'mtDesc_body_fat', min: 3, max: 40, step: 0.1, higherIsBetter: false, category: 'anthropometric' },

  // ── Strength ──
  { key: '1rm_squat', labelKey: 'mt_1rm_squat', unit: 'kg', descKey: 'mtDesc_1rm_squat', min: 20, max: 400, step: 2.5, higherIsBetter: true, category: 'strength' },
  { key: '1rm_bench', labelKey: 'mt_1rm_bench', unit: 'kg', descKey: 'mtDesc_1rm_bench', min: 20, max: 300, step: 2.5, higherIsBetter: true, category: 'strength' },
  { key: '1rm_deadlift', labelKey: 'mt_1rm_deadlift', unit: 'kg', descKey: 'mtDesc_1rm_deadlift', min: 20, max: 400, step: 2.5, higherIsBetter: true, category: 'strength' },
  { key: 'cmj', labelKey: 'mt_cmj', unit: 'cm', descKey: 'mtDesc_cmj', min: 10, max: 80, step: 0.5, higherIsBetter: true, category: 'strength' },
  { key: 'vertical_jump', labelKey: 'mt_vertical_jump', unit: 'cm', descKey: 'mtDesc_vertical_jump', min: 20, max: 100, step: 0.5, higherIsBetter: true, category: 'strength' },
  { key: 'standing_long_jump', labelKey: 'mt_standing_long_jump', unit: 'cm', descKey: 'mtDesc_standing_long_jump', min: 100, max: 350, step: 1, higherIsBetter: true, category: 'strength' },
  { key: 'med_ball_throw', labelKey: 'mt_med_ball_throw', unit: 'm', descKey: 'mtDesc_med_ball_throw', min: 2, max: 20, step: 0.1, higherIsBetter: true, category: 'strength' },

  // ── Speed ──
  { key: 'sprint_10m', labelKey: 'mt_sprint_10m', unit: 's', descKey: 'mtDesc_sprint_10m', min: 1.0, max: 3.0, step: 0.01, higherIsBetter: false, category: 'speed' },
  { key: 'sprint_20m', labelKey: 'mt_sprint_20m', unit: 's', descKey: 'mtDesc_sprint_20m', min: 2.0, max: 5.0, step: 0.01, higherIsBetter: false, category: 'speed' },
  { key: 'sprint_40m', labelKey: 'mt_sprint_40m', unit: 's', descKey: 'mtDesc_sprint_40m', min: 4.0, max: 8.0, step: 0.01, higherIsBetter: false, category: 'speed' },
  { key: 't_test', labelKey: 'mt_t_test', unit: 's', descKey: 'mtDesc_t_test', min: 8.0, max: 15.0, step: 0.01, higherIsBetter: false, category: 'speed' },
  { key: 'illinois_test', labelKey: 'mt_illinois_test', unit: 's', descKey: 'mtDesc_illinois_test', min: 14.0, max: 22.0, step: 0.01, higherIsBetter: false, category: 'speed' },
  { key: 'lane_agility', labelKey: 'mt_lane_agility', unit: 's', descKey: 'mtDesc_lane_agility', min: 10.0, max: 16.0, step: 0.01, higherIsBetter: false, category: 'speed' },
  { key: 'three_quarter_sprint', labelKey: 'mt_three_quarter_sprint', unit: 's', descKey: 'mtDesc_three_quarter_sprint', min: 2.5, max: 5.0, step: 0.01, higherIsBetter: false, category: 'speed' },

  // ── Endurance ──
  { key: 'yo_yo_ir1', labelKey: 'mt_yo_yo_ir1', unit: 'm', descKey: 'mtDesc_yo_yo_ir1', min: 200, max: 3000, step: 40, higherIsBetter: true, category: 'endurance' },
  { key: 'yo_yo_ir2', labelKey: 'mt_yo_yo_ir2', unit: 'm', descKey: 'mtDesc_yo_yo_ir2', min: 200, max: 2000, step: 40, higherIsBetter: true, category: 'endurance' },
  { key: 'beep_test', labelKey: 'mt_beep_test', unit: 'level', descKey: 'mtDesc_beep_test', min: 1, max: 21, step: 0.5, higherIsBetter: true, category: 'endurance' },
  { key: 'vo2_max', labelKey: 'mt_vo2_max', unit: 'ml/kg/min', descKey: 'mtDesc_vo2_max', min: 20, max: 80, step: 0.1, higherIsBetter: true, category: 'endurance' },
  { key: 'cooper_test', labelKey: 'mt_cooper_test', unit: 'm', descKey: 'mtDesc_cooper_test', min: 1000, max: 4000, step: 10, higherIsBetter: true, category: 'endurance' },

  // ── Flexibility ──
  { key: 'sit_and_reach', labelKey: 'mt_sit_and_reach', unit: 'cm', descKey: 'mtDesc_sit_and_reach', min: -20, max: 50, step: 0.5, higherIsBetter: true, category: 'flexibility' },
  { key: 'ankle_dorsiflexion', labelKey: 'mt_ankle_dorsiflexion', unit: 'cm', descKey: 'mtDesc_ankle_dorsiflexion', min: 0, max: 20, step: 0.5, higherIsBetter: true, category: 'flexibility' },
  { key: 'hip_flexion', labelKey: 'mt_hip_flexion', unit: '°', descKey: 'mtDesc_hip_flexion', min: 0, max: 180, step: 1, higherIsBetter: true, category: 'flexibility' },
  { key: 'shoulder_mobility', labelKey: 'mt_shoulder_mobility', unit: 'cm', descKey: 'mtDesc_shoulder_mobility', min: 0, max: 40, step: 0.5, higherIsBetter: false, category: 'flexibility' },

  // ── Functional ──
  { key: 'ybt_left', labelKey: 'mt_ybt_left', unit: 'cm', descKey: 'mtDesc_ybt_left', min: 40, max: 120, step: 0.5, higherIsBetter: true, category: 'functional' },
  { key: 'ybt_right', labelKey: 'mt_ybt_right', unit: 'cm', descKey: 'mtDesc_ybt_right', min: 40, max: 120, step: 0.5, higherIsBetter: true, category: 'functional' },
  { key: 'fms_total', labelKey: 'mt_fms_total', unit: 'pt', descKey: 'mtDesc_fms_total', min: 0, max: 21, step: 1, higherIsBetter: true, category: 'functional' },
];

// Helpers — build localized lookup tables
type MetricsTranslator = (key: string, values?: Record<string, string | number>) => string;
export function localizeMetricTypes(t: MetricsTranslator): MetricType[] {
  return metricTypeDefs.map((d) => ({
    key: d.key,
    label: t(d.labelKey),
    unit: d.unit,
    description: t(d.descKey),
    min: d.min,
    max: d.max,
    step: d.step,
    higherIsBetter: d.higherIsBetter,
    category: d.category,
  }));
}
export function localizeMetricCategories(t: MetricsTranslator): MetricCategory[] {
  return metricCategoryDefs.map((d) => ({ key: d.key, label: t(d.labelKey) }));
}

// Hooks for components
export function useMetricTypes(): MetricType[] {
  const t = useTranslations('metrics');
  return useMemo(() => localizeMetricTypes(t as MetricsTranslator), [t]);
}
export function useMetricCategories(): MetricCategory[] {
  const t = useTranslations('metrics');
  return useMemo(() => localizeMetricCategories(t as MetricsTranslator), [t]);
}

// Export raw defs (for filter logic that doesn't need localized labels)
export { metricTypeDefs, metricCategoryDefs };
export type { MetricType, MetricCategory };

// 1RM calculation from reps at fatigue (Epley formula)
function calculate1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

// ============================================================
// Component
// ============================================================

export function MetricsForm({ open, onClose, onSaved, preselectedAthleteId, filterCategories }: MetricsFormProps) {
  const { toast } = useToast();
  const locale = useLocale();
  const t = useTranslations('metrics');
  const tCommon = useTranslations('common');
  const metricCategories = useMetricCategories();
  const metricTypes = useMetricTypes();

  // Filtered categories and types
  const visibleCategories = filterCategories
    ? metricCategories.filter((c) => filterCategories.includes(c.key))
    : metricCategories;
  const visibleTypes = filterCategories
    ? metricTypes.filter((mt) => filterCategories.includes(mt.category))
    : metricTypes;

  // Form state
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [athleteId, setAthleteId] = useState(preselectedAthleteId || '');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedType, setSelectedType] = useState(visibleTypes[0]?.key || metricTypes[0].key);
  const [value, setValue] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // 1RM calculator
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcWeight, setCalcWeight] = useState<number | ''>('');
  const [calcReps, setCalcReps] = useState<number | ''>('');

  // History
  const [history, setHistory] = useState<Metric[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Reset selected type when filter changes
  useEffect(() => {
    if (open && visibleTypes.length > 0 && !visibleTypes.find((t) => t.key === selectedType)) {
      setSelectedType(visibleTypes[0].key);
    }
  }, [open, filterCategories]);

  const currentMetricType = metricTypes.find((m) => m.key === selectedType)!;
  const is1RM = selectedType.startsWith('1rm_');

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

  // Load history when athlete or type changes
  useEffect(() => {
    if (!open || !athleteId) return;
    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const res = await apiFetch<{ data: Metric[] }>(
          `/metrics?athleteId=${athleteId}&type=${selectedType}&limit=10`,
        );
        setHistory(res.data || []);
      } catch {
        setHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    };
    loadHistory();
  }, [open, athleteId, selectedType]);

  const handleSave = async () => {
    if (!athleteId) {
      toast('error', t('selectAthlete'));
      return;
    }
    if (value === '' || value <= 0) {
      toast('error', t('invalidValue'));
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athleteId,
          date,
          type: selectedType,
          value: Number(value),
          unit: currentMetricType.unit,
          notes: notes || undefined,
        }),
      });
      toast('success', t('recorded', { label: currentMetricType.label }));
      onSaved?.();
      // Reset value but keep athlete/type/date
      setValue('');
      setNotes('');
      // Reload history
      const res = await apiFetch<{ data: Metric[] }>(
        `/metrics?athleteId=${athleteId}&type=${selectedType}&limit=10`,
      );
      setHistory(res.data || []);
    } catch {
      toast('error', t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  // % variation from previous
  const previousValue = history.length > 0 ? history[0].value : null;
  const variation = previousValue && value !== ''
    ? ((Number(value) - previousValue) / previousValue) * 100
    : null;

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white dark:bg-slate-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('modalTitle')}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400">
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
                  <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
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

          {/* Metric type selector — grouped by category */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('testTypeLabel')}</label>
            <select
              value={selectedType}
              onChange={(e) => { setSelectedType(e.target.value); setValue(''); }}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              {visibleCategories.map((cat) => (
                <optgroup key={cat.key} label={cat.label}>
                  {visibleTypes.filter((mt) => mt.category === cat.key).map((mt) => (
                    <option key={mt.key} value={mt.key}>
                      {mt.label} ({mt.unit})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{currentMetricType.description}</p>
          </div>

          {/* Value input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-700">
                {t('valueLabel')} ({currentMetricType.unit})
              </label>
              {is1RM && (
                <button
                  onClick={() => setShowCalculator(!showCalculator)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800"
                >
                  <Calculator className="h-3.5 w-3.5" />
                  {showCalculator ? t('directInput') : t('calcFromReps')}
                </button>
              )}
            </div>

            {showCalculator && is1RM ? (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3 bg-slate-50 dark:bg-slate-900">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('epleyHint')}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">{t('weightKg')}</label>
                    <input
                      type="number"
                      step="2.5"
                      value={calcWeight}
                      onChange={(e) => {
                        const w = parseFloat(e.target.value) || '';
                        setCalcWeight(w);
                        if (w && calcReps) setValue(calculate1RM(Number(w), Number(calcReps)));
                      }}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-center focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">{t('repsToFailure')}</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={calcReps}
                      onChange={(e) => {
                        const r = parseInt(e.target.value) || '';
                        setCalcReps(r);
                        if (calcWeight && r) setValue(calculate1RM(Number(calcWeight), Number(r)));
                      }}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-center focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                </div>
                {value !== '' && (
                  <p className="text-center text-lg font-bold text-teal-700">
                    {t('estimated1RM')}: {value} {currentMetricType.unit}
                  </p>
                )}
              </div>
            ) : (
              <input
                type="number"
                step={currentMetricType.step}
                min={currentMetricType.min}
                value={value}
                onChange={(e) => setValue(parseFloat(e.target.value) || '')}
                placeholder={`${currentMetricType.min} - ${currentMetricType.max}`}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-lg font-medium text-center focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            )}

            {/* Variation badge */}
            {variation !== null && (
              <div className="mt-2 flex items-center justify-center gap-1.5">
                {Math.abs(variation) < 0.5 ? (
                  <Minus className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                ) : (currentMetricType.higherIsBetter ? variation > 0 : variation < 0) ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className={`text-sm font-medium ${
                  Math.abs(variation) < 0.5
                    ? 'text-slate-400 dark:text-slate-500'
                    : (currentMetricType.higherIsBetter ? variation > 0 : variation < 0)
                      ? 'text-green-600'
                      : 'text-red-600'
                }`}>
                  {variation > 0 ? '+' : ''}{variation.toFixed(1)}% {t('vsPrevious')} ({previousValue} {currentMetricType.unit})
                </span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('notesLabel')}</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notesPlaceholder')}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* History */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('history')} ({currentMetricType.label})</h3>
            {loadingHistory ? (
              <div className="flex h-20 items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">{t('noPreviousData')}</p>
            ) : (
              <div className="space-y-1.5">
                {history.map((m, idx) => {
                  const prevM = history[idx + 1];
                  const delta = prevM ? ((m.value - prevM.value) / prevM.value) * 100 : null;
                  return (
                    <div key={m.id} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-900 px-3 py-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(m.date).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: '2-digit' })}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {m.value} {m.unit}
                        </span>
                        {delta !== null && (
                          <span className={`text-xs font-medium ${
                            (currentMetricType.higherIsBetter ? delta > 0 : delta < 0) ? 'text-green-600' : delta === 0 ? 'text-slate-400 dark:text-slate-500' : 'text-red-600'
                          }`}>
                            {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-5 py-4">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900"
            >
              {tCommon('close')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !athleteId || value === ''}
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
