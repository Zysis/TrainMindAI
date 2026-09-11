'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Dumbbell, Plus, Calendar, BookOpen, Users, Clock, ChevronRight, Search, Sparkles, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/auth/fetch';
import { useApiError } from '@/lib/i18n/api-error';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { AIGenerateModal } from '@/components/ai/ai-generate-modal';
import { WeekdayPicker } from '@/components/ui/weekday-picker';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
  trainingDays?: number[];
  aiGenerated?: boolean;
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
  const [page, setPage] = useState(1);
  const [totalPlans, setTotalPlans] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<'chronological' | 'recent'>('chronological');
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const { toast } = useToast();
  const apiError = useApiError();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedTeamId, teams } = useTeam();
  const [filterTeamId, setFilterTeamId] = useState<string>(selectedTeamId || '');
  const t = useTranslations('training');
  const tPer = useTranslations('periodization');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const [form, setForm] = useState({
    name: '',
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    athleteId: '',
    weeks: '4',
    teamId: '',
    trainingDays: [] as number[],
  });


  // Auto-calc endDate from startDate + weeks
  const calcEndDate = (start: string, weeks: string) => {
    if (!start || !weeks) return '';
    const d = new Date(start);
    d.setDate(d.getDate() + parseInt(weeks) * 7);
    return d.toISOString().split('T')[0];
  };
  const computedEndDate = calcEndDate(form.startDate, form.weeks);
  // Un mesociclo di squadra senza squadra non compare negli elenchi
  // filtrati: sembra non essere stato creato. Per i piani individuali
  // la squadra resta facoltativa.
  const needsTeam = !form.athleteId && !form.teamId;
  const createReady = Boolean(form.name && form.startDate && computedEndDate && !needsTeam);

  const loadPlans = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '12' });
      if (search) params.set('search', search);
      if (filterTeamId) params.set('teamId', filterTeamId);
      // Cronologico per difetto: la lista serve a leggere il lavoro nel tempo.
      if (sortMode === 'chronological') {
        params.set('sortBy', 'startDate');
        params.set('sortOrder', 'asc');
      } else {
        params.set('sortBy', 'createdAt');
        params.set('sortOrder', 'desc');
      }
      const res = await apiFetch<ApiResponse<TrainingPlan[]>>(`/training/plans?${params}`);
      setPlans(res.data);
      setTotalPlans(res.meta?.total ?? res.data.length);
      setTotalPages(res.meta?.totalPages ?? 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterTeamId, sortMode]);

  const loadAthletes = async () => {
    try {
      const res = await apiFetch<ApiResponse<Athlete[]>>('/athletes?limit=100');
      setAthletes(res.data);
    } catch {
      /* ignore */
    }
  };

  // Un solo effetto per la lista: pagina, ricerca, squadra e ordinamento
  // finiscono tutti nelle dipendenze di loadPlans. Il ritardo serve solo
  // mentre si digita nella ricerca.
  useEffect(() => {
    const timer = setTimeout(loadPlans, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadPlans, search]);

  useEffect(() => { loadAthletes(); }, []);

  // Cambiando ricerca, ordinamento o squadra si riparte dalla prima pagina:
  // restare alla quinta pagina di un elenco diverso non vuol dire niente.
  useEffect(() => {
    setPage(1);
  }, [filterTeamId, sortMode, search]);

  // Il filtro di pagina segue la squadra scelta nella barra laterale
  useEffect(() => { setFilterTeamId(selectedTeamId || ''); }, [selectedTeamId]);

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

  const handleCreate = async () => {
    if (!form.name || !form.startDate || !computedEndDate) {
      toast('error', t('fillRequiredFields'));
      return;
    }
    if (needsTeam) {
      toast('error', t('teamRequiredHint'));
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
          trainingDays: form.trainingDays,
        }),
      });
      toast('success', t('mesocycleCreated'));
      setShowCreate(false);
      setForm({ name: '', description: '', startDate: new Date().toISOString().split('T')[0], athleteId: '', weeks: '4', teamId: '', trainingDays: [] as number[] });
      loadPlans();
    } catch {
      toast('error', t('mesocycleCreateError'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { id: planId, name: planName } = deleteTarget;
    setDeleting(planId);
    try {
      const res = await apiFetch<{ data?: { sessionsKeptAsTemplates?: number } }>(
        `/training/plans/${planId}`,
        { method: 'DELETE' },
      );
      // Le sessioni non svolte sopravvivono come template: se non lo dico,
      // l'utente pensa di averle perse e le riscrive da capo.
      const kept = res.data?.sessionsKeptAsTemplates ?? 0;
      toast(
        'success',
        kept > 0
          ? t('mesocycleDeletedKept', { name: planName, templates: kept })
          : t('mesocycleDeleted', { name: planName }),
      );
      setDeleteTarget(null);
      loadPlans();
    } catch (err) {
      toast('error', apiError(err, t('deleteError')));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('title')}
            {totalPlans > 0 && (
              <span className="ml-2 text-base font-normal text-slate-400 dark:text-slate-500">({totalPlans})</span>
            )}
          </h1>
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
        <select
          value={filterTeamId}
          onChange={(e) => setFilterTeamId(e.target.value)}
          className="flex-shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200"
        >
          <option value="">{tPer('allTeams')}</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>{team.name}</option>
          ))}
        </select>
        <div className="flex flex-shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5">
          {(['chronological', 'recent'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                sortMode === mode
                  ? 'bg-teal-700 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {mode === 'chronological' ? tPer('sortChronological') : tPer('sortRecent')}
            </button>
          ))}
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
                      {plan.aiGenerated && (
                        <Badge variant="teal" className="inline-flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          {t('aiGeneratedBadge')}
                        </Badge>
                      )}
                    </div>
                    {plan.description && (
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{plan.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: plan.id, name: plan.name }); }}
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
                  {plan.trainingDays && plan.trainingDays.length > 0 && (
                    <WeekdayPicker value={plan.trainingDays} readOnly />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`h-8 w-8 rounded-lg text-sm font-medium ${
                p === page ? 'bg-teal-700 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {p}
            </button>
          ))}
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
              {tCommon('cancel')}
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !createReady}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {creating ? t('creating') : t('createMesocycle')}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label={`${t('mesocycleNameLabel')} *`}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t('mesocycleNamePlaceholder')}
          />
          <Input
            label={tCommon('description')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={t('mesocycleDescPlaceholder')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={`${t('startDateLabel')} *`}
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
            <Select
              label={`${t('weeksCountLabel')} *`}
              value={form.weeks}
              onChange={(e) => setForm({ ...form, weeks: e.target.value })}
              options={[2, 3, 4, 6, 8, 12].map((n) => ({
                value: String(n),
                label: t('nWeeks', { n }),
              }))}
            />
          </div>
          {computedEndDate && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('computedEndDate')}: <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(computedEndDate, locale)}</span>
            </p>
          )}
          <WeekdayPicker
            label={t('trainingDaysOptionalLabel')}
            value={form.trainingDays ?? []}
            onChange={(days) => setForm({ ...form, trainingDays: days })}
            hint={
              (form.trainingDays ?? []).length > 0
                ? t('trainingDaysSlotsHint', { n: (form.trainingDays ?? []).length })
                : t('trainingDaysFreeHint')
            }
          />
          <Select
            label={t('athleteOptionalLabel')}
            value={form.athleteId}
            onChange={(e) => setForm({ ...form, athleteId: e.target.value })}
            options={[
              { value: '', label: t('teamMesocycleOption') },
              ...athletes.map((a) => ({
                value: a.id,
                label: `${a.firstName} ${a.lastName} (${a.position})`,
              })),
            ]}
          />
          <div>
            <Select
              label={form.athleteId ? t('team') : `${t('team')} *`}
              value={form.teamId}
              onChange={(e) => setForm({ ...form, teamId: e.target.value })}
              options={[
                { value: '', label: form.athleteId ? t('noTeamOption') : t('selectTeamPlaceholder') },
                ...teams.map((tm) => ({ value: tm.id, label: tm.name })),
              ]}
            />
            {needsTeam && (
              <p className="mt-1 text-xs text-amber-600">{t('teamRequiredHint')}</p>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('deletePlan')}
        message={t('deleteMesocycleConfirm', { name: deleteTarget?.name ?? '' })}
        detail={t('deleteMesocycleDetail')}
        busy={!!deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />

      {/* AI Generate Modal */}
      <AIGenerateModal
        isOpen={showAIGenerate}
        onClose={() => setShowAIGenerate(false)}
        athletes={athletes}
        teams={teams}
        defaultTeamId={selectedTeamId}
        onPlanGenerated={async (plan, options) => {
          try {
            await apiFetch('/training/plans/from-ai', {
              method: 'POST',
              body: JSON.stringify({
                ...plan,
                athleteId: options.athleteId || undefined,
                // Data di inizio e giorni scelti nella finestra: senza, le
                // sessioni finivano su giorni consecutivi a partire da oggi.
                startDate: options.startDate,
                trainingDays: options.trainingDays,
                // Senza squadra il piano non compare nell'elenco appena
                // l'utente ne ha una selezionata: la lista filtra per teamId.
                // La squadra scelta nella finestra vince su quella della
                // dashboard: e' quella per cui il piano e' stato scritto.
                teamId: options.teamId || selectedTeamId || undefined,
              }),
            });

            toast('success', `Piano "${plan.planName}" creato con ${plan.weeks.length} settimane e tutti gli esercizi!`);
            loadPlans();
          } catch (err) {
            console.error('Error creating AI plan:', err);
            // Il messaggio del server dice cosa e' andato storto: sostituirlo
            // con una frase fissa obbliga ad aprire i log per ogni errore.
            toast('error', apiError(err, 'Errore nella creazione del piano strutturato.'));
          }
        }}
      />
    </div>
  );
}
