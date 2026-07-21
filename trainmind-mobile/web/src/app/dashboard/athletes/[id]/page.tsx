'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  ArrowLeft, Edit2, Dumbbell, Heart, Activity,
  AlertTriangle, Calendar, TrendingUp, TrendingDown, Minus, Sparkles,
  ChevronDown, ChevronUp, Ruler, Zap, Timer, Wind, StretchHorizontal, ClipboardList,
} from 'lucide-react';
import { apiFetch } from '@/lib/auth/fetch';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';
import { useToast } from '@/components/ui/toast';
import { PhotoPicker } from '@/components/ui/photo-picker';
import { calculateAge } from '@trainmind/utils';
import { AIWellnessInsights } from '@/components/ai/ai-wellness-insights';
import { MetricsForm, useMetricTypes, useMetricCategories } from '@/components/metrics';
import type { MetricType } from '@/components/metrics';
import { WellnessForm } from '@/components/wellness';
import { POSITION_OPTIONS } from '@/lib/constants/positions';
import type { AthleteDetail } from '@/types';

type Tab = 'panoramica' | 'schede' | 'metriche' | 'infortuni';

export default function AthleteProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations('athletes');
  const locale = useLocale();
  const [athlete, setAthlete] = useState<AthleteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('panoramica');
  const [showMetricsForm, setShowMetricsForm] = useState(false);
  const [metricsFormFilter, setMetricsFormFilter] = useState<string[] | undefined>(undefined);
  const [showWellnessForm, setShowWellnessForm] = useState(false);
  const [metrics, setMetrics] = useState<Array<{ id: string; type: string; value: number; unit: string; date: string; notes: string | null }>>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['anthropometric', 'strength', 'speed', 'endurance', 'flexibility', 'functional']));
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '', lastName: '', dateOfBirth: '', position: '', jerseyNumber: '', team: '',
    photoUrl: null as string | null,
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const loadMetrics = async () => {
    try {
      // Fetch in pages of 100 (API max) to get all metrics
      const page1 = await apiFetch<{ data: Array<{ id: string; type: string; value: number; unit: string; date: string; notes: string | null }>; meta: { totalPages: number } }>(
        `/metrics?athleteId=${id}&limit=100&page=1`,
      );
      let allMetrics = page1.data || [];
      if (page1.meta?.totalPages > 1) {
        const page2 = await apiFetch<{ data: Array<{ id: string; type: string; value: number; unit: string; date: string; notes: string | null }> }>(
          `/metrics?athleteId=${id}&limit=100&page=2`,
        );
        allMetrics = [...allMetrics, ...(page2.data || [])];
      }
      setMetrics(allMetrics);
    } catch (err) { console.error('Error loading metrics:', err); }
  };

  const openMetricsForm = (filterCategories?: string[]) => {
    setMetricsFormFilter(filterCategories);
    setShowMetricsForm(true);
  };

  const loadAthlete = async () => {
    try {
      const res = await apiFetch<{ data: AthleteDetail }>(`/athletes/${id}`);
      setAthlete(res.data);
    } catch {
      router.push('/dashboard/athletes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAthlete();
    loadMetrics();
  }, [id, router]);

  const openEditModal = () => {
    if (!athlete) return;
    setEditForm({
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      dateOfBirth: athlete.dateOfBirth.split('T')[0],
      position: athlete.position,
      jerseyNumber: athlete.jerseyNumber !== null ? String(athlete.jerseyNumber) : '',
      team: athlete.team || '',
      photoUrl: athlete.photoUrl || null,
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.firstName || !editForm.lastName || !editForm.position || !editForm.dateOfBirth) {
      toast('error', t('fillRequiredFields'));
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/athletes/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          dateOfBirth: editForm.dateOfBirth,
          position: editForm.position,
          jerseyNumber: editForm.jerseyNumber ? parseInt(editForm.jerseyNumber) : undefined,
          team: editForm.team || undefined,
          photoUrl: editForm.photoUrl || undefined,
        }),
      });
      toast('success', t('athleteUpdated'));
      setShowEditModal(false);
      loadAthlete();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('updateError'));
    } finally {
      setSaving(false);
    }
  };

  // Latest wing span from metrics for display in header (hook must be before conditional returns)
  const latestWingSpan = useMemo(() => {
    const wingSpans = metrics
      .filter((m) => m.type === 'wing_span')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return wingSpans[0]?.value || null;
  }, [metrics]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (!athlete) return null;

  const age = calculateAge(athlete.dateOfBirth);
  const lastWellness = athlete.wellnessLogs[0];
  const tabs: { key: Tab; label: string }[] = [
    { key: 'panoramica', label: t('tabOverview') },
    { key: 'schede', label: t('tabWorkouts') },
    { key: 'metriche', label: t('tabMetrics') },
    { key: 'infortuni', label: t('tabInjuries') },
  ];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button onClick={() => router.push('/dashboard/athletes')}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-300">
        <ArrowLeft className="h-4 w-4" /> {t('backToList')}
      </button>

      {/* Header */}
      <div className="card">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Avatar firstName={athlete.firstName} lastName={athlete.lastName} photoUrl={athlete.photoUrl} size="xl" />
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{athlete.firstName} {athlete.lastName}</h1>
              {athlete.jerseyNumber !== null && (
                <span className="text-lg font-bold text-slate-300 dark:text-slate-600">#{athlete.jerseyNumber}</span>
              )}
              <Badge variant={athlete.isActive ? 'success' : 'default'}>
                {athlete.isActive ? t('active') : t('inactive')}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
              <span>{athlete.position}</span>
              <span>{t('yearsOld', { age })}</span>
              {athlete.height && <span>{athlete.height} cm</span>}
              {athlete.weight && <span>{athlete.weight} kg</span>}
              {latestWingSpan && <span>{t('wingSpan', { value: latestWingSpan })}</span>}
              {athlete.team && <span>{athlete.team}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/dashboard/chat?athlete=${athlete.id}&name=${encodeURIComponent(`${athlete.firstName} ${athlete.lastName}`)}`)}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              <Sparkles className="h-4 w-4" /> {t('createAISheet')}
            </button>
            <button onClick={openEditModal} className="rounded-lg border border-slate-300 dark:border-slate-600 p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700">
              <Edit2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('sessionsLabel')} value={athlete._count.trainingSessions} subtitle={t('totalSub')} icon={Dumbbell} iconColor="bg-blue-100 text-blue-700" />
        <StatCard label={t('wellnessLog')} value={athlete._count.wellnessLogs} subtitle={t('registrations')} icon={Heart} iconColor="bg-pink-100 text-pink-700" />
        <StatCard label={t('moodLabel')} value={lastWellness ? `${lastWellness.mood}/5` : '--'} subtitle={t('lastRecorded')} icon={Activity} iconColor="bg-green-100 text-green-700" />
        <StatCard label={t('injuriesLabel')} value={athlete.injuries.length} subtitle={t('activeSub')} icon={AlertTriangle}
          iconColor={athlete.injuries.length > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'} />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-b-2 border-teal-600 text-teal-700'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-300'
              }`}>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'panoramica' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Physical Profile — Anthropometric */}
          <AthletePhysicalProfile
            metrics={metrics}
            onOpenMetricsForm={() => openMetricsForm(['anthropometric'])}
            locale={locale}
          />

          {/* Performance Summary */}
          <AthletePerformanceSummary
            metrics={metrics}
            onOpenMetricsForm={() => openMetricsForm(['strength', 'speed', 'endurance', 'flexibility'])}
            onGoToMetrics={() => setActiveTab('metriche')}
            locale={locale}
          />

          {/* Wellness trend */}
          <div className="card">
            <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">{t('wellnessLast7Days')}</h3>
            {athlete.wellnessLogs.length > 0 ? (
              <div className="space-y-3">
                {athlete.wellnessLogs.map((w) => (
                  <div key={w.id} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-900 px-3 py-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{new Date(w.date).toLocaleDateString(locale)}</span>
                    <div className="flex gap-3 text-xs">
                      <span>{t('sleep')}: <b>{w.sleepQuality}/5</b></span>
                      <span>{t('fatigue')}: <b>{w.fatigue}/5</b></span>
                      <span>{t('mood')}: <b>{w.mood}/5</b></span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">{t('noWellnessData')}</p>
            )}
          </div>

          {/* Active injuries */}
          <div className="card">
            <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">{t('activeInjuries')}</h3>
            {athlete.injuries.length > 0 ? (
              <div className="space-y-3">
                {athlete.injuries.map((inj) => (
                  <div key={inj.id} className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{inj.type}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{inj.location}</p>
                    </div>
                    <Badge variant="danger">{t('severity', { value: inj.severity })}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">{t('noActiveInjuries')}</p>
            )}
          </div>

          {/* AI Wellness Insights for this athlete */}
          <div className="lg:col-span-2">
            <AIWellnessInsights
              athleteId={athlete.id}
              athleteName={`${athlete.firstName} ${athlete.lastName}`}
            />
          </div>
        </div>
      )}

      {activeTab === 'schede' && (
        <div className="card flex h-48 items-center justify-center">
          <div className="text-center">
            <Calendar className="mx-auto mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-400 dark:text-slate-500">Le schede allenamento saranno disponibili nello Sprint 2</p>
          </div>
        </div>
      )}

      {activeTab === 'metriche' && (
        <MetricsTabContent
          metrics={metrics}
          expandedCategories={expandedCategories}
          onToggleCategory={(cat) => setExpandedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat); else next.add(cat);
            return next;
          })}
          onOpenMetricsForm={() => openMetricsForm(undefined)}
          onOpenWellnessForm={() => setShowWellnessForm(true)}
          locale={locale}
        />
      )}

      {activeTab === 'infortuni' && (
        <div className="card">
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Storico Infortuni</h3>
          <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
            {athlete._count.injuries === 0 ? 'Nessun infortunio registrato' : 'Storico completo disponibile nello Sprint 2'}
          </p>
        </div>
      )}
      {/* Forms */}
      <MetricsForm
        open={showMetricsForm}
        onClose={() => { setShowMetricsForm(false); setMetricsFormFilter(undefined); }}
        onSaved={loadMetrics}
        preselectedAthleteId={athlete.id}
        filterCategories={metricsFormFilter}
      />
      <WellnessForm
        open={showWellnessForm}
        onClose={() => setShowWellnessForm(false)}
        preselectedAthleteId={athlete.id}
      />

      {/* Edit Athlete Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={t('editAthleteModal')}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowEditModal(false)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700"
            >
              Annulla
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {saving ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex justify-center">
            <PhotoPicker
              value={editForm.photoUrl}
              onChange={(url) => setEditForm({ ...editForm, photoUrl: url })}
              label={t('photo')}
              size={96}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('firstNameRequired')}
              value={editForm.firstName}
              onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
            />
            <Input
              label={t('lastNameRequired')}
              value={editForm.lastName}
              onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('birthDateRequired')}
              type="date"
              value={editForm.dateOfBirth}
              onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
            />
            <Select
              label={t('roleRequired')}
              value={editForm.position}
              onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
              options={POSITION_OPTIONS}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('jerseyNumber')}
              type="number"
              value={editForm.jerseyNumber}
              onChange={(e) => setEditForm({ ...editForm, jerseyNumber: e.target.value })}
              placeholder="0-99"
            />
            <Input
              label={t('team')}
              value={editForm.team}
              onChange={(e) => setEditForm({ ...editForm, team: e.target.value })}
              placeholder="es. Olimpia Milano"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Physical Profile Card (Panoramica) ────────────────────

const ANTHROPOMETRIC_KEYS = ['height', 'body_weight', 'wing_span', 'body_fat'];

function AthletePhysicalProfile({
  metrics,
  onOpenMetricsForm,
  locale,
}: {
  metrics: Array<{ id: string; type: string; value: number; unit: string; date: string; notes: string | null }>;
  onOpenMetricsForm: () => void;
  locale: string;
}) {
  const latestByType = useMemo(() => {
    const map = new Map<string, { value: number; unit: string; date: string; prev?: { value: number; date: string } }>();
    // Sort all metrics by date descending
    const sorted = [...metrics].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    for (const m of sorted) {
      if (!ANTHROPOMETRIC_KEYS.includes(m.type)) continue;
      if (!map.has(m.type)) {
        map.set(m.type, { value: m.value, unit: m.unit, date: m.date });
      } else {
        const existing = map.get(m.type)!;
        if (!existing.prev) {
          existing.prev = { value: m.value, date: m.date };
        }
      }
    }
    return map;
  }, [metrics]);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: '2-digit' });

  const tAthletes = useTranslations('athletes');
  const metricTypes = useMetricTypes();
  const anthropoMetrics = metricTypes.filter((mt) => ANTHROPOMETRIC_KEYS.includes(mt.key));

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
            <Ruler className="h-4 w-4 text-blue-700" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{tAthletes('anthropometricSection')}</h3>
        </div>
        <button
          onClick={onOpenMetricsForm}
          className="text-xs font-medium text-teal-700 hover:text-teal-800"
        >
          {tAthletes('addMeasurement')}
        </button>
      </div>

      <div className="space-y-3">
        {anthropoMetrics.map((mt) => {
          const data = latestByType.get(mt.key);
          const variation = data?.prev
            ? ((data.value - data.prev.value) / data.prev.value) * 100
            : null;
          const improving = variation !== null && (mt.higherIsBetter ? variation > 0 : variation < 0);

          return (
            <div key={mt.key} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-900 px-3 py-2.5">
              <div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{mt.label}</span>
                <p className="text-xs text-slate-400 dark:text-slate-500">{mt.description}</p>
              </div>
              {data ? (
                <div className="flex items-center gap-2 text-right">
                  {variation !== null && Math.abs(variation) >= 0.5 && (
                    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-2xs font-medium ${
                      improving ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {improving ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                      {variation > 0 ? '+' : ''}{variation.toFixed(1)}%
                    </span>
                  )}
                  <div>
                    <span className="text-lg font-bold text-slate-900 dark:text-white">{data.value}</span>
                    <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">{data.unit}</span>
                    <p className="text-2xs text-slate-400 dark:text-slate-500">{fmtDate(data.date)}</p>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-slate-300 dark:text-slate-600">Non misurato</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Performance Summary Card (Panoramica) ──────────────────

const PERFORMANCE_CATEGORY_DEFS = [
  { key: 'strength', labelKey: 'catStrength', icon: Zap, color: 'bg-orange-50 text-orange-700' },
  { key: 'speed', labelKey: 'catSpeed', icon: Timer, color: 'bg-purple-50 text-purple-700' },
  { key: 'endurance', labelKey: 'catEndurance', icon: Wind, color: 'bg-green-50 text-green-700' },
  { key: 'flexibility', labelKey: 'catFlexibility', icon: StretchHorizontal, color: 'bg-pink-50 text-pink-700' },
];

function AthletePerformanceSummary({
  metrics,
  onOpenMetricsForm,
  onGoToMetrics,
  locale,
}: {
  metrics: Array<{ id: string; type: string; value: number; unit: string; date: string; notes: string | null }>;
  onOpenMetricsForm: () => void;
  onGoToMetrics: () => void;
  locale: string;
}) {
  const tAthletes = useTranslations('athletes');
  const tMetrics = useTranslations('metrics');
  const metricTypes = useMetricTypes();
  const PERFORMANCE_CATEGORIES = useMemo(
    () => PERFORMANCE_CATEGORY_DEFS.map((d) => ({ ...d, label: tMetrics(d.labelKey) })),
    [tMetrics]
  );
  // For each performance category, find the latest measurement across all types in that category
  const summaryByCategory = useMemo(() => {
    const sorted = [...metrics].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const result = new Map<string, { typeLabel: string; value: number; unit: string; date: string; count: number }>();

    for (const cat of PERFORMANCE_CATEGORIES) {
      const catTypes = metricTypes.filter((mt) => mt.category === cat.key);
      const catTypeKeys = new Set(catTypes.map((t) => t.key));
      const catMetrics = sorted.filter((m) => catTypeKeys.has(m.type));

      // Count unique types with data
      const uniqueTypes = new Set(catMetrics.map((m) => m.type));

      if (catMetrics.length > 0) {
        const latest = catMetrics[0];
        const mt = metricTypes.find((t) => t.key === latest.type);
        result.set(cat.key, {
          typeLabel: mt?.label || latest.type,
          value: latest.value,
          unit: latest.unit,
          date: latest.date,
          count: uniqueTypes.size,
        });
      }
    }
    return result;
  }, [metrics, metricTypes, PERFORMANCE_CATEGORIES]);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: '2-digit' });

  const hasAnyData = summaryByCategory.size > 0;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50">
            <Activity className="h-4 w-4 text-teal-700" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">{tAthletes('performancePhysical')}</h3>
        </div>
        <button
          onClick={onOpenMetricsForm}
          className="text-xs font-medium text-teal-700 hover:text-teal-800"
        >
          {tAthletes('addMeasurement')}
        </button>
      </div>

      {!hasAnyData ? (
        <div className="flex flex-col items-center py-6">
          <Activity className="mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400 dark:text-slate-500">{tAthletes('noTestRecorded')}</p>
          <button onClick={onOpenMetricsForm} className="mt-2 text-xs font-medium text-teal-700 hover:text-teal-800">
            {tAthletes('recordFirstTest')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {PERFORMANCE_CATEGORIES.map((cat) => {
            const data = summaryByCategory.get(cat.key);
            const Icon = cat.icon;
            const totalTypes = metricTypes.filter((mt) => mt.category === cat.key).length;

            return (
              <div key={cat.key} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-900 px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${cat.color.split(' ')[0]}`}>
                    <Icon className={`h-3.5 w-3.5 ${cat.color.split(' ')[1]}`} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{cat.label}</span>
                    {data && (
                      <p className="text-2xs text-slate-400 dark:text-slate-500">{tAthletes('testCountLast', { count: data.count, total: totalTypes, label: data.typeLabel })}</p>
                    )}
                  </div>
                </div>
                {data ? (
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{data.value}</span>
                    <span className="ml-0.5 text-xs text-slate-500 dark:text-slate-400">{data.unit}</span>
                    <p className="text-2xs text-slate-400 dark:text-slate-500">{fmtDate(data.date)}</p>
                  </div>
                ) : (
                  <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                )}
              </div>
            );
          })}

          <button
            onClick={onGoToMetrics}
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 transition-colors hover:border-teal-400 hover:text-teal-600"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            {tAthletes('viewAllMetrics')}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Category icons ─────────────────────────────────────────

const categoryIcons: Record<string, typeof Ruler> = {
  anthropometric: Ruler,
  strength: Zap,
  speed: Timer,
  endurance: Wind,
  flexibility: StretchHorizontal,
  functional: ClipboardList,
};

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  anthropometric: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  strength: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  speed: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  endurance: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  flexibility: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  functional: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
};

// ─── Metrics Tab Component ──────────────────────────────────

function MetricsTabContent({
  metrics,
  expandedCategories,
  onToggleCategory,
  onOpenMetricsForm,
  onOpenWellnessForm,
  locale,
}: {
  metrics: Array<{ id: string; type: string; value: number; unit: string; date: string; notes: string | null }>;
  expandedCategories: Set<string>;
  onToggleCategory: (cat: string) => void;
  onOpenMetricsForm: () => void;
  onOpenWellnessForm: () => void;
  locale: string;
}) {
  const tAthletes = useTranslations('athletes');
  const tWellness = useTranslations('wellness');
  const metricTypes = useMetricTypes();
  const metricCategories = useMetricCategories();
  // Group metrics by type, sorted by date (newest first)
  const metricsByType = useMemo(() => {
    const map = new Map<string, typeof metrics>();
    for (const m of metrics) {
      if (!map.has(m.type)) map.set(m.type, []);
      map.get(m.type)!.push(m);
    }
    // Sort each group by date descending
    for (const [, arr] of map) {
      arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return map;
  }, [metrics]);

  // Which metric types have data
  const typesWithData = useMemo(() => new Set(metrics.map((m) => m.type)), [metrics]);

  // Count metrics per category
  const countByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of metricCategories) {
      counts[cat.key] = metricTypes.filter((mt) => mt.category === cat.key && typesWithData.has(mt.key)).length;
    }
    return counts;
  }, [typesWithData, metricCategories, metricTypes]);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: '2-digit' });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{tAthletes('metricsAndMeasurements')}</h3>
        <div className="flex gap-2">
          <button
            onClick={onOpenWellnessForm}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700"
          >
            <Heart className="h-4 w-4" />
            {tWellness('title')}
          </button>
          <button
            onClick={onOpenMetricsForm}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            <TrendingUp className="h-4 w-4" />
            {tAthletes('newMeasurement')}
          </button>
        </div>
      </div>

      {metrics.length === 0 ? (
        <div className="card flex h-48 items-center justify-center">
          <div className="text-center">
            <TrendingUp className="mx-auto mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-400 dark:text-slate-500">{tAthletes('noTestRecorded')}</p>
            <button onClick={onOpenMetricsForm} className="mt-2 text-sm font-medium text-teal-700 hover:text-teal-800">
              {tAthletes('recordFirstTest')}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {metricCategories.map((cat) => {
            const catMetricTypes = metricTypes.filter((mt) => mt.category === cat.key);
            const hasData = catMetricTypes.some((mt) => typesWithData.has(mt.key));
            const isExpanded = expandedCategories.has(cat.key);
            const Icon = categoryIcons[cat.key] || ClipboardList;
            const colors = categoryColors[cat.key] || categoryColors.functional;

            return (
              <div key={cat.key} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
                {/* Category Header */}
                <button
                  onClick={() => onToggleCategory(cat.key)}
                  className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors.bg}`}>
                      <Icon className={`h-4 w-4 ${colors.text}`} />
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{cat.label}</span>
                      <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                        {countByCategory[cat.key]} / {catMetricTypes.length} metriche registrate
                      </span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400 dark:text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-400 dark:text-slate-500" />}
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700">
                    {catMetricTypes.map((mt) => {
                      const typeMetrics = metricsByType.get(mt.key) || [];
                      const latest = typeMetrics[0];
                      const previous = typeMetrics[1];
                      const variation = latest && previous
                        ? ((latest.value - previous.value) / previous.value) * 100
                        : null;
                      const improving = variation !== null && (mt.higherIsBetter ? variation > 0 : variation < 0);
                      const declining = variation !== null && (mt.higherIsBetter ? variation < 0 : variation > 0);

                      return (
                        <div key={mt.key} className="px-4 py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{mt.label}</span>
                                <span className="text-xs text-slate-400 dark:text-slate-500">{mt.unit}</span>
                              </div>
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{mt.description}</p>
                            </div>

                            {latest ? (
                              <div className="flex items-center gap-3 ml-4">
                                {/* Variation badge */}
                                {variation !== null && Math.abs(variation) >= 0.5 && (
                                  <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                                    improving ? 'bg-green-100 text-green-700' : declining ? 'bg-red-100 text-red-700' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                  }`}>
                                    {improving ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                    {variation > 0 ? '+' : ''}{variation.toFixed(1)}%
                                  </span>
                                )}
                                {variation !== null && Math.abs(variation) < 0.5 && (
                                  <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    <Minus className="h-3 w-3" /> 0%
                                  </span>
                                )}
                                {/* Latest value */}
                                <div className="text-right">
                                  <span className="text-lg font-bold text-slate-900 dark:text-white">{latest.value}</span>
                                  <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">{latest.unit}</span>
                                  <p className="text-xs text-slate-400 dark:text-slate-500">{fmtDate(latest.date)}</p>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300 dark:text-slate-600 ml-4">—</span>
                            )}
                          </div>

                          {/* History row (if more than 1 entry) */}
                          {typeMetrics.length > 1 && (
                            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto">
                              {typeMetrics.slice(0, 8).map((m, idx) => {
                                const prev = typeMetrics[idx + 1];
                                const delta = prev ? ((m.value - prev.value) / prev.value) * 100 : null;
                                const isGood = delta !== null && (mt.higherIsBetter ? delta > 0 : delta < 0);
                                const isBad = delta !== null && (mt.higherIsBetter ? delta < 0 : delta > 0);
                                return (
                                  <div
                                    key={m.id}
                                    className={`flex flex-col items-center rounded-lg border px-2.5 py-1.5 text-xs ${
                                      idx === 0 ? `${colors.bg} ${colors.border}` : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700'
                                    }`}
                                    title={m.notes || undefined}
                                  >
                                    <span className={`font-semibold ${idx === 0 ? colors.text : 'text-slate-700 dark:text-slate-300'}`}>
                                      {m.value}
                                    </span>
                                    <span className="text-slate-400 dark:text-slate-500">{fmtDate(m.date)}</span>
                                    {delta !== null && (
                                      <span className={`text-2xs font-medium ${isGood ? 'text-green-600' : isBad ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                                        {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                              {typeMetrics.length > 8 && (
                                <span className="text-xs text-slate-400 dark:text-slate-500 px-1">+{typeMetrics.length - 8}</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
