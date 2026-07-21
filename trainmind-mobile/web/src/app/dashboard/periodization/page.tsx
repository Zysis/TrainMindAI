'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Loader2,
  Calendar,
  Layers,
  Trash2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Zap,
  BarChart3,
  Activity,
  Heart,
  Pencil,
  Dumbbell,
  Upload,
  Search,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { apiFetch } from '@/lib/auth/fetch';
import { LoadCurveChart } from '@/components/periodization/load-curve-chart';
import { useTeam } from '@/hooks/use-team';

// ─── Types ───────────────────────────────────────────────

interface LinkedWeek {
  id: string;
  weekNumber: number;
  trainingPlan: { id: string; name: string } | null;
  trainingSessions: Array<{ id: string; title: string; date: string | null; status: string }>;
}

interface Microcycle {
  id: string;
  weekNumber: number;
  loadPercent: number;
  intensity: string;
  sessionsCount: number;
  focusAreas: string[];
  isDeload: boolean;
  notes: string | null;
  weeks?: LinkedWeek[];
}

interface Mesocycle {
  id: string;
  orderIndex: number;
  name: string;
  phase: string;
  durationWeeks: number;
  targetLoadPercent: number;
  color: string | null;
  notes: string | null;
  microcycles: Microcycle[];
}

interface Plan {
  id: string;
  name: string;
  description: string | null;
  type: string;
  startDate: string;
  endDate: string;
  totalWeeks: number;
  createdAt: string;
  createdBy: { id: string; firstName: string; lastName: string };
  _count: { mesocycles: number; simulations: number };
}

interface PlanDetail extends Omit<Plan, '_count'> {
  mesocycles: Mesocycle[];
  simulations: Array<{ id: string; name: string; createdAt: string; results: SimResults | null }>;
}

interface Template {
  id: string;
  name: string;
  description: string;
  type: string;
  totalWeeks: number;
  templateCategory: string;
  mesocycleCount: number;
  phases: string[];
}

interface WeeklyPoint {
  week: number;
  label: string;
  mesocycleName: string;
  phase: string;
  plannedLoad: number;
  acuteLoad: number;
  chronicLoad: number;
  acwr: number;
  fatigue: number;
  fitness: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
}

interface SimResults {
  curve: WeeklyPoint[];
  summary: { peakLoad: number; peakACWR: number; riskWindows: number; avgFitness: number };
}

// ─── Constants ───────────────────────────────────────────

const PHASE_LABEL_KEYS: Record<string, string> = {
  PREPARATION: 'phasePreparation',
  SPECIFIC: 'phaseSpecific',
  COMPETITION: 'phaseCompetition',
  TRANSITION: 'phaseTransition',
  TAPER: 'phaseTaper',
  RECOVERY: 'phaseRecovery',
};

const PHASE_COLORS: Record<string, string> = {
  PREPARATION: 'bg-teal-100 text-teal-800',
  SPECIFIC: 'bg-amber-100 text-amber-800',
  COMPETITION: 'bg-red-100 text-red-800',
  TRANSITION: 'bg-purple-100 text-purple-800',
  TAPER: 'bg-indigo-100 text-indigo-800',
  RECOVERY: 'bg-blue-100 text-blue-800',
};

const INTENSITY_COLORS: Record<string, string> = {
  VERY_LOW: 'bg-slate-200',
  LOW: 'bg-emerald-300',
  MODERATE: 'bg-amber-400',
  HIGH: 'bg-orange-500',
  VERY_HIGH: 'bg-red-600',
};

const TYPE_OPTION_DEFS: { value: string; labelKey: string }[] = [
  { value: 'LINEAR', labelKey: 'typeLinear' },
  { value: 'UNDULATING', labelKey: 'typeUndulating' },
  { value: 'BLOCK', labelKey: 'typeBlock' },
  { value: 'REVERSE_LINEAR', labelKey: 'typeReverseLinear' },
  { value: 'CONJUGATE', labelKey: 'typeConjugate' },
];

const MESO_COLORS = ['#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#22c55e', '#ec4899', '#64748b'];

const INTENSITY_OPTION_DEFS: { value: string; labelKey: string }[] = [
  { value: 'VERY_LOW', labelKey: 'intensityVeryLow' },
  { value: 'LOW', labelKey: 'intensityLow' },
  { value: 'MODERATE', labelKey: 'intensityModerate' },
  { value: 'HIGH', labelKey: 'intensityHigh' },
  { value: 'VERY_HIGH', labelKey: 'intensityVeryHigh' },
];

// ─── Helpers ─────────────────────────────────────────────

function fmtDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

function intensityFromLoad(load: number): string {
  if (load < 50) return 'LOW';
  if (load < 70) return 'MODERATE';
  if (load < 90) return 'HIGH';
  return 'VERY_HIGH';
}

function generateMicrocycles(durationWeeks: number, targetLoadPercent: number): Omit<Microcycle, 'id'>[] {
  const microcycles: Omit<Microcycle, 'id'>[] = [];
  for (let w = 1; w <= durationWeeks; w++) {
    const isLast = w === durationWeeks;
    const isDeload = isLast && durationWeeks >= 3;
    let loadPercent: number;
    if (isDeload) {
      loadPercent = 60;
    } else if (durationWeeks <= 1) {
      loadPercent = 80;
    } else {
      // Progressive from 80% to 100% across non-deload weeks
      const totalProgressive = durationWeeks >= 3 ? durationWeeks - 1 : durationWeeks;
      const t = totalProgressive <= 1 ? 1 : (w - 1) / (totalProgressive - 1);
      loadPercent = Math.round(80 + t * 20);
    }
    // Scale by target load percent
    const scaledLoad = Math.round((loadPercent * targetLoadPercent) / 100);
    microcycles.push({
      weekNumber: w,
      loadPercent: scaledLoad,
      intensity: intensityFromLoad(scaledLoad),
      sessionsCount: 5,
      focusAreas: [],
      isDeload,
      notes: null,
    });
  }
  return microcycles;
}

interface CreateForm { name: string; description: string; type: string; startDate: string; endDate: string; totalWeeks: number; teamId: string }
interface SimParams { currentACWR: number; weeklyLoadAvg: number; chronicLoad: number }

interface MesoForm {
  name: string;
  phase: string;
  durationWeeks: number;
  targetLoadPercent: number;
  color: string;
  notes: string;
}

interface MicroForm {
  loadPercent: number;
  intensity: string;
  sessionsCount: number;
  focusAreas: string;
  isDeload: boolean;
}

const EMPTY_MESO_FORM: MesoForm = { name: '', phase: 'PREPARATION', durationWeeks: 4, targetLoadPercent: 75, color: MESO_COLORS[0], notes: '' };

// ─── Sortable Mesocycle Card ─────────────────────────────

interface SortableMesoCardProps {
  meso: Mesocycle;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onEditMicrocycle: (mc: Microcycle) => void;
  onImportSession: () => void;
  onCreateSession: () => void;
  onNavigateToSession: (trainingPlanId: string) => void;
  onUnlink: () => void;
  onAddSessionToMicro: (mc: Microcycle) => void;
  onNavigateToSessionDetail: (sessionId: string) => void;
}

function SortableMesoCard({ meso: m, isExpanded, onToggle, onEdit, onDelete, onEditMicrocycle, onImportSession, onCreateSession, onNavigateToSession, onUnlink, onAddSessionToMicro, onNavigateToSessionDetail }: SortableMesoCardProps) {
  const tCommon = useTranslations('common');
  const tPer = useTranslations('periodization');
  const PHASE_LABELS = useMemo<Record<string, string>>(() => {
    const r: Record<string, string> = {};
    for (const [k, key] of Object.entries(PHASE_LABEL_KEYS)) r[k] = tPer(key);
    return r;
  }, [tPer]);
  // Check if any microcycle has linked weeks
  const hasLinkedSessions = m.microcycles.some((mc) => mc.weeks && mc.weeks.length > 0);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: m.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      {/* Mesocycle header */}
      <div className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700">
        <div className="flex items-center gap-3">
          <button
            className="cursor-grab touch-none rounded p-0.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400 active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: m.color || '#94a3b8' }} />
          <button onClick={onToggle} className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 dark:text-white">{m.name}</span>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PHASE_COLORS[m.phase] || 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
              {PHASE_LABELS[m.phase] || m.phase}
            </span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onEdit(); }}
            className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 hover:bg-teal-50 hover:text-teal-600"
            title={tPer('editMesocycle')}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDelete(); }}
            className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 hover:bg-red-50 hover:text-red-500"
            title={tPer('deleteMesocycle')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button onClick={onToggle} className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span>{m.durationWeeks}w</span>
            <span>Carico: {m.targetLoadPercent}%</span>
            <span>{m.microcycles.length} micro</span>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Microcycles + actions */}
      {isExpanded && (
        <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3">
          {m.microcycles.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {m.microcycles.map((mc: Microcycle) => {
                const linkedWeek = mc.weeks?.[0];
                const hasLinkedPlan = !!linkedWeek?.trainingPlan;
                const sessionCount = linkedWeek?.trainingSessions?.length ?? 0;
                return (
                  <div
                    key={mc.id}
                    className={`cursor-pointer rounded-lg border bg-white dark:bg-slate-800 p-3 text-left transition hover:ring-2 hover:ring-teal-300 ${mc.isDeload ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 dark:border-slate-700'} ${hasLinkedPlan ? 'ring-1 ring-teal-200' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-teal-700"
                        onClick={() => onEditMicrocycle(mc)}
                      >
                        Settimana {mc.weekNumber}
                      </span>
                      <div className="flex items-center gap-1">
                        {mc.isDeload && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">{tPer('deloadLabel')}</span>}
                        {hasLinkedPlan && (
                          <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">{tPer('linked')}</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2" onClick={() => onEditMicrocycle(mc)}>
                      <div className="flex-1">
                        <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>{tCommon('load')}</span>
                          <span>{mc.loadPercent}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                          <div
                            className={`h-full rounded-full ${INTENSITY_COLORS[mc.intensity] || 'bg-slate-400'}`}
                            style={{ width: `${Math.min(mc.loadPercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {mc.focusAreas.map((fa: string) => (
                        <span key={fa} className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-xs text-slate-600 dark:text-slate-400">{fa}</span>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hasLinkedPlan ? sessionCount : mc.sessionsCount} sessioni</p>
                    {/* Sessions list */}
                    {linkedWeek && linkedWeek.trainingSessions.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {linkedWeek.trainingSessions.slice(0, 3).map((ts) => (
                          <button
                            key={ts.id}
                            onClick={(e) => { e.stopPropagation(); onNavigateToSessionDetail(ts.id); }}
                            className="flex w-full items-center gap-1.5 rounded-md bg-teal-50 px-2 py-1 text-xs text-teal-700 hover:bg-teal-100 transition text-left"
                          >
                            <Dumbbell className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{ts.title}</span>
                          </button>
                        ))}
                        {linkedWeek.trainingSessions.length > 3 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); if (linkedWeek.trainingPlan) onNavigateToSession(linkedWeek.trainingPlan.id); }}
                            className="text-xs text-teal-500 hover:text-teal-700 pl-2"
                          >
                            +{linkedWeek.trainingSessions.length - 3} altre...
                          </button>
                        )}
                      </div>
                    )}
                    {/* Add session button per microcycle */}
                    <button
                      onClick={(e) => { e.stopPropagation(); onAddSessionToMicro(mc); }}
                      className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-teal-300 px-2 py-1 text-xs font-medium text-teal-600 hover:bg-teal-50 transition"
                    >
                      <Plus className="h-3 w-3" />
                      Aggiungi sessione
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {/* Mesocycle secondary actions */}
          <div className="mt-3 flex items-center gap-2 border-t border-slate-200 dark:border-slate-700 pt-2">
            <button
              onClick={onImportSession}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700 hover:text-slate-700 dark:text-slate-300"
              title={tPer('linkExistingPlan')}
            >
              <Upload className="h-3 w-3" />
              Collega piano esistente
            </button>
            <button
              onClick={onCreateSession}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700 hover:text-slate-700 dark:text-slate-300"
              title={tPer('createTrainingPlan')}
            >
              <Plus className="h-3 w-3" />
              Crea piano allenamento
            </button>
            {hasLinkedSessions && (
              <button
                onClick={onUnlink}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-3 w-3" />
                Scollega
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────

export default function PeriodizationPage() {
  const t = useTranslations('periodization');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { toast } = useToast();
  const router = useRouter();
  const { selectedTeamId, teams } = useTeam();

  // Localized lookup tables
  const PHASE_LABELS = useMemo<Record<string, string>>(() => {
    const r: Record<string, string> = {};
    for (const [k, key] of Object.entries(PHASE_LABEL_KEYS)) r[k] = t(key);
    return r;
  }, [t]);
  const TYPE_OPTIONS = useMemo(
    () => TYPE_OPTION_DEFS.map(({ value, labelKey }) => ({ value, label: t(labelKey) })),
    [t]
  );
  const INTENSITY_OPTIONS = useMemo(
    () => INTENSITY_OPTION_DEFS.map(({ value, labelKey }) => ({ value, label: t(labelKey) })),
    [t]
  );
  const PHASE_OPTIONS = useMemo(
    () => Object.entries(PHASE_LABELS).map(([value, label]) => ({ value, label })),
    [PHASE_LABELS]
  );

  // List view
  const [plans, setPlans] = useState<Plan[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail view
  const [selectedPlan, setSelectedPlan] = useState<PlanDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modals
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSimModal, setShowSimModal] = useState(false);
  const [showMesoModal, setShowMesoModal] = useState(false);
  const [showMicroModal, setShowMicroModal] = useState(false);

  // Create form
  const [createForm, setCreateForm] = useState<CreateForm>({ name: '', description: '', type: 'BLOCK', startDate: '', endDate: '', totalWeeks: 8, teamId: '' });

  // Mesocycle form
  const [mesoForm, setMesoForm] = useState<MesoForm>(EMPTY_MESO_FORM);
  const [editingMesoIndex, setEditingMesoIndex] = useState<number | null>(null); // null = creating new

  // Microcycle form
  const [microForm, setMicroForm] = useState<MicroForm>({ loadPercent: 80, intensity: 'HIGH', sessionsCount: 5, focusAreas: '', isDeload: false });
  const [editingMicroRef, setEditingMicroRef] = useState<{ mesoId: string; mcId: string } | null>(null);

  // Saving state
  const [savingMeso, setSavingMeso] = useState(false);

  // Simulation
  const [simParams, setSimParams] = useState<SimParams>({ currentACWR: 1.0, weeklyLoadAvg: 600, chronicLoad: 500 });
  const [simResult, setSimResult] = useState<SimResults | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [chartMode, setChartMode] = useState<'load' | 'acwr' | 'fitness'>('load');

  // Expanded mesocycles
  const [expandedMeso, setExpandedMeso] = useState<Set<string>>(new Set());

  // ── Per-microcycle session management ──
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [addSessionMicro, setAddSessionMicro] = useState<Microcycle | null>(null);
  const [addSessionWeekId, setAddSessionWeekId] = useState<string | null>(null);
  const [addSessionTab, setAddSessionTab] = useState<'import' | 'create'>('import');
  const [sessionTemplates, setSessionTemplates] = useState<Array<{
    id: string; title: string; duration: number; notes: string | null;
    _count: { sessionExercises: number };
    sessionExercises: Array<{ exercise: { name: string; category: string } }>;
  }>>([]);
  const [loadingSessionTemplates, setLoadingSessionTemplates] = useState(false);
  const [sessionTemplateSearch, setSessionTemplateSearch] = useState('');
  const [importingSessionTemplate, setImportingSessionTemplate] = useState(false);
  const [sessionForm, setSessionForm] = useState({ title: '', date: new Date().toISOString().split('T')[0], duration: '60', notes: '' });
  const [creatingSession, setCreatingSession] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const mesoIds = useMemo(
    () => selectedPlan?.mesocycles.map((m) => m.id) ?? [],
    [selectedPlan?.mesocycles],
  );

  // ── Bulk save mesocycles ──
  async function bulkSaveMesocycles(plan: PlanDetail, updatedMesos: Mesocycle[]) {
    setSavingMeso(true);
    // Build payload without ids (the PUT replaces all)
    const payload = updatedMesos.map((m, idx) => ({
      orderIndex: idx,
      name: m.name,
      phase: m.phase,
      durationWeeks: m.durationWeeks,
      targetLoadPercent: m.targetLoadPercent,
      color: m.color || undefined,
      notes: m.notes || undefined,
      microcycles: m.microcycles.map((mc) => ({
        weekNumber: mc.weekNumber,
        loadPercent: mc.loadPercent,
        intensity: mc.intensity,
        sessionsCount: mc.sessionsCount,
        focusAreas: mc.focusAreas,
        isDeload: mc.isDeload,
        notes: mc.notes || undefined,
      })),
    }));

    try {
      const res = await apiFetch<{ success: boolean; data: { plan: PlanDetail } }>(
        `/periodization/plans/${plan.id}/mesocycles`,
        { method: 'PUT', body: JSON.stringify(payload) },
      );
      setSelectedPlan(res.data.plan);
      setExpandedMeso(new Set(res.data.plan.mesocycles.map((m) => m.id)));
      toast('success', t('mesocyclesUpdated'));
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('saveMesocyclesError'));
      // Refetch to be safe
      openPlan(plan.id);
    } finally {
      setSavingMeso(false);
    }
  }

  // DnD handler — reorder mesocycles
  async function handleMesoDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedPlan) return;

    const oldIndex = selectedPlan.mesocycles.findIndex((m) => m.id === active.id);
    const newIndex = selectedPlan.mesocycles.findIndex((m) => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(selectedPlan.mesocycles, oldIndex, newIndex).map((m, i) => ({
      ...m,
      orderIndex: i,
    }));
    // Optimistic update
    setSelectedPlan({ ...selectedPlan, mesocycles: reordered });

    try {
      await apiFetch(`/periodization/plans/${selectedPlan.id}/mesocycles/reorder`, {
        method: 'PATCH',
        body: JSON.stringify(reordered.map((m) => ({ id: m.id, orderIndex: m.orderIndex }))),
      });
      toast('success', t('orderUpdated'));
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('reorderError'));
      // Rollback — refetch
      openPlan(selectedPlan.id);
    }
  }

  // ── Mesocycle CRUD handlers ──
  function openAddMeso() {
    setMesoForm(EMPTY_MESO_FORM);
    setEditingMesoIndex(null);
    setShowMesoModal(true);
  }

  function openEditMeso(mesoIndex: number) {
    if (!selectedPlan) return;
    const m = selectedPlan.mesocycles[mesoIndex];
    setMesoForm({
      name: m.name,
      phase: m.phase,
      durationWeeks: m.durationWeeks,
      targetLoadPercent: m.targetLoadPercent,
      color: m.color || MESO_COLORS[0],
      notes: m.notes || '',
    });
    setEditingMesoIndex(mesoIndex);
    setShowMesoModal(true);
  }

  // Compute remaining weeks for validation
  const allocatedWeeks = selectedPlan?.mesocycles.reduce((sum, m) => sum + m.durationWeeks, 0) ?? 0;
  const remainingWeeks = (selectedPlan?.totalWeeks ?? 0) - allocatedWeeks;
  const maxWeeksForMeso = editingMesoIndex !== null
    ? remainingWeeks + (selectedPlan?.mesocycles[editingMesoIndex]?.durationWeeks ?? 0)
    : remainingWeeks;

  async function saveMeso() {
    if (!selectedPlan) return;
    if (!mesoForm.name.trim()) {
      toast('error', t('mesoNameRequired'));
      return;
    }
    if (mesoForm.durationWeeks < 1 || mesoForm.durationWeeks > 12) {
      toast('error', t('weeksBetween1And12'));
      return;
    }
    if (mesoForm.durationWeeks > maxWeeksForMeso) {
      toast('error', t('weeksAvailableError', { max: maxWeeksForMeso }));
      return;
    }

    const currentMesos = [...selectedPlan.mesocycles];

    if (editingMesoIndex !== null) {
      // Editing existing
      const existing = currentMesos[editingMesoIndex];
      const durationChanged = existing.durationWeeks !== mesoForm.durationWeeks;
      currentMesos[editingMesoIndex] = {
        ...existing,
        name: mesoForm.name,
        phase: mesoForm.phase,
        durationWeeks: mesoForm.durationWeeks,
        targetLoadPercent: mesoForm.targetLoadPercent,
        color: mesoForm.color,
        notes: mesoForm.notes || null,
        // Regenerate microcycles only if duration changed
        microcycles: durationChanged
          ? generateMicrocycles(mesoForm.durationWeeks, mesoForm.targetLoadPercent).map((mc, i) => ({
              ...mc,
              id: `temp-${i}`,
            })) as Microcycle[]
          : existing.microcycles,
      };
    } else {
      // Creating new
      const newMicrocycles = generateMicrocycles(mesoForm.durationWeeks, mesoForm.targetLoadPercent).map((mc, i) => ({
        ...mc,
        id: `temp-new-${i}`,
      })) as Microcycle[];

      currentMesos.push({
        id: `temp-new-meso-${Date.now()}`,
        orderIndex: currentMesos.length,
        name: mesoForm.name,
        phase: mesoForm.phase,
        durationWeeks: mesoForm.durationWeeks,
        targetLoadPercent: mesoForm.targetLoadPercent,
        color: mesoForm.color,
        notes: mesoForm.notes || null,
        microcycles: newMicrocycles,
      });
    }

    setShowMesoModal(false);
    await bulkSaveMesocycles(selectedPlan, currentMesos);
  }

  async function deleteMeso(mesoIndex: number) {
    if (!selectedPlan) return;
    const m = selectedPlan.mesocycles[mesoIndex];
    if (!confirm(t('deleteMesoConfirm', { name: m.name }))) return;

    const currentMesos = selectedPlan.mesocycles.filter((_, i) => i !== mesoIndex);
    await bulkSaveMesocycles(selectedPlan, currentMesos);
  }

  // ── Microcycle edit handlers ──
  function openEditMicro(mesoId: string, mc: Microcycle) {
    setMicroForm({
      loadPercent: mc.loadPercent,
      intensity: mc.intensity,
      sessionsCount: mc.sessionsCount,
      focusAreas: mc.focusAreas.join(', '),
      isDeload: mc.isDeload,
    });
    setEditingMicroRef({ mesoId, mcId: mc.id });
    setShowMicroModal(true);
  }

  async function saveMicro() {
    if (!selectedPlan || !editingMicroRef) return;
    if (microForm.loadPercent < 0 || microForm.loadPercent > 150) {
      toast('error', t('loadBetween0And150'));
      return;
    }
    if (microForm.sessionsCount < 1 || microForm.sessionsCount > 14) {
      toast('error', 'Le sessioni devono essere tra 1 e 14');
      return;
    }

    const updatedMesos = selectedPlan.mesocycles.map((m) => {
      if (m.id !== editingMicroRef.mesoId) return m;
      return {
        ...m,
        microcycles: m.microcycles.map((mc) => {
          if (mc.id !== editingMicroRef.mcId) return mc;
          return {
            ...mc,
            loadPercent: microForm.loadPercent,
            intensity: microForm.intensity,
            sessionsCount: microForm.sessionsCount,
            focusAreas: microForm.focusAreas
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            isDeload: microForm.isDeload,
          };
        }),
      };
    });

    setShowMicroModal(false);
    await bulkSaveMesocycles(selectedPlan, updatedMesos);
  }

  // ── Fetch ──
  const fetchPlans = useCallback(async () => {
    try {
      const params = selectedTeamId ? `?teamId=${selectedTeamId}` : '';
      const [plansRes, templatesRes] = await Promise.all([
        apiFetch<{ success: boolean; data: { plans: Plan[] } }>(`/periodization/plans${params}`),
        apiFetch<{ success: boolean; data: { templates: Template[] } }>('/periodization/templates'),
      ]);
      setPlans(plansRes.data.plans);
      setTemplates(templatesRes.data.templates);
    } catch (err) {
      toast('error', err instanceof Error ? err.message : tCommon('error'));
    } finally {
      setLoading(false);
    }
  }, [toast, selectedTeamId]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  async function openPlan(id: string) {
    setLoadingDetail(true);
    setSimResult(null);
    try {
      const res = await apiFetch<{ success: boolean; data: { plan: PlanDetail } }>(`/periodization/plans/${id}`);
      setSelectedPlan(res.data.plan);
      // Auto-expand all mesocycles
      setExpandedMeso(new Set(res.data.plan.mesocycles.map((m) => m.id)));
      // Load latest simulation if exists
      if (res.data.plan.simulations.length > 0 && res.data.plan.simulations[0].results) {
        setSimResult(res.data.plan.simulations[0].results);
      }
    } catch (err) {
      toast('error', err instanceof Error ? err.message : tCommon('error'));
    } finally {
      setLoadingDetail(false);
    }
  }

  // ── Create from template ──
  async function createFromTemplate(templateId: string) {
    const startDate = createForm.startDate || new Date().toISOString().slice(0, 10);
    try {
      const res = await apiFetch<{ success: boolean; data: { plan: PlanDetail } }>('/periodization/plans/from-template', {
        method: 'POST',
        body: JSON.stringify({ templateId, startDate }),
      });
      toast('success', t('planCreatedFromTemplate'));
      setShowTemplateModal(false);
      fetchPlans();
      setSelectedPlan(res.data.plan);
      setExpandedMeso(new Set(res.data.plan.mesocycles.map((m) => m.id)));
    } catch (err) {
      toast('error', err instanceof Error ? err.message : tCommon('error'));
    }
  }

  // ── Create blank ──
  async function createBlank() {
    if (!createForm.name || !createForm.startDate || (!createForm.endDate && createForm.totalWeeks < 1)) {
      toast('error', t('fillNameStartWeeks'));
      return;
    }
    // Ensure endDate is computed if missing
    if (!createForm.endDate && createForm.startDate && createForm.totalWeeks > 0) {
      const d = new Date(createForm.startDate);
      d.setDate(d.getDate() + createForm.totalWeeks * 7 - 1);
      createForm.endDate = d.toISOString().split('T')[0];
    }
    try {
      const payload = { ...createForm, mesocycles: [], teamId: createForm.teamId || undefined };
      const res = await apiFetch<{ success: boolean; data: { plan: PlanDetail } }>('/periodization/plans', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast('success', t('planCreated'));
      setShowCreateModal(false);
      fetchPlans();
      setSelectedPlan(res.data.plan);
    } catch (err) {
      toast('error', err instanceof Error ? err.message : tCommon('error'));
    }
  }

  // ── Delete plan ──
  async function deletePlan(id: string) {
    try {
      await apiFetch(`/periodization/plans/${id}`, { method: 'DELETE' });
      toast('success', t('planDeleted'));
      if (selectedPlan?.id === id) setSelectedPlan(null);
      fetchPlans();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('deleteError'));
    }
  }

  // ── Simulate ──
  async function runSimulation() {
    if (!selectedPlan) return;
    setSimulating(true);
    try {
      const res = await apiFetch<{ success: boolean; data: SimResults & { simulation: unknown } }>(
        `/periodization/plans/${selectedPlan.id}/simulate`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: `${t('simLoadFatigue').split(' ')[0]} ${new Date().toLocaleDateString(locale)}`,
            athleteBaseline: simParams,
          }),
        },
      );
      setSimResult({ curve: res.data.curve, summary: res.data.summary });
      setShowSimModal(false);
      toast('success', t('simulationCompleted'));
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('simulationError'));
    } finally {
      setSimulating(false);
    }
  }

  // ── Generate Training Plan from Periodization ──
  const [generatingTraining, setGeneratingTraining] = useState(false);

  // ── Import existing training plan ──
  const [showImportModal, setShowImportModal] = useState(false);
  const [importingForMeso, setImportingForMeso] = useState<Mesocycle | null>(null);
  const [availablePlans, setAvailablePlans] = useState<Array<{ id: string; name: string; _count: { weeks: number }; startDate: string; endDate: string }>>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [linkingPlan, setLinkingPlan] = useState<string | null>(null);

  async function generateTrainingPlan() {
    if (!selectedPlan) return;
    if (selectedPlan.mesocycles.length === 0) {
      toast('error', t('addMesocycleFirst'));
      return;
    }
    setGeneratingTraining(true);
    try {
      const res = await apiFetch<{ success: boolean; data: { trainingPlan: { id: string } } }>(
        `/periodization/plans/${selectedPlan.id}/generate-training`,
        {
          method: 'POST',
          body: JSON.stringify({
            planName: `${selectedPlan.name} — Piano allenamento`,
          }),
        },
      );
      toast('success', t('trainingPlanGenerated'));
      // Navigate to the generated training plan
      setTimeout(() => {
        router.push(`/dashboard/training/${res.data.trainingPlan.id}`);
      }, 500);
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('generateTrainingError'));
    } finally {
      setGeneratingTraining(false);
    }
  }

  async function openImportModal(meso: Mesocycle) {
    setImportingForMeso(meso);
    setShowImportModal(true);
    setLoadingPlans(true);
    try {
      const res = await apiFetch<{ success: boolean; data: Array<{ id: string; name: string; _count: { weeks: number }; startDate: string; endDate: string; periodizationPlanId: string | null }> }>('/training/plans');
      // No exclusive filter — same plan can be imported in multiple mesocycles
      setAvailablePlans(res.data);
    } catch {
      toast('error', t('loadPlansError'));
    } finally {
      setLoadingPlans(false);
    }
  }

  async function linkTrainingPlan(trainingPlanId: string) {
    if (!selectedPlan) return;
    setLinkingPlan(trainingPlanId);
    try {
      const res = await apiFetch<{ success: boolean; data: { weeksLinked: number; totalWeeks: number; totalMicrocycles: number } }>(
        `/periodization/plans/${selectedPlan.id}/link-training`,
        {
          method: 'POST',
          body: JSON.stringify({
            trainingPlanId,
            mesocycleId: importingForMeso?.id, // link only to this mesocycle
          }),
        },
      );
      const { weeksLinked, totalWeeks, totalMicrocycles } = res.data;
      toast('success', t('mesoLinkedMsg', { linked: weeksLinked, microcycles: totalMicrocycles }) + (totalWeeks > totalMicrocycles ? t('weeksWithoutMicro', { count: totalWeeks - totalMicrocycles }) : ''));
      setShowImportModal(false);
      setImportingForMeso(null);
      // Refresh plan detail
      openPlan(selectedPlan.id);
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('linkError'));
    } finally {
      setLinkingPlan(null);
    }
  }

  async function unlinkMesocycle(mesocycleId: string, mesoName: string) {
    if (!selectedPlan) return;
    if (!confirm(`Scollegare tutti i mesocicli collegati da "${mesoName}"?`)) return;
    try {
      const res = await apiFetch<{ success: boolean; data: { weeksUnlinked: number } }>(
        `/periodization/plans/${selectedPlan.id}/unlink-training`,
        {
          method: 'POST',
          body: JSON.stringify({ mesocycleId }),
        },
      );
      toast('success', t('weeksUnlinked', { count: res.data.weeksUnlinked }));
      // Refresh
      openPlan(selectedPlan.id);
    } catch (err) {
      toast('error', err instanceof Error ? err.message : t('unlinkError'));
    }
  }

  // ── Toggle mesocycle expand ──
  function toggleMeso(id: string) {
    setExpandedMeso((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ── Per-microcycle session handlers ──
  async function openAddSessionToMicro(mc: Microcycle) {
    setAddSessionMicro(mc);
    setAddSessionTab('import');
    setSessionTemplateSearch('');
    setSessionForm({ title: '', date: new Date().toISOString().split('T')[0], duration: '60', notes: '' });
    setShowAddSessionModal(true);
    setLoadingSessionTemplates(true);

    // Ensure the microcycle has a linked week
    const linkedWeek = mc.weeks?.[0];
    if (linkedWeek) {
      setAddSessionWeekId(linkedWeek.id);
    } else {
      try {
        const res = await apiFetch<{ success: boolean; data: { weekId: string; created: boolean } }>(
          `/periodization/microcycles/${mc.id}/ensure-week`,
          { method: 'POST' },
        );
        setAddSessionWeekId(res.data.weekId);
      } catch {
        toast('error', t('weekCreationError'));
        setShowAddSessionModal(false);
        return;
      }
    }

    // Load session templates
    try {
      const res = await apiFetch<{ success: boolean; data: typeof sessionTemplates }>('/training/sessions?templates=1&limit=100');
      setSessionTemplates(res.data || []);
    } catch {
      toast('error', t('loadSessionsError'));
    } finally {
      setLoadingSessionTemplates(false);
    }
  }

  async function importSessionTemplate(templateId: string) {
    if (!addSessionWeekId) return;
    setImportingSessionTemplate(true);
    try {
      await apiFetch(`/training/session-templates/${templateId}/import`, {
        method: 'POST',
        body: JSON.stringify({ weekId: addSessionWeekId, date: sessionForm.date }),
      });
      toast('success', t('sessionImported'));
      setShowAddSessionModal(false);
      if (selectedPlan) openPlan(selectedPlan.id);
    } catch {
      toast('error', t('sessionImportError'));
    } finally {
      setImportingSessionTemplate(false);
    }
  }

  async function createSessionInMicro() {
    if (!addSessionWeekId || !sessionForm.title) return;
    setCreatingSession(true);
    try {
      await apiFetch(`/training/weeks/${addSessionWeekId}/sessions`, {
        method: 'POST',
        body: JSON.stringify({
          title: sessionForm.title,
          date: sessionForm.date,
          duration: parseInt(sessionForm.duration) || 60,
          notes: sessionForm.notes || undefined,
        }),
      });
      toast('success', t('sessionCreated'));
      setShowAddSessionModal(false);
      if (selectedPlan) openPlan(selectedPlan.id);
    } catch {
      toast('error', t('sessionCreateError'));
    } finally {
      setCreatingSession(false);
    }
  }

  const filteredSessionTemplates = sessionTemplates.filter((t) =>
    t.title.toLowerCase().includes(sessionTemplateSearch.toLowerCase()),
  );

  // ─── Render ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
      </div>
    );
  }

  // ─── Detail View ───────────────────────────────────────
  if (selectedPlan) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => setSelectedPlan(null)} className="mb-1 text-sm text-teal-700 hover:underline">&larr; {t('allPlans')}</button>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedPlan.name}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {TYPE_OPTIONS.find((tp) => tp.value === selectedPlan.type)?.label ?? selectedPlan.type} · {selectedPlan.totalWeeks} {tCommon('weeks')} · {fmtDate(selectedPlan.startDate, locale)} → {fmtDate(selectedPlan.endDate, locale)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={generateTrainingPlan}
              disabled={generatingTraining || selectedPlan.mesocycles.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {generatingTraining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dumbbell className="h-4 w-4" />}
              {t('generateTraining')}
            </button>
            <button
              onClick={() => setShowSimModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Zap className="h-4 w-4" />
              Simula
            </button>
          </div>
        </div>

        {/* Weeks allocation bar */}
        {(() => {
          const allocatedWeeks = selectedPlan.mesocycles.reduce((sum, m) => sum + m.durationWeeks, 0);
          const totalWeeks = selectedPlan.totalWeeks;
          const remaining = totalWeeks - allocatedWeeks;
          const pct = Math.min((allocatedWeeks / totalWeeks) * 100, 100);
          const isOver = allocatedWeeks > totalWeeks;
          return (
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('weeksAllocated')}</h3>
                <span className={`text-sm font-bold ${isOver ? 'text-red-600' : remaining === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {allocatedWeeks} / {totalWeeks} settimane
                  {remaining > 0 && <span className="ml-1 font-normal text-slate-400 dark:text-slate-500">({remaining} rimanenti)</span>}
                  {isOver && <span className="ml-1 font-normal text-red-500">({Math.abs(remaining)} in eccesso!)</span>}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div
                  className={`h-full rounded-full transition-all ${isOver ? 'bg-red-500' : remaining === 0 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          );
        })()}

        {/* Mesocycle timeline bar */}
        {selectedPlan.mesocycles.length > 0 && (
          <div className="card">
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">{t('mesocycleTimeline')}</h3>
            <div className="flex gap-1 overflow-x-auto">
              {selectedPlan.mesocycles.map((m: Mesocycle) => (
                <div
                  key={m.id}
                  className="flex flex-col items-center rounded-lg px-3 py-2 text-xs"
                  style={{
                    flex: m.durationWeeks,
                    backgroundColor: m.color ? `${m.color}20` : '#f1f5f9',
                    borderLeft: `3px solid ${m.color || '#94a3b8'}`,
                  }}
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{m.name}</span>
                  <span className="text-slate-500 dark:text-slate-400">{m.durationWeeks}w · {m.targetLoadPercent}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mesocycle cards — drag & drop sortable */}
        {selectedPlan.mesocycles.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMesoDragEnd}>
            <SortableContext items={mesoIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {selectedPlan.mesocycles.map((m: Mesocycle, idx: number) => (
                  <SortableMesoCard
                    key={m.id}
                    meso={m}
                    isExpanded={expandedMeso.has(m.id)}
                    onToggle={() => toggleMeso(m.id)}
                    onEdit={() => openEditMeso(idx)}
                    onDelete={() => deleteMeso(idx)}
                    onEditMicrocycle={(mc) => openEditMicro(m.id, mc)}
                    onImportSession={() => openImportModal(m)}
                    onCreateSession={() => {
                      const params = new URLSearchParams({
                        mesoId: m.id,
                        mesoName: m.name,
                        weeks: String(m.durationWeeks),
                        periodizationId: selectedPlan.id,
                      });
                      router.push(`/dashboard/training?create=1&${params.toString()}`);
                    }}
                    onNavigateToSession={(planId) => router.push(`/dashboard/training/${planId}`)}
                    onUnlink={() => unlinkMesocycle(m.id, m.name)}
                    onAddSessionToMicro={(mc) => openAddSessionToMicro(mc)}
                    onNavigateToSessionDetail={(sessionId) => router.push(`/dashboard/sessions/${sessionId}`)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          /* Empty state for no mesocycles */
          <div className="card flex flex-col items-center justify-center py-16">
            <Layers className="mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('noMesocycles')}</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{t('addFirstMesocycle')}</p>
            <button
              onClick={openAddMeso}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
            >
              <Plus className="h-4 w-4" />
              {t('addMesocycle')}
            </button>
          </div>
        )}

        {/* Add mesocycle button (shown when mesocycles exist) */}
        {selectedPlan.mesocycles.length > 0 && (
          <button
            onClick={openAddMeso}
            disabled={savingMeso}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 py-3 text-sm font-semibold text-slate-500 dark:text-slate-400 transition hover:border-teal-400 hover:text-teal-700 disabled:opacity-50"
          >
            {savingMeso ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Aggiungi mesociclo
          </button>
        )}

        {/* Simulation results */}
        {simResult && (
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t('simLoadFatigue')}</h3>
              <div className="flex gap-1 rounded-lg bg-slate-100 dark:bg-slate-700 p-0.5">
                {([['load', BarChart3, t('load')], ['acwr', Activity, 'ACWR'], ['fitness', Heart, 'Fitness']] as const).map(([key, Icon, label]) => (
                  <button
                    key={key}
                    onClick={() => setChartMode(key)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      chartMode === key ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI summary */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('peakLoad')}</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">{simResult.summary.peakLoad} AU</p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('peakACWR')}</p>
                <p className={`text-lg font-semibold ${simResult.summary.peakACWR > 1.5 ? 'text-red-600' : simResult.summary.peakACWR > 1.3 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {simResult.summary.peakACWR}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('riskWindows')}</p>
                <p className={`text-lg font-semibold ${simResult.summary.riskWindows > 2 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                  {simResult.summary.riskWindows}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('avgFitness')}</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">{simResult.summary.avgFitness}</p>
              </div>
            </div>

            <LoadCurveChart data={simResult.curve} mode={chartMode} />
          </div>
        )}

        {/* Simulate modal */}
        <Modal open={showSimModal} onClose={() => setShowSimModal(false)} title={t('simParams')} size="md" footer={
          <>
            <button onClick={() => setShowSimModal(false)} className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700">{tCommon('cancel')}</button>
            <button onClick={runSimulation} disabled={simulating} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {simulating && <Loader2 className="h-4 w-4 animate-spin" />}
              Simula
            </button>
          </>
        }>
          <div className="space-y-4">
            <Input label="ACWR attuale" type="number" value={String(simParams.currentACWR)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSimParams((p: SimParams) => ({ ...p, currentACWR: Number(e.target.value) }))} />
            <Input label={t('weeklyLoadAvg')} type="number" value={String(simParams.weeklyLoadAvg)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSimParams((p: SimParams) => ({ ...p, weeklyLoadAvg: Number(e.target.value) }))} />
            <Input label={t('chronicLoad')} type="number" value={String(simParams.chronicLoad)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSimParams((p: SimParams) => ({ ...p, chronicLoad: Number(e.target.value) }))} />
          </div>
        </Modal>

        {/* Add/Edit Mesocycle modal */}
        <Modal
          open={showMesoModal}
          onClose={() => setShowMesoModal(false)}
          title={editingMesoIndex !== null ? t('editMesocycle') : t('newMesocycle')}
          size="md"
          footer={
            <>
              <button onClick={() => setShowMesoModal(false)} className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700">{tCommon('cancel')}</button>
              <button onClick={saveMeso} disabled={savingMeso} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
                {savingMeso && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingMesoIndex !== null ? tCommon('save') : tCommon('create')}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <Input
              label={t('mesoName')}
              placeholder={t('mesoNamePlaceholder')}
              value={mesoForm.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMesoForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Select
              label={t('phaseLabel')}
              options={PHASE_OPTIONS}
              value={mesoForm.phase}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMesoForm((f) => ({ ...f, phase: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('durationWeeks')}
                type="number"
                value={String(mesoForm.durationWeeks)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMesoForm((f) => ({ ...f, durationWeeks: Math.max(1, Math.min(12, Number(e.target.value))) }))}
              />
              <Input
                label={t('targetLoad')}
                type="number"
                value={String(mesoForm.targetLoadPercent)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMesoForm((f) => ({ ...f, targetLoadPercent: Math.max(0, Math.min(100, Number(e.target.value))) }))}
              />
            </div>
            {/* Target load slider */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('targetLoadSlider', { pct: mesoForm.targetLoadPercent })}</label>
              <input
                type="range"
                min={0}
                max={100}
                value={mesoForm.targetLoadPercent}
                onChange={(e) => setMesoForm((f) => ({ ...f, targetLoadPercent: Number(e.target.value) }))}
                className="w-full accent-teal-700"
              />
              <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
            {/* Color picker */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('colorLabel')}</label>
              <div className="flex gap-2">
                {MESO_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setMesoForm((f) => ({ ...f, color: c }))}
                    className={`h-8 w-8 rounded-full border-2 transition ${mesoForm.color === c ? 'border-slate-900 ring-2 ring-offset-1 ring-slate-400' : 'border-transparent hover:border-slate-300 dark:border-slate-600'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <Input
              label={t('notesOptional')}
              placeholder={t('notesPlaceholder')}
              value={mesoForm.notes}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMesoForm((f) => ({ ...f, notes: e.target.value }))}
            />
            {/* Weeks availability info */}
            {maxWeeksForMeso > 0 && (
              <p className={`rounded-lg p-3 text-xs ${mesoForm.durationWeeks > maxWeeksForMeso ? 'bg-red-50 text-red-700' : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400'}`}>
                {t('weeksAvailable', { available: maxWeeksForMeso, total: selectedPlan.totalWeeks })}
                {mesoForm.durationWeeks > maxWeeksForMeso && ` — ${t('tooManyWeeks')}`}
              </p>
            )}
            {maxWeeksForMeso === 0 && editingMesoIndex === null && (
              <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {t('allWeeksAllocated')}
              </p>
            )}
            {editingMesoIndex !== null && mesoForm.durationWeeks !== selectedPlan.mesocycles[editingMesoIndex]?.durationWeeks && (
              <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
                {t('durationChangedWarning')}
              </p>
            )}
          </div>
        </Modal>

        {/* Edit Microcycle modal */}
        <Modal
          open={showMicroModal}
          onClose={() => setShowMicroModal(false)}
          title={t('editMicrocycle')}
          size="md"
          footer={
            <>
              <button onClick={() => setShowMicroModal(false)} className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700">{tCommon('cancel')}</button>
              <button onClick={saveMicro} disabled={savingMeso} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
                {savingMeso && <Loader2 className="h-4 w-4 animate-spin" />}
                Salva
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <Input
              label={t('loadPercent')}
              type="number"
              value={String(microForm.loadPercent)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMicroForm((f) => ({ ...f, loadPercent: Number(e.target.value) }))}
            />
            <Select
              label={t('intensityLabel')}
              options={INTENSITY_OPTIONS}
              value={microForm.intensity}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMicroForm((f) => ({ ...f, intensity: e.target.value }))}
            />
            <Input
              label={t('sessionsLabel')}
              type="number"
              value={String(microForm.sessionsCount)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMicroForm((f) => ({ ...f, sessionsCount: Number(e.target.value) }))}
            />
            <Input
              label={t('focusAreas')}
              placeholder={t('focusAreasPlaceholder')}
              value={microForm.focusAreas}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMicroForm((f) => ({ ...f, focusAreas: e.target.value }))}
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={microForm.isDeload}
                onChange={(e) => setMicroForm((f) => ({ ...f, isDeload: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-teal-700 focus:ring-teal-600"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('deloadWeek')}</span>
            </label>
          </div>
        </Modal>

        {/* Import Training Plan Modal */}
        <Modal
          open={showImportModal}
          onClose={() => { setShowImportModal(false); setImportingForMeso(null); }}
          title={importingForMeso ? `${t('importMesocycle')} — ${importingForMeso.name}` : t('importMesocycle')}
          size="lg"
        >
          <div className="space-y-3">
            {importingForMeso && (
              <div className="rounded-lg bg-teal-50 p-3 text-sm text-teal-800">
                {t('mesocycle')}: <span className="font-semibold">{importingForMeso.name}</span> — {importingForMeso.durationWeeks} {tCommon('weeks')}
              </div>
            )}
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('selectPlanToLink')}
            </p>
            {loadingPlans ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
              </div>
            ) : availablePlans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Dumbbell className="mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('noPlanAvailable')}</p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{t('allPlansLinked')}</p>
              </div>
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {availablePlans.map((tp: { id: string; name: string; description?: string | null; startDate: string; endDate: string; _count: { weeks: number } }) => {
                  const weeksMatch = !importingForMeso || tp._count.weeks === importingForMeso.durationWeeks;
                  const weeksDiff = importingForMeso ? tp._count.weeks - importingForMeso.durationWeeks : 0;
                  return (
                    <div
                      key={tp.id}
                      className={`flex items-center justify-between rounded-lg border p-4 ${weeksMatch ? 'border-slate-200 dark:border-slate-700 hover:border-teal-300 hover:bg-teal-50/50' : 'border-amber-200 bg-amber-50/30'}`}
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 dark:text-white">{tp.name}</p>
                        {tp.description && (
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{tp.description}</p>
                        )}
                        <div className="mt-1 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                          <span className={!weeksMatch ? 'font-semibold text-amber-600' : ''}>{tp._count.weeks} settimane</span>
                          <span>{fmtDate(tp.startDate, locale)} → {fmtDate(tp.endDate, locale)}</span>
                        </div>
                        {!weeksMatch && (
                          <p className="mt-1 text-xs text-amber-600">
                            ⚠ {weeksDiff > 0 ? t('moreWeeks', { count: weeksDiff }) : t('fewerWeeks', { count: Math.abs(weeksDiff) })} {t('vsExpected')}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => linkTrainingPlan(tp.id)}
                        disabled={linkingPlan === tp.id}
                        className="ml-4 inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                      >
                        {linkingPlan === tp.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        Collega
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
        {/* Add Session to Microcycle Modal */}
        <Modal
          open={showAddSessionModal}
          onClose={() => { setShowAddSessionModal(false); setAddSessionMicro(null); setAddSessionWeekId(null); }}
          title={addSessionMicro ? `${t('addSessionToWeek')} — ${t('weekLabel', { n: addSessionMicro.weekNumber })}` : t('addSessionToWeek')}
          size="lg"
        >
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setAddSessionTab('import')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                  addSessionTab === 'import'
                    ? 'border-teal-700 text-teal-700'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300'
                }`}
              >
                <Upload className="mr-1.5 inline h-4 w-4" />
                {t('importFromLibrary')}
              </button>
              <button
                onClick={() => setAddSessionTab('create')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                  addSessionTab === 'create'
                    ? 'border-teal-700 text-teal-700'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300'
                }`}
              >
                <Plus className="mr-1.5 inline h-4 w-4" />
                {t('createNew')}
              </button>
            </div>

            {/* Date picker — shared */}
            <Input
              label={t('dateRequired')}
              type="date"
              value={sessionForm.date}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSessionForm((f) => ({ ...f, date: e.target.value }))}
            />

            {addSessionTab === 'import' ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={sessionTemplateSearch}
                    onChange={(e) => setSessionTemplateSearch(e.target.value)}
                    placeholder={t('searchSessionLibrary')}
                    className="input-field w-full pl-10"
                  />
                </div>
                {loadingSessionTemplates ? (
                  <div className="flex h-32 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                  </div>
                ) : filteredSessionTemplates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Dumbbell className="mb-2 h-8 w-8 text-slate-300" />
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      {sessionTemplates.length === 0 ? t('noSessionsInLibrary') : tCommon('noResults')}
                    </p>
                    {sessionTemplates.length === 0 && (
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{t('createSessionsFromPage')}</p>
                    )}
                  </div>
                ) : (
                  <div className="max-h-[350px] space-y-2 overflow-y-auto">
                    {filteredSessionTemplates.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t.title}</p>
                          <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                            <span>{t.duration} min</span>
                            <span>{t._count.sessionExercises} esercizi</span>
                          </div>
                          {t.sessionExercises.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {t.sessionExercises.slice(0, 4).map((se, i) => (
                                <span key={i} className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-xs text-slate-600 dark:text-slate-400">
                                  {se.exercise.name}
                                </span>
                              ))}
                              {t._count.sessionExercises > 4 && (
                                <span className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400 dark:text-slate-500">
                                  +{t._count.sessionExercises - 4}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => importSessionTemplate(t.id)}
                          disabled={importingSessionTemplate || !sessionForm.date}
                          className="ml-3 inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Importa
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  label={t('sessionTitleRequired')}
                  value={sessionForm.title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSessionForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="es. Forza - Upper Body"
                />
                <Input
                  label={t('durationMinutes')}
                  type="number"
                  value={sessionForm.duration}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSessionForm((f) => ({ ...f, duration: e.target.value }))}
                  placeholder="60"
                />
                <Input
                  label={t('notesField')}
                  value={sessionForm.notes}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSessionForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder={t('optionalNotesPlaceholder')}
                />
                <div className="flex justify-end">
                  <button
                    onClick={createSessionInMicro}
                    disabled={creatingSession || !sessionForm.title || !sessionForm.date}
                    className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                  >
                    {creatingSession ? t('creating') : t('createSession')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      </div>
    );
  }

  // ─── List View ─────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTemplateModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700"
          >
            <Layers className="h-4 w-4" />
            {t('fromTemplate')}
          </button>
          <button
            onClick={() => { setCreateForm((f) => ({ ...f, teamId: selectedTeamId || '' })); setShowCreateModal(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            {t('blankPlan')}
          </button>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16">
          <Calendar className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('noPeriodizationPlans')}</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{t('createFromTemplateOrScratch')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p: Plan) => (
            <div key={p.id} className="card-hover cursor-pointer" onClick={() => openPlan(p.id)}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{p.name}</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {TYPE_OPTIONS.find((t) => t.value === p.type)?.label ?? p.type} · {p.totalWeeks} settimane
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{fmtDate(p.startDate, locale)} → {fmtDate(p.endDate, locale)}</p>
                </div>
                <button
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); deletePlan(p.id); }}
                  className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>{p._count.mesocycles} mesocicli</span>
                <span>{p._count.simulations} simulazioni</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {loadingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      )}

      {/* Template picker modal */}
      <Modal open={showTemplateModal} onClose={() => setShowTemplateModal(false)} title={t('chooseTemplate')} size="lg">
        <div className="space-y-2">
          <Input label={t('startDateLabel')} type="date" value={createForm.startDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm((f: CreateForm) => ({ ...f, startDate: e.target.value }))} />
          <div className="mt-4 space-y-3">
            {templates.map((t: Template) => (
              <button
                key={t.id}
                onClick={() => createFromTemplate(t.id)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-left hover:border-teal-300 hover:bg-teal-50"
              >
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{t.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t.description}</p>
                  <div className="mt-2 flex gap-2">
                    {t.phases.map((ph: string, i: number) => (
                      <span key={i} className={`rounded-full px-2 py-0.5 text-xs font-medium ${PHASE_COLORS[ph] || 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                        {PHASE_LABELS[ph] || ph}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                  <p>{t.totalWeeks} sett.</p>
                  <p>{t.mesocycleCount} meso</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Create blank modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title={t('newBlankPlan')} size="md" footer={
        <>
          <button onClick={() => setShowCreateModal(false)} className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700">{tCommon('cancel')}</button>
          <button onClick={createBlank} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">{tCommon('create')}</button>
        </>
      }>
        <div className="space-y-4">
          <Input label={t('planName')} placeholder={t('planNamePlaceholder')} value={createForm.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm((f: CreateForm) => ({ ...f, name: e.target.value }))} />
          <Input label={t('descriptionOptional')} placeholder={t('descriptionPlaceholderOpt')} value={createForm.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm((f: CreateForm) => ({ ...f, description: e.target.value }))} />
          <Select label={t('typeLabel')} options={TYPE_OPTIONS} value={createForm.type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCreateForm((f: CreateForm) => ({ ...f, type: e.target.value }))} />
          <div className="grid grid-cols-3 gap-4">
            <Input label={t('startDateLabel')} type="date" value={createForm.startDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const startDate = e.target.value;
              let endDate = createForm.endDate;
              let totalWeeks = createForm.totalWeeks;
              if (startDate && createForm.totalWeeks > 0) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + createForm.totalWeeks * 7 - 1);
                endDate = d.toISOString().split('T')[0];
              }
              setCreateForm((f: CreateForm) => ({ ...f, startDate, endDate, totalWeeks }));
            }} />
            <Input
              label={t('weeksLabel')}
              type="number"
              value={String(createForm.totalWeeks)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const weeks = Math.max(1, Number(e.target.value) || 1);
                let endDate = createForm.endDate;
                if (createForm.startDate) {
                  const d = new Date(createForm.startDate);
                  d.setDate(d.getDate() + weeks * 7 - 1);
                  endDate = d.toISOString().split('T')[0];
                }
                setCreateForm((f: CreateForm) => ({ ...f, totalWeeks: weeks, endDate }));
              }}
            />
            <Input label={t('endDateLabel')} type="date" value={createForm.endDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const endDate = e.target.value;
              let totalWeeks = createForm.totalWeeks;
              if (createForm.startDate && endDate) {
                const start = new Date(createForm.startDate);
                const end = new Date(endDate);
                const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                totalWeeks = Math.max(1, Math.round(diffDays / 7));
              }
              setCreateForm((f: CreateForm) => ({ ...f, endDate, totalWeeks }));
            }} />
          </div>
          {createForm.startDate && createForm.endDate && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Durata: <span className="font-medium text-slate-700 dark:text-slate-300">{createForm.totalWeeks} settimane</span>
              {' '}({(() => {
                const start = new Date(createForm.startDate);
                return start.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
              })()} → {(() => {
                const end = new Date(createForm.endDate);
                return end.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
              })()})
            </p>
          )}
          <Select
            label={t('teamLabel')}
            options={[{ value: '', label: t('noTeam') }, ...teams.map((tm) => ({ value: tm.id, label: tm.name }))]}
            value={createForm.teamId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCreateForm((f: CreateForm) => ({ ...f, teamId: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}
