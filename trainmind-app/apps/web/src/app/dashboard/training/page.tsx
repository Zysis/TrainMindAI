'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Dumbbell, Plus, Calendar, BookOpen, Users, Clock, ChevronRight, Search, Sparkles, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/auth/fetch';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { AIGenerateModal } from '@/components/ai/ai-generate-modal';
import { useTeam } from '@/hooks/use-team';
import { useTranslations, useLocale } from 'next-intl';

interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
}

interface TrainingPlan {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  athleteId: string | null;
  athlete: Athlete | null;
  createdBy: { id: string; firstName: string; lastName: string };
  _count: { weeks: number };
  createdAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta: { total: number; page: number; totalPages: number };
}

function formatDate(date: string, locale: string) {
  return new Date(date).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

function getPlanStatus(start: string, end: string, t: (key: string) => string): { label: string; variant: 'success' | 'teal' | 'default' } {
  const now = new Date();
  const s = new Date(start);
  const e = new Date(end);
  if (now < s) return { label: t('planned'), variant: 'default' };
  if (now > e) return { label: t('completedStatus'), variant: 'success' };
  return { label: t('inProgress'), variant: 'teal' };
}

export default function TrainingPage() {
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedTeamId, teams } = useTeam();
  const t = useTranslations('training');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const [form, setForm] = useState({
    name: '',
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    athleteId: '',
    weeks: '4',
    teamId: '',
  });

  // Auto-calc endDate from startDate + weeks
  const calcEndDate = (start: string, weeks: string) => {
    if (!start || !weeks) return '';
    const d = new Date(start);
    d.setDate(d.getDate() + parseInt(weeks) * 7);
    return d.toISOString().split('T')[0];
  };
  const computedEndDate = calcEndDate(form.startDate, form.weeks);

  const loadPlans = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (selectedTeamId) params.set('teamId', selectedTeamId);
      const res = await apiFetch<ApiResponse<TrainingPlan[]>>(`/training/plans?${params}`);
      setPlans(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAthletes = async () => {
    try {
      const res = await apiFetch<ApiResponse<Athlete[]>>('/athletes?limit=100');
      setAthletes(res.data);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadPlans();
    loadAthletes();
  }, [selectedTeamId]);

  // Auto-open create modal when coming from periodization
  useEffect(() => {
    if (searchParams.get('create') === '1') {
      const mesoName = searchParams.get('mesoName') || '';
      const weeks = searchParams.get('weeks') || '4';
      setForm((f) => ({
        ...f,
        name: mesoName ? `${mesoName} — Sessione` : '',
        weeks,
        teamId: selectedTeamId || '',
      }));
      setShowCreate(true);
      // Clean URL params
      router.replace('/dashboard/training', { scroll: false });
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(loadPlans, 300);
    return () => clearTimeout(timer);
  }, [search, selectedTeamId]);

  const handleCreate = async () => {
    if (!form.name || !form.startDate || !computedEndDate) {
      toast('error', t('fillRequiredFields'));
      return;
    }
    setCreating(true);
    try {
      await apiFetch('/training/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          startDate: form.startDate,
          endDate: computedEndDate,
          athleteId: form.athleteId || undefined,
          teamId: form.teamId || undefined,
          weeks: parseInt(form.weeks) || 4,
        }),
      });
      toast('success', t('mesocycleCreated'));
      setShowCreate(false);
      setForm({ name: '', description: '', startDate: new Date().toISOString().split('T')[0], athleteId: '', weeks: '4', teamId: '' });
      loadPlans();
    } catch {
      toast('error', t('mesocycleCreateError'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (planId: string, planName: string) => {
    if (!confirm(t('deleteMesocycleConfirm', { name: planName }))) return;
    setDeleting(planId);
    try {
      await apiFetch(`/training/plans/${planId}`, { method: 'DELETE' });
      toast('success', t('mesocycleDeleted', { name: planName }));
      loadPlans();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('deleteError'));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAIGenerate(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-100"
          >
            <Sparkles className="h-4 w-4" />
            {t('generateAI')}
          </button>
          <button
            onClick={() => { setForm((f) => ({ ...f, teamId: selectedTeamId || '' })); setShowCreate(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            {t('newMesocycle')}
          </button>
        </div>
      </div>

      {/* Search + quick links */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchMesocycles')}
            className="input-field w-full pl-10"
          />
        </div>
        <Link
          href="/dashboard/exercises"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700"
        >
          <BookOpen className="h-4 w-4" />
          {t('exerciseLibrary')}
        </Link>
      </div>

      {/* Plans grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      ) : plans.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16">
          <Dumbbell className="mb-3 h-12 w-12 text-slate-300 dark:text-slate-600" />
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">{t('noMesocycles')}</p>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">{t('createFirstMesocycle')}</p>
          <button
            onClick={() => { setForm((f) => ({ ...f, teamId: selectedTeamId || '' })); setShowCreate(true); }}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            {t('createMesocycle')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {plans.map((plan) => {
            const status = getPlanStatus(plan.startDate, plan.endDate, t);
            const isDeleting = deleting === plan.id;
            return (
              <div
                key={plan.id}
                onClick={() => router.push(`/dashboard/training/${plan.id}`)}
                className="card-hover group cursor-pointer relative"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white group-hover:text-teal-700">
                        {plan.name}
                      </h3>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    {plan.description && (
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{plan.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(plan.id, plan.name); }}
                      disabled={isDeleting}
                      className="rounded-lg p-1.5 text-slate-300 dark:text-slate-600 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                      title={t('deletePlan')}
                    >
                      {isDeleting ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                    <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-300 dark:text-slate-600 transition-colors group-hover:text-teal-600" />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(plan.startDate, locale)} — {formatDate(plan.endDate, locale)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {t('nWeeks', { n: plan._count.weeks })}
                  </span>
                  {plan.athlete ? (
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {plan.athlete.firstName} {plan.athlete.lastName}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {t('teamMesocycle')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Plan Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t('newMesocycle')}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700"
            >
              Annulla
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {creating ? t('creating') : t('createMesocycle')}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nome del mesociclo *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="es. Preparazione Pre-Stagione"
          />
          <Input
            label={tCommon('description')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={t('mesocycleDescPlaceholder')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Data inizio *"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
            <Select
              label="Numero settimane *"
              value={form.weeks}
              onChange={(e) => setForm({ ...form, weeks: e.target.value })}
              options={[
                { value: '2', label: '2 settimane' },
                { value: '3', label: '3 settimane' },
                { value: '4', label: '4 settimane' },
                { value: '6', label: '6 settimane' },
                { value: '8', label: '8 settimane' },
                { value: '12', label: '12 settimane' },
              ]}
            />
          </div>
          {computedEndDate && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Data fine calcolata: <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(computedEndDate, locale)}</span>
            </p>
          )}
          <Select
            label="Atleta (opzionale)"
            value={form.athleteId}
            onChange={(e) => setForm({ ...form, athleteId: e.target.value })}
            options={[
              { value: '', label: 'Mesociclo di squadra' },
              ...athletes.map((a) => ({
                value: a.id,
                label: `${a.firstName} ${a.lastName} (${a.position})`,
              })),
            ]}
          />
          <Select
            label={t('team')}
            value={form.teamId}
            onChange={(e) => setForm({ ...form, teamId: e.target.value })}
            options={[
              { value: '', label: 'Nessuna squadra' },
              ...teams.map((t) => ({ value: t.id, label: t.name })),
            ]}
          />
        </div>
      </Modal>

      {/* AI Generate Modal */}
      <AIGenerateModal
        isOpen={showAIGenerate}
        onClose={() => setShowAIGenerate(false)}
        athletes={athletes}
        onPlanGenerated={async (plan, selectedAthleteId) => {
          try {
            await apiFetch('/training/plans/from-ai', {
              method: 'POST',
              body: JSON.stringify({
                ...plan,
                athleteId: selectedAthleteId || undefined,
              }),
            });

            toast('success', `Piano "${plan.planName}" creato con ${plan.weeks.length} settimane e tutti gli esercizi!`);
            loadPlans();
          } catch (err) {
            console.error('Error creating AI plan:', err);
            toast('error', 'Errore nella creazione del piano strutturato.');
          }
        }}
      />
    </div>
  );
}
