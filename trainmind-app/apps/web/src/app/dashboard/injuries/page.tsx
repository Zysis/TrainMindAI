'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Shield,
  Activity,
  Sparkles,
  X,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { apiFetch } from '@/lib/auth/fetch';
import { useTranslations, useLocale } from 'next-intl';

// ─── Types ───────────────────────────────────────────────

interface Injury {
  id: string;
  athleteId: string;
  type: string;
  location: string;
  severity: number;
  status: 'ACTIVE' | 'RECOVERING' | 'RESOLVED';
  dateOccurred: string;
  dateResolved: string | null;
  notes: string | null;
  rtpProtocols: Array<{
    id: string;
    currentPhase: string;
    startDate: string;
    targetDate: string | null;
    _count: { phaseLogs: number; criteria: number };
  }>;
}

interface RTPProtocolSummary {
  id: string;
  currentPhase: string;
  startDate: string;
  targetDate: string | null;
  injury: { type: string; location: string; severity: number };
  athlete: { id: string; firstName: string; lastName: string; position: string; photoUrl: string | null };
  _count: { criteria: number; phaseLogs: number };
}

interface Criterion {
  id: string;
  phase: string;
  description: string;
  isMet: boolean;
  metAt: string | null;
  notes: string | null;
}

interface PhaseLog {
  id: string;
  fromPhase: string;
  toPhase: string;
  reason: string | null;
  createdAt: string;
  changedBy: { firstName: string; lastName: string };
}

interface RTPDetail {
  id: string;
  currentPhase: string;
  startDate: string;
  targetDate: string | null;
  notes: string | null;
  injury: { id: string; type: string; location: string; severity: number; status: string };
  athlete: { id: string; firstName: string; lastName: string; position: string; photoUrl: string | null };
  criteria: Criterion[];
  phaseLogs: PhaseLog[];
}

interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
}

// ─── Constants ───────────────────────────────────────────

const PHASE_LABEL_KEYS: Record<string, string> = {
  PHASE_1: 'phase1Label',
  PHASE_2: 'phase2Label',
  PHASE_3: 'phase3Label',
  PHASE_4: 'phase4Label',
  PHASE_5: 'phase5Label',
  CLEARED: 'clearedLabel',
};

const PHASE_SHORT_KEYS: Record<string, string> = {
  PHASE_1: 'phase1Short',
  PHASE_2: 'phase2Short',
  PHASE_3: 'phase3Short',
  PHASE_4: 'phase4Short',
  PHASE_5: 'phase5Short',
  CLEARED: 'clearedShort',
};

const PHASE_COLORS: Record<string, string> = {
  PHASE_1: 'bg-red-100 text-red-700 border-red-200',
  PHASE_2: 'bg-orange-100 text-orange-700 border-orange-200',
  PHASE_3: 'bg-amber-100 text-amber-700 border-amber-200',
  PHASE_4: 'bg-blue-100 text-blue-700 border-blue-200',
  PHASE_5: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  CLEARED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const PHASE_ORDER = ['PHASE_1', 'PHASE_2', 'PHASE_3', 'PHASE_4', 'PHASE_5', 'CLEARED'];

const SEVERITY_LABEL_KEYS = ['', 'severityMild', 'severityMinor', 'severityModerate', 'severitySevere', 'severityVerySevere'];
const SEVERITY_COLORS = ['', 'text-green-600', 'text-yellow-600', 'text-orange-600', 'text-red-600', 'text-red-800'];

const INJURY_TYPE_DEFS: { value: string; labelKey: string }[] = [
  { value: 'muscular', labelKey: 'typeMuscular' },
  { value: 'ligament', labelKey: 'typeLigament' },
  { value: 'tendon', labelKey: 'typeTendon' },
  { value: 'bone', labelKey: 'typeBone' },
  { value: 'joint', labelKey: 'typeJoint' },
  { value: 'contusion', labelKey: 'typeContusion' },
  { value: 'overuse', labelKey: 'typeOveruse' },
  { value: 'other', labelKey: 'typeOther' },
];

const BODY_LOCATION_DEFS: { value: string; labelKey: string }[] = [
  { value: 'ankle_l', labelKey: 'locAnkleL' },
  { value: 'ankle_r', labelKey: 'locAnkleR' },
  { value: 'knee_l', labelKey: 'locKneeL' },
  { value: 'knee_r', labelKey: 'locKneeR' },
  { value: 'hamstring_l', labelKey: 'locHamstringL' },
  { value: 'hamstring_r', labelKey: 'locHamstringR' },
  { value: 'quadriceps_l', labelKey: 'locQuadL' },
  { value: 'quadriceps_r', labelKey: 'locQuadR' },
  { value: 'calf_l', labelKey: 'locCalfL' },
  { value: 'calf_r', labelKey: 'locCalfR' },
  { value: 'groin', labelKey: 'locGroin' },
  { value: 'hip_l', labelKey: 'locHipL' },
  { value: 'hip_r', labelKey: 'locHipR' },
  { value: 'back_lower', labelKey: 'locBackLower' },
  { value: 'back_upper', labelKey: 'locBackUpper' },
  { value: 'shoulder_l', labelKey: 'locShoulderL' },
  { value: 'shoulder_r', labelKey: 'locShoulderR' },
  { value: 'wrist_l', labelKey: 'locWristL' },
  { value: 'wrist_r', labelKey: 'locWristR' },
  { value: 'finger', labelKey: 'locFinger' },
  { value: 'foot_l', labelKey: 'locFootL' },
  { value: 'foot_r', labelKey: 'locFootR' },
  { value: 'other', labelKey: 'locOther' },
];

interface InjuryForm {
  athleteId: string;
  type: string;
  location: string;
  severity: number;
  dateOccurred: string;
  notes: string;
}

// ─── Helpers ─────────────────────────────────────────────

function fmtDate(d: string, locale: string) {
  return new Date(d).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysBetween(from: string, to?: string) {
  const end = to ? new Date(to) : new Date();
  return Math.floor((end.getTime() - new Date(from).getTime()) / 86400000);
}

// ─── Page ────────────────────────────────────────────────

export default function InjuriesRTPPage() {
  const { toast } = useToast();
  const t = useTranslations('injuries');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  // Localized lookup tables (rebuilt on locale change)
  const PHASE_LABELS = useMemo<Record<string, string>>(() => {
    const r: Record<string, string> = {};
    for (const [k, key] of Object.entries(PHASE_LABEL_KEYS)) r[k] = t(key);
    return r;
  }, [t]);
  const PHASE_SHORT = useMemo<Record<string, string>>(() => {
    const r: Record<string, string> = {};
    for (const [k, key] of Object.entries(PHASE_SHORT_KEYS)) r[k] = t(key);
    return r;
  }, [t]);
  const SEVERITY_LABELS = useMemo<string[]>(
    () => SEVERITY_LABEL_KEYS.map((key) => (key ? t(key) : '')),
    [t]
  );
  const INJURY_TYPES = useMemo<{ value: string; label: string }[]>(
    () => INJURY_TYPE_DEFS.map(({ value, labelKey }) => ({ value, label: t(labelKey) })),
    [t]
  );
  const BODY_LOCATIONS = useMemo<{ value: string; label: string }[]>(
    () => BODY_LOCATION_DEFS.map(({ value, labelKey }) => ({ value, label: t(labelKey) })),
    [t]
  );

  // Tab: 'rtp' (active protocols overview) or 'detail' (single RTP)
  const [tab, setTab] = useState<'rtp' | 'detail'>('rtp');

  // Active RTP protocols list
  const [protocols, setProtocols] = useState<RTPProtocolSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // RTP detail
  const [rtpDetail, setRtpDetail] = useState<RTPDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Create injury modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [injuryForm, setInjuryForm] = useState<InjuryForm>({
    athleteId: '', type: 'muscular', location: 'knee_r', severity: 3, dateOccurred: new Date().toISOString().slice(0, 10), notes: '',
  });

  // Advance modal
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceReason, setAdvanceReason] = useState('');
  const [advancing, setAdvancing] = useState(false);

  // AI Suggest
  const [aiSuggestion, setAiSuggestion] = useState<{ answer: string; sources: Array<{ title: string; score: number }>; protocol_summary: { currentPhase: string; metInPhase: number; totalInPhase: number } } | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);

  // ── Fetch active protocols ──
  const fetchProtocols = useCallback(async () => {
    try {
      const res = await apiFetch<{ success: boolean; data: { protocols: RTPProtocolSummary[] } }>('/rtp');
      setProtocols(res.data.protocols);
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchProtocols(); }, [fetchProtocols]);

  // ── Fetch athletes for create form ──
  async function loadAthletes() {
    try {
      const res = await apiFetch<{ data: Athlete[] }>('/athletes?limit=100');
      const list = res.data || [];
      setAthletes(list);
      if (list.length > 0 && !injuryForm.athleteId) {
        setInjuryForm((f: InjuryForm) => ({ ...f, athleteId: list[0].id }));
      }
    } catch { /* ignore */ }
  }

  // ── Open RTP detail ──
  async function openRTP(id: string) {
    setLoadingDetail(true);
    try {
      const res = await apiFetch<{ success: boolean; data: { protocol: RTPDetail } }>(`/rtp/${id}`);
      setRtpDetail(res.data.protocol);
      setTab('detail');
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoadingDetail(false);
    }
  }

  // ── Create injury + auto-start RTP ──
  async function createInjuryAndRTP() {
    try {
      // Create injury
      const injRes = await apiFetch<{ success: boolean; data: { injury: Injury } }>(
        `/athletes/${injuryForm.athleteId}/injuries`,
        {
          method: 'POST',
          body: JSON.stringify({
            type: injuryForm.type,
            location: injuryForm.location,
            severity: injuryForm.severity,
            dateOccurred: injuryForm.dateOccurred,
            notes: injuryForm.notes || undefined,
          }),
        }
      );

      // Auto-start RTP protocol
      const rtpRes = await apiFetch<{ success: boolean; data: { protocol: RTPDetail } }>(
        `/injuries/${injRes.data.injury.id}/rtp`,
        {
          method: 'POST',
          body: JSON.stringify({ autoCreateCriteria: true }),
        }
      );

      toast('success', t('injuryRegisteredRtp'));
      setShowCreateModal(false);
      setRtpDetail(rtpRes.data.protocol);
      setTab('detail');
      fetchProtocols();
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : t('createError'));
    }
  }

  // ── Toggle criterion ──
  async function toggleCriterion(criterionId: string, currentMet: boolean) {
    if (!rtpDetail) return;
    try {
      await apiFetch(`/rtp/criteria/${criterionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isMet: !currentMet }),
      });
      // Refresh detail
      const res = await apiFetch<{ success: boolean; data: { protocol: RTPDetail } }>(`/rtp/${rtpDetail.id}`);
      setRtpDetail(res.data.protocol);
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : t('updateError'));
    }
  }

  // ── AI RTP Suggest ──
  async function fetchAiSuggestion() {
    if (!rtpDetail) return;
    setLoadingAI(true);
    setShowAiPanel(true);
    try {
      const res = await apiFetch<{ success: boolean; data: { answer: string; sources: Array<{ title: string; score: number }>; protocol_summary: { currentPhase: string; metInPhase: number; totalInPhase: number } } }>(
        '/ai/rtp-suggest',
        { method: 'POST', body: JSON.stringify({ protocol_id: rtpDetail.id }) },
      );
      setAiSuggestion(res.data);
    } catch (err: unknown) {
      toast('error', err instanceof Error ? err.message : t('aiSuggestError'));
      setShowAiPanel(false);
    } finally {
      setLoadingAI(false);
    }
  }

  // ── Advance phase ──
  async function advancePhase(direction: 'next' | 'prev') {
    if (!rtpDetail) return;
    const currentIdx = PHASE_ORDER.indexOf(rtpDetail.currentPhase);
    const targetIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
    if (targetIdx < 0 || targetIdx >= PHASE_ORDER.length) return;

    setAdvancing(true);
    try {
      const res = await apiFetch<{ success: boolean; data: { protocol: RTPDetail } }>(
        `/rtp/${rtpDetail.id}/advance`,
        {
          method: 'POST',
          body: JSON.stringify({
            targetPhase: PHASE_ORDER[targetIdx],
            reason: advanceReason || undefined,
          }),
        }
      );
      setRtpDetail(res.data.protocol);
      setShowAdvanceModal(false);
      setAdvanceReason('');
      toast('success', direction === 'next' ? t('phaseAdvanced') : t('phaseRegressed'));
      fetchProtocols();
    } catch (err: unknown) {
      // Check if criteria not met
      if (err instanceof Error && err.message.includes('criteri non soddisfatti')) {
        toast('error', err.message);
      } else {
        toast('error', err instanceof Error ? err.message : t('advanceError'));
      }
    } finally {
      setAdvancing(false);
    }
  }

  // ─── RTP Detail View ──────────────────────────────────
  if (tab === 'detail' && rtpDetail) {
    const currentIdx = PHASE_ORDER.indexOf(rtpDetail.currentPhase);
    const progress = ((currentIdx) / (PHASE_ORDER.length - 1)) * 100;
    const currentCriteria = rtpDetail.criteria.filter((c: Criterion) => c.phase === rtpDetail.currentPhase);
    const metCount = currentCriteria.filter((c: Criterion) => c.isMet).length;
    const allMet = currentCriteria.length > 0 && metCount === currentCriteria.length;
    const daysInProtocol = daysBetween(rtpDetail.startDate);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => { setTab('rtp'); setRtpDetail(null); }} className="rounded-lg p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-700 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600 dark:text-slate-400">
                {rtpDetail.athlete.firstName[0]}{rtpDetail.athlete.lastName[0]}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">{rtpDetail.athlete.firstName} {rtpDetail.athlete.lastName}</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">{rtpDetail.athlete.position} — {rtpDetail.injury.type} ({BODY_LOCATIONS.find((l) => l.value === rtpDetail.injury.location)?.label || rtpDetail.injury.location})</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchAiSuggestion}
              disabled={loadingAI}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50"
            >
              {loadingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              AI Suggest
            </button>
            <div className="text-right text-sm text-slate-500 dark:text-slate-400">
              <p>{t('dayNumber', { day: daysInProtocol })}</p>
              <p>{t('since', { date: fmtDate(rtpDetail.startDate, locale) })}</p>
            </div>
          </div>
        </div>

        {/* Phase progress bar */}
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('rtpProgression')}</h3>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${PHASE_COLORS[rtpDetail.currentPhase]}`}>
              {PHASE_LABELS[rtpDetail.currentPhase]}
            </span>
          </div>
          <div className="relative mb-4">
            <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-400 via-amber-400 to-emerald-500 transition-all duration-500"
                style={{ width: `${Math.max(progress, 5)}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between">
              {PHASE_ORDER.map((phase: string, i: number) => (
                <div key={phase} className={`text-center ${i <= currentIdx ? 'text-slate-900 dark:text-white' : 'text-slate-300 dark:text-slate-600'}`}>
                  <div className={`mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    i < currentIdx ? 'bg-emerald-500 text-white' :
                    i === currentIdx ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' :
                    'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                  }`}>
                    {i < currentIdx ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className="text-xs">{PHASE_SHORT[phase]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Phase actions */}
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-3">
            <button
              onClick={() => advancePhase('prev')}
              disabled={currentIdx === 0 || rtpDetail.currentPhase === 'CLEARED'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700 disabled:opacity-30"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Fase precedente
            </button>
            <div className="text-center text-sm">
              <span className="text-slate-500 dark:text-slate-400">{t('phaseCriteria')} </span>
              <span className={`font-semibold ${allMet ? 'text-emerald-600' : 'text-amber-600'}`}>
                {metCount}/{currentCriteria.length}
              </span>
            </div>
            <button
              onClick={() => setShowAdvanceModal(true)}
              disabled={rtpDetail.currentPhase === 'CLEARED'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-30"
            >
              {t('advancePhase')}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* AI Suggestion panel */}
        {showAiPanel && (
          <div className="overflow-hidden rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50">
            <div className="flex items-center justify-between border-b border-violet-200 px-5 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-600" />
                <h3 className="text-sm font-semibold text-violet-900">{t('aiSuggestion')}</h3>
              </div>
              <button onClick={() => { setShowAiPanel(false); setAiSuggestion(null); }} className="rounded-lg p-1 text-violet-400 hover:bg-violet-100 hover:text-violet-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              {loadingAI ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                  <span className="ml-3 text-sm text-violet-600">{t('analyzing')}</span>
                </div>
              ) : aiSuggestion ? (
                <div className="space-y-4">
                  <div className="prose prose-sm max-w-none text-slate-700 dark:text-slate-300">
                    {aiSuggestion.answer.split('\n').map((line: string, i: number) => (
                      <p key={i} className={`${line.startsWith('#') || line.startsWith('**') ? 'font-semibold text-slate-900 dark:text-white' : ''} ${!line.trim() ? 'hidden' : ''}`}>
                        {line.replace(/^#+\s*/, '').replace(/\*\*/g, '')}
                      </p>
                    ))}
                  </div>
                  {aiSuggestion.sources.length > 0 && (
                    <div className="border-t border-violet-200 pt-3">
                      <p className="mb-1.5 text-xs font-semibold text-violet-700">{t('sources')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {aiSuggestion.sources.map((s: { title: string; score: number }, i: number) => (
                          <span key={i} className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs text-violet-700">
                            {s.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Clearance criteria for current phase */}
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            {t('clearanceCriteria')} — {PHASE_SHORT[rtpDetail.currentPhase]}
          </h3>
          {currentCriteria.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">{t('noCriteriaForPhase')}</p>
          ) : (
            <div className="space-y-2">
              {currentCriteria.map((c: Criterion) => (
                <button
                  key={c.id}
                  onClick={() => toggleCriterion(c.id, c.isMet)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                    c.isMet
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-600'
                  }`}
                >
                  <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                    c.isMet ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300 dark:border-slate-600'
                  }`}>
                    {c.isMet && <CheckCircle2 className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${c.isMet ? 'text-emerald-800 line-through' : 'text-slate-800 dark:text-slate-200'}`}>
                      {c.description}
                    </p>
                    {c.metAt && (
                      <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Verificato il {fmtDate(c.metAt, locale)}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* All criteria by phase (collapsed) */}
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">{t('allPhases')}</h3>
          <div className="space-y-3">
            {PHASE_ORDER.filter((p: string) => p !== 'CLEARED').map((phase: string) => {
              const phaseCriteria = rtpDetail.criteria.filter((c: Criterion) => c.phase === phase);
              const pMet = phaseCriteria.filter((c: Criterion) => c.isMet).length;
              const isPast = PHASE_ORDER.indexOf(phase) < currentIdx;
              const isCurrent = phase === rtpDetail.currentPhase;

              return (
                <div key={phase} className={`rounded-lg border p-3 ${isCurrent ? 'border-indigo-300 bg-indigo-50' : isPast ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isPast ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> :
                       isCurrent ? <Activity className="h-4 w-4 text-indigo-500" /> :
                       <Clock className="h-4 w-4 text-slate-300 dark:text-slate-600" />}
                      <span className={`text-sm font-medium ${isPast ? 'text-emerald-700' : isCurrent ? 'text-indigo-700' : 'text-slate-400 dark:text-slate-500'}`}>
                        {PHASE_LABELS[phase]}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{pMet}/{phaseCriteria.length} {t('criteria')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Phase log / timeline */}
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">{t('transitionHistory')}</h3>
          {rtpDetail.phaseLogs.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">{t('noTransitions')}</p>
          ) : (
            <div className="space-y-3">
              {rtpDetail.phaseLogs.map((log: PhaseLog) => (
                <div key={log.id} className="flex items-start gap-3 text-sm">
                  <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-400" />
                  <div>
                    <p className="text-slate-700 dark:text-slate-300">
                      <span className="font-medium">{PHASE_SHORT[log.fromPhase]}</span>
                      <ArrowRight className="mx-1 inline h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                      <span className="font-medium">{PHASE_SHORT[log.toPhase]}</span>
                    </p>
                    {log.reason && <p className="text-slate-500 dark:text-slate-400">{log.reason}</p>}
                    <p className="text-xs text-slate-400 dark:text-slate-500">{fmtDate(log.createdAt, locale)} — {log.changedBy.firstName} {log.changedBy.lastName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Advance modal */}
        <Modal open={showAdvanceModal} onClose={() => setShowAdvanceModal(false)} title={t('advancePhaseTitle')} size="md" footer={
          <>
            <button onClick={() => setShowAdvanceModal(false)} className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700">{tCommon('cancel')}</button>
            <button
              onClick={() => advancePhase('next')}
              disabled={advancing}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {advancing && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('confirmAdvance')}
            </button>
          </>
        }>
          <div className="space-y-4">
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm">
              <p className="font-medium text-indigo-800">
                {PHASE_SHORT[rtpDetail.currentPhase]} → {PHASE_SHORT[PHASE_ORDER[currentIdx + 1] || 'CLEARED']}
              </p>
              {!allMet && currentCriteria.length > 0 && (
                <p className="mt-1 text-amber-700">
                  <AlertTriangle className="mr-1 inline h-4 w-4" />
                  {t('criteriaNotMet', { count: currentCriteria.length - metCount })}
                </p>
              )}
            </div>
            <Input label={t('clinicalNote')} placeholder={t('clinicalNotePlaceholder')} value={advanceReason} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdvanceReason(e.target.value)} />
          </div>
        </Modal>
      </div>
    );
  }

  // ─── List View (active RTP protocols) ──────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => { setShowCreateModal(true); loadAthletes(); }}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
        >
          <Plus className="h-4 w-4" />
          Nuovo infortunio
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-300 dark:text-slate-600" /></div>
      ) : protocols.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16">
          <Shield className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('noActiveRtp')}</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Registra un infortunio per avviare un protocollo</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {protocols.map((p: RTPProtocolSummary) => {
            const phaseIdx = PHASE_ORDER.indexOf(p.currentPhase);
            const progress = (phaseIdx / (PHASE_ORDER.length - 1)) * 100;
            const days = daysBetween(p.startDate);

            return (
              <div
                key={p.id}
                onClick={() => openRTP(p.id)}
                className="card-hover cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600 dark:text-slate-400">
                    {p.athlete.firstName[0]}{p.athlete.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{p.athlete.firstName} {p.athlete.lastName}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{p.athlete.position}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300 dark:text-slate-600" />
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">{p.injury.type} — {BODY_LOCATIONS.find((l) => l.value === p.injury.location)?.label || p.injury.location}</span>
                    <span className={SEVERITY_COLORS[p.injury.severity]}>{SEVERITY_LABELS[p.injury.severity]}</span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-400 via-amber-400 to-emerald-500"
                      style={{ width: `${Math.max(progress, 8)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className={`rounded-full border px-2 py-0.5 font-medium ${PHASE_COLORS[p.currentPhase]}`}>
                      {PHASE_SHORT[p.currentPhase]}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500">{t('dayNumber', { day: days })}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loadingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      )}

      {/* Create Injury Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title={t('registerInjury')} size="md" footer={
        <>
          <button onClick={() => setShowCreateModal(false)} className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:hover:bg-slate-700">{tCommon('cancel')}</button>
          <button onClick={createInjuryAndRTP} disabled={!injuryForm.athleteId} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
            {t('registerAndStartRtp')}
          </button>
        </>
      }>
        <div className="space-y-4">
          <Select
            label={t('athleteLabel')}
            options={athletes.map((a: Athlete) => ({ value: a.id, label: `${a.firstName} ${a.lastName} (${a.position})` }))}
            value={injuryForm.athleteId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInjuryForm((f: InjuryForm) => ({ ...f, athleteId: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('typeLabel')} options={INJURY_TYPES} value={injuryForm.type} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInjuryForm((f: InjuryForm) => ({ ...f, type: e.target.value }))} />
            <Select label={t('locationLabel')} options={BODY_LOCATIONS} value={injuryForm.location} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInjuryForm((f: InjuryForm) => ({ ...f, location: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('severityLabel')}
              options={[1,2,3,4,5].map((n) => ({ value: String(n), label: `${n} — ${SEVERITY_LABELS[n]}` }))}
              value={String(injuryForm.severity)}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInjuryForm((f: InjuryForm) => ({ ...f, severity: Number(e.target.value) }))}
            />
            <Input label={t('injuryDate')} type="date" value={injuryForm.dateOccurred} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInjuryForm((f: InjuryForm) => ({ ...f, dateOccurred: e.target.value }))} />
          </div>
          <Input label={t('notesLabel')} placeholder={t('notesPlaceholder')} value={injuryForm.notes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInjuryForm((f: InjuryForm) => ({ ...f, notes: e.target.value }))} />
        </div>
      </Modal>
    </div>
  );
}
