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
  Target,
  ClipboardList,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { apiFetch } from '@/lib/auth/fetch';
import {
  PHASE_LABEL_KEYS, PHASE_SHORT_KEYS, PHASE_COLORS, PHASE_ORDER,
  SEVERITY_LABEL_KEYS, SEVERITY_COLORS,
  INJURY_TYPE_DEFS, LEGACY_TYPE_DEFS, INJURY_ONSET_DEFS, BODY_LOCATION_DEFS,
} from '@/lib/constants/injuries';
import { useApiError } from '@/lib/i18n/api-error';
import { useTranslations, useLocale } from 'next-intl';
import {
  rtpText, rtpTemplateKey, rtpPhaseKey, rtpCriterionKey, rtpTestName, rtpUnit,
} from '@trainmind/types/rtp-i18n';

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
  phases?: Array<{ phase: string; order: number; name: string }>;
  /** Protocollo di sistema da cui nasce: il `code` indicizza le traduzioni. */
  template?: { code: string | null } | null;
  injury: { type: string; location: string; severity: number; dateOccurred: string };
  athlete: { id: string; firstName: string; lastName: string; position: string; photoUrl: string | null };
  _count: { criteria: number; phaseLogs: number };
}

interface Criterion {
  id: string;
  phase: string;
  order: number;
  description: string;
  isMet: boolean;
  metAt: string | null;
  notes: string | null;
  /** Test e soglia: 'Hop test LSI' + gte + 90 + '%'. Vuoti = criterio descrittivo. */
  testCode: string | null;
  comparator: 'gte' | 'lte' | 'eq' | null;
  targetValue: number | null;
  unit: string | null;
  measuredValue: number | null;
  /** false = raccomandazione: non blocca il passaggio di fase. */
  mandatory: boolean;
}

/** Le fasi di QUESTO protocollo: numero e nomi cambiano col template. */
interface ProtocolPhase {
  id: string;
  phase: string;
  order: number;
  name: string;
  goal: string | null;
  minDays: number | null;
  typicalDays: number | null;
  startedAt: string | null;
  completedAt: string | null;
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
  templateName: string | null;
  /** Come sopra: assente (o `code` nullo) sui protocolli dell'organizzazione. */
  template?: { code: string | null } | null;
  injury: { id: string; type: string; location: string; severity: number; status: string };
  athlete: { id: string; firstName: string; lastName: string; position: string; photoUrl: string | null };
  phases: ProtocolPhase[];
  criteria: Criterion[];
  phaseLogs: PhaseLog[];
}

/** Anteprima del protocollo che verrebbe scelto, nel modale di registrazione. */
interface TemplateMatch {
  zone: string;
  region: string;
  template: { id: string; code: string | null; name: string; isSystem: boolean; phaseCount: number } | null;
  estimatedReturn: string | null;
}

interface TemplateOption {
  id: string;
  code: string | null;
  name: string;
  isSystem: boolean;
  bodyZone: string | null;
  bodyRegion: string | null;
  injuryType: string | null;
  phases: Array<{ id: string; order: number; name: string; typicalDays: number | null }>;
}

interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
}

// ─── Constants ───────────────────────────────────────────


interface InjuryForm {
  athleteId: string;
  type: string;
  onset: string;
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

/**
 * Le fasi del protocollo, con CLEARED in coda.
 *
 * I protocolli avviati prima della libreria non hanno fasi proprie: per loro
 * si ricade sulle cinque storiche, altrimenti la pagina resterebbe vuota.
 */
// Accetta qualunque forma che porti `phase` e `order`: la lista usa una versione
// ridotta di ProtocolPhase (senza id/goal/durate), il dettaglio quella completa.
function protocolSequence(p: { phases?: Array<{ phase: string; order: number }> }): string[] {
  const ordered = [...(p.phases ?? [])].sort((a, b) => a.order - b.order).map((ph) => ph.phase);
  if (!ordered.length) return [...PHASE_ORDER];
  return [...ordered, 'CLEARED'];
}

/** Simbolo del confronto, per la pastiglia della soglia. */
const COMPARATOR_SIGN: Record<string, string> = { gte: '≥', lte: '≤', eq: '=' };

// ─── Page ────────────────────────────────────────────────

export default function InjuriesRTPPage() {
  const { toast } = useToast();
  const apiError = useApiError();
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
  const INJURY_ONSETS = useMemo<{ value: string; label: string }[]>(
    () => INJURY_ONSET_DEFS.map(({ value, labelKey }) => ({ value, label: t(labelKey) })),
    [t],
  );
  /** Etichetta di un tipo, compresi quelli storici non più selezionabili */
  const typeLabelOf = useMemo(
    () => {
      const all = [...INJURY_TYPE_DEFS, ...LEGACY_TYPE_DEFS];
      return (value: string) => {
        const def = all.find((d) => d.value === value);
        return def ? t(def.labelKey) : value;
      };
    },
    [t],
  );
  const BODY_LOCATIONS = useMemo<{ value: string; label: string }[]>(
    () => BODY_LOCATION_DEFS.map(({ value, labelKey }) => ({ value, label: t(labelKey) })),
    [t]
  );

  // ── Testo clinico che arriva dal database ──
  //
  // Il seed scrive l'italiano; inglese e spagnolo stanno in `rtp-i18n`,
  // indicizzati sul `code` del protocollo di sistema. I protocolli
  // dell'organizzazione non hanno codice: `rtpText` non trova la chiave e
  // restituisce la stringa del database, cioe' esattamente quello che ha
  // scritto il medico. E' voluto.
  const templateLabel = (code: string | null | undefined, name: string) =>
    rtpText(locale, rtpTemplateKey(code), name);

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
    athleteId: '', type: 'muscular', onset: '', location: 'knee_r', severity: 3, dateOccurred: new Date().toISOString().slice(0, 10), notes: '',
  });

  // Advance modal
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceReason, setAdvanceReason] = useState('');
  const [advancing, setAdvancing] = useState(false);

  // Protocollo scelto per il nuovo infortunio: proposto in automatico dalla
  // libreria, sostituibile a mano prima di registrare.
  const [templateMatch, setTemplateMatch] = useState<TemplateMatch | null>(null);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templateId, setTemplateId] = useState('');

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
      toast('error', apiError(err, t('loadError')));
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

  // ── Quale protocollo verrebbe scelto per questo infortunio ──
  // Gira mentre si compila il modale: il medico vede il protocollo *prima* di
  // registrare, non dopo averlo avviato.
  useEffect(() => {
    if (!showCreateModal) return;
    const { type, location, severity } = injuryForm;
    if (!type || !location) return;
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({ location, injuryType: type, severity: String(severity) });
        const res = await apiFetch<{ success: boolean; data: TemplateMatch }>(`/rtp-templates/match?${qs}`);
        if (!cancelled) setTemplateMatch(res.data);
      } catch {
        if (!cancelled) setTemplateMatch(null);
      }
    })();
    return () => { cancelled = true; };
  }, [showCreateModal, injuryForm.type, injuryForm.location, injuryForm.severity]);

  async function loadTemplates() {
    try {
      const res = await apiFetch<{ success: boolean; data: { templates: TemplateOption[] } }>('/rtp-templates');
      setTemplates(res.data.templates);
    } catch { /* la lista serve solo a poter scegliere: se manca resta l'automatico */ }
  }

  // ── Open RTP detail ──
  async function openRTP(id: string) {
    setLoadingDetail(true);
    try {
      const res = await apiFetch<{ success: boolean; data: { protocol: RTPDetail } }>(`/rtp/${id}`);
      setRtpDetail(res.data.protocol);
      setTab('detail');
    } catch (err: unknown) {
      toast('error', apiError(err, t('loadError')));
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
            onset: injuryForm.onset || undefined,
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
          body: JSON.stringify({ autoCreateCriteria: true, templateId: templateId || undefined }),
        }
      );

      toast('success', t('injuryRegisteredRtp'));
      setShowCreateModal(false);
      setTemplateId('');
      setRtpDetail(rtpRes.data.protocol);
      setTab('detail');
      fetchProtocols();
    } catch (err: unknown) {
      toast('error', apiError(err, t('createError')));
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
      toast('error', apiError(err, t('updateError')));
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
      toast('error', apiError(err, t('aiSuggestError')));
      setShowAiPanel(false);
    } finally {
      setLoadingAI(false);
    }
  }

  // ── Valore misurato di un criterio ──
  async function saveMeasured(criterionId: string, value: string) {
    if (!rtpDetail) return;
    const parsed = value.trim() === '' ? null : Number(value.replace(',', '.'));
    if (parsed != null && !Number.isFinite(parsed)) return;
    try {
      await apiFetch(`/rtp/criteria/${criterionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ measuredValue: parsed }),
      });
      const res = await apiFetch<{ success: boolean; data: { protocol: RTPDetail } }>(`/rtp/${rtpDetail.id}`);
      setRtpDetail(res.data.protocol);
    } catch (err: unknown) {
      toast('error', apiError(err, t('updateError')));
    }
  }

  // ── Elimina un criterio ──
  async function deleteCriterion(criterionId: string) {
    if (!rtpDetail) return;
    try {
      await apiFetch(`/rtp/criteria/${criterionId}`, { method: 'DELETE' });
      const res = await apiFetch<{ success: boolean; data: { protocol: RTPDetail } }>(`/rtp/${rtpDetail.id}`);
      setRtpDetail(res.data.protocol);
      toast('success', t('criterionDeleted'));
    } catch (err: unknown) {
      toast('error', apiError(err, t('updateError')));
    }
  }

  // ── Advance phase ──
  // La sequenza e' quella del protocollo, non una costante: un protocollo puo'
  // avere 3 fasi come 6.
  async function advancePhase(direction: 'next' | 'prev') {
    if (!rtpDetail) return;
    const sequence = protocolSequence(rtpDetail);
    const currentIdx = sequence.indexOf(rtpDetail.currentPhase);
    const targetIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
    if (targetIdx < 0 || targetIdx >= sequence.length) return;

    setAdvancing(true);
    try {
      const res = await apiFetch<{ success: boolean; data: { protocol: RTPDetail } }>(
        `/rtp/${rtpDetail.id}/advance`,
        {
          method: 'POST',
          body: JSON.stringify({
            targetPhase: sequence[targetIdx],
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
        toast('error', apiError(err, t('advanceError')));
      }
    } finally {
      setAdvancing(false);
    }
  }

  // ─── RTP Detail View ──────────────────────────────────
  if (tab === 'detail' && rtpDetail) {
    const phases = [...rtpDetail.phases].sort((a: ProtocolPhase, b: ProtocolPhase) => a.order - b.order);
    const sequence = protocolSequence(rtpDetail);
    const currentIdx = sequence.indexOf(rtpDetail.currentPhase);
    const progress = sequence.length > 1 ? (currentIdx / (sequence.length - 1)) * 100 : 0;
    const currentPhase = phases.find((p: ProtocolPhase) => p.phase === rtpDetail.currentPhase) ?? null;
    const currentCriteria = rtpDetail.criteria
      .filter((c: Criterion) => c.phase === rtpDetail.currentPhase)
      .sort((a: Criterion, b: Criterion) => a.order - b.order);
    const mandatoryCriteria = currentCriteria.filter((c: Criterion) => c.mandatory);
    const metMandatory = mandatoryCriteria.filter((c: Criterion) => c.isMet).length;
    const openAdvisory = currentCriteria.filter((c: Criterion) => !c.mandatory && !c.isMet).length;
    const allMandatoryMet = mandatoryCriteria.length > 0 && metMandatory === mandatoryCriteria.length;
    const daysInProtocol = daysBetween(rtpDetail.startDate);
    const daysInPhase = currentPhase?.startedAt ? daysBetween(currentPhase.startedAt) : null;

    // Il `code` del protocollo di sistema: chiave delle traduzioni di fasi e
    // criteri. Nullo sui protocolli dell'organizzazione, e allora resta il
    // testo scritto dal medico.
    const tplCode = rtpDetail.template?.code ?? null;
    const phaseNameOf = (ph: ProtocolPhase) => rtpText(locale, rtpPhaseKey(tplCode, ph.order), ph.name);
    const phaseGoalOf = (ph: ProtocolPhase) => {
      const key = rtpPhaseKey(tplCode, ph.order);
      return rtpText(locale, key ? `${key}#g` : null, ph.goal);
    };
    /**
     * I criteri portano la fase come enum (`PHASE_2`), la chiave vuole il suo
     * numero d'ordine: l'elenco delle fasi del protocollo e' l'unica fonte
     * attendibile, perche' un protocollo puo' averne da 3 a 6 e la
     * corrispondenza enum→ordine non e' garantita. Fase non trovata: nessuna
     * chiave, quindi resta la descrizione del database.
     */
    const criterionTextOf = (c: Criterion) => {
      const order = phases.find((p: ProtocolPhase) => p.phase === c.phase)?.order;
      return rtpText(locale, order != null ? rtpCriterionKey(tplCode, order, c.order) : null, c.description);
    };

    /** Nome della fase: dal protocollo se c'e', dalle etichette storiche se no. */
    const phaseNamed = (code: string) => {
      if (code === 'CLEARED') return PHASE_LABELS.CLEARED;
      const ph = phases.find((p: ProtocolPhase) => p.phase === code);
      return ph ? t('phaseNamed', { n: ph.order, name: phaseNameOf(ph) }) : PHASE_LABELS[code] ?? code;
    };
    const phaseShort = (code: string) => {
      if (code === 'CLEARED') return PHASE_SHORT.CLEARED;
      const ph = phases.find((p: ProtocolPhase) => p.phase === code);
      return ph ? t('phaseNumber', { n: ph.order }) : PHASE_SHORT[code] ?? code;
    };
    const thresholdOf = (c: Criterion) => {
      if (!c.comparator || c.targetValue == null) return null;
      const unit = rtpUnit(locale, c.unit);
      return `${COMPARATOR_SIGN[c.comparator] ?? ''} ${c.targetValue}${unit ? ` ${unit}` : ''}`.trim();
    };
    const currentGoal = currentPhase ? phaseGoalOf(currentPhase) : null;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => { setTab('rtp'); setRtpDetail(null); }} className="rounded-lg p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600 dark:text-slate-400">
                {rtpDetail.athlete.firstName[0]}{rtpDetail.athlete.lastName[0]}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">{rtpDetail.athlete.firstName} {rtpDetail.athlete.lastName}</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">{rtpDetail.athlete.position} — {typeLabelOf(rtpDetail.injury.type)} ({BODY_LOCATIONS.find((l) => l.value === rtpDetail.injury.location)?.label || rtpDetail.injury.location})</p>
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

        {/* Protocollo applicato */}
        <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <ClipboardList className="h-4 w-4 text-indigo-500" />
            {rtpDetail.templateName ? templateLabel(tplCode, rtpDetail.templateName) : t('protocolLegacy')}
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {t('phaseCount', { count: phases.length || sequence.length - 1 })}
          </span>
          {rtpDetail.targetDate && (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              <Target className="mr-1 inline h-3.5 w-3.5" />
              {t('estimatedReturn')}: <span className="font-medium text-slate-700 dark:text-slate-300">{fmtDate(rtpDetail.targetDate, locale)}</span>
            </span>
          )}
          {daysInPhase != null && (
            <span className="text-sm text-slate-500 dark:text-slate-400">{t('daysInPhase', { days: daysInPhase })}</span>
          )}
        </div>

        {/* Phase progress bar */}
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('rtpProgression')}</h3>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${PHASE_COLORS[rtpDetail.currentPhase] ?? PHASE_COLORS.PHASE_1}`}>
              {phaseNamed(rtpDetail.currentPhase)}
            </span>
          </div>
          <div className="relative mb-4">
            <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-400 via-amber-400 to-emerald-500 transition-all duration-500"
                style={{ width: `${Math.max(progress, 5)}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between gap-1">
              {sequence.map((phase: string, i: number) => (
                <div key={phase} className={`flex-1 text-center ${i <= currentIdx ? 'text-slate-900 dark:text-white' : 'text-slate-300 dark:text-slate-600'}`}>
                  <div className={`mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    i < currentIdx ? 'bg-emerald-500 text-white' :
                    i === currentIdx ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' :
                    'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                  }`}>
                    {i < currentIdx ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className="block truncate text-xs">{phaseShort(phase)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Phase actions */}
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-3">
            <button
              onClick={() => advancePhase('prev')}
              disabled={currentIdx <= 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t('previousPhase')}
            </button>
            <div className="text-center text-sm">
              <span className="text-slate-500 dark:text-slate-400">{t('phaseCriteria')} </span>
              <span className={`font-semibold ${allMandatoryMet ? 'text-emerald-600' : 'text-amber-600'}`}>
                {t('mandatoryProgress', { met: metMandatory, total: mandatoryCriteria.length })}
              </span>
              {openAdvisory > 0 && (
                <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{t('advisoryPending', { count: openAdvisory })}</span>
              )}
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

        {/* Criteri della fase corrente */}
        <div className="card">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t('clearanceCriteria')} — {phaseNamed(rtpDetail.currentPhase)}
            </h3>
            {currentPhase?.typicalDays != null && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {t('phaseTypicalDays', { days: currentPhase.typicalDays })}
                {currentPhase.minDays != null ? ` · ${t('phaseMinDays', { days: currentPhase.minDays })}` : ''}
              </span>
            )}
          </div>
          {currentGoal && (
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{t('phaseGoal')}: {currentGoal}</p>
          )}
          {currentCriteria.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">{t('noCriteriaForPhase')}</p>
          ) : (
            <div className="space-y-2">
              {currentCriteria.map((c: Criterion) => {
                const threshold = thresholdOf(c);
                const description = criterionTextOf(c);
                const testName = rtpTestName(locale, c.testCode);
                const unit = rtpUnit(locale, c.unit);
                return (
                  <div
                    key={c.id}
                    className={`group flex items-start gap-3 rounded-lg border p-3 transition ${
                      c.isMet
                        ? 'border-emerald-200 bg-emerald-50'
                        : c.mandatory
                          ? 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
                          : 'border-dashed border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleCriterion(c.id, c.isMet)}
                      aria-label={description}
                      className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                        c.isMet ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {c.isMet && <CheckCircle2 className="h-4 w-4" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`text-sm font-medium ${c.isMet ? 'text-emerald-800 line-through' : 'text-slate-800 dark:text-slate-200'}`}>
                          {description}
                        </p>
                        {!c.mandatory && (
                          <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:border-slate-600 dark:text-slate-400">
                            {t('optionalBadge')}
                          </span>
                        )}
                      </div>
                      {(threshold || c.testCode) && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {testName}
                          {threshold ? <span className="ml-1 font-semibold text-slate-600 dark:text-slate-300">{threshold}</span> : null}
                        </p>
                      )}
                      {c.metAt && (
                        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{t('verifiedOn', { date: fmtDate(c.metAt, locale) })}</p>
                      )}
                    </div>
                    {threshold && (
                      <div className="flex flex-shrink-0 items-center gap-1">
                        <span className="text-xs text-slate-400 dark:text-slate-500">{t('measuredLabel')}</span>
                        <input
                          type="number"
                          step="any"
                          defaultValue={c.measuredValue ?? ''}
                          onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                            const next = e.target.value;
                            const prev = c.measuredValue == null ? '' : String(c.measuredValue);
                            if (next !== prev) saveMeasured(c.id, next);
                          }}
                          className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-900"
                        />
                        {unit && <span className="text-xs text-slate-400 dark:text-slate-500">{unit}</span>}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteCriterion(c.id)}
                      title={t('deleteCriterion')}
                      className="flex-shrink-0 rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:text-slate-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tutte le fasi del protocollo */}
        <div className="card">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">{t('allPhases')}</h3>
          <div className="space-y-3">
            {(phases.length ? phases : []).map((ph: ProtocolPhase) => {
              const phaseCriteria = rtpDetail.criteria.filter((c: Criterion) => c.phase === ph.phase);
              const pMandatory = phaseCriteria.filter((c: Criterion) => c.mandatory);
              const pMet = pMandatory.filter((c: Criterion) => c.isMet).length;
              const idx = sequence.indexOf(ph.phase);
              const isPast = idx < currentIdx;
              const isCurrent = ph.phase === rtpDetail.currentPhase;

              return (
                <div key={ph.id} className={`rounded-lg border p-3 ${isCurrent ? 'border-indigo-300 bg-indigo-50' : isPast ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-900'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                      {isPast ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" /> :
                       isCurrent ? <Activity className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-500" /> :
                       <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-300 dark:text-slate-600" />}
                      <div className="min-w-0">
                        <span className={`text-sm font-medium ${isPast ? 'text-emerald-700' : isCurrent ? 'text-indigo-700' : 'text-slate-500 dark:text-slate-400'}`}>
                          {t('phaseNamed', { n: ph.order, name: phaseNameOf(ph) })}
                        </span>
                        {ph.goal && <p className="text-xs text-slate-400 dark:text-slate-500">{phaseGoalOf(ph)}</p>}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{pMet}/{pMandatory.length} {t('criteria')}</span>
                      {ph.typicalDays != null && (
                        <p className="text-xs text-slate-400 dark:text-slate-500">{t('phaseTypicalDays', { days: ph.typicalDays })}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {phases.length === 0 && (
              <p className="text-sm text-slate-400 dark:text-slate-500">{t('noProtocolPhases')}</p>
            )}
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
                      <span className="font-medium">{phaseShort(log.fromPhase)}</span>
                      <ArrowRight className="mx-1 inline h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                      <span className="font-medium">{phaseShort(log.toPhase)}</span>
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
            <button onClick={() => setShowAdvanceModal(false)} className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">{tCommon('cancel')}</button>
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
                {phaseShort(rtpDetail.currentPhase)} → {phaseNamed(sequence[currentIdx + 1] ?? 'CLEARED')}
              </p>
              {!allMandatoryMet && mandatoryCriteria.length > 0 && (
                <p className="mt-1 text-amber-700">
                  <AlertTriangle className="mr-1 inline h-4 w-4" />
                  {t('criteriaNotMet', { count: mandatoryCriteria.length - metMandatory })}
                </p>
              )}
              {openAdvisory > 0 && (
                <p className="mt-1 text-xs text-slate-500">{t('advisoryPending', { count: openAdvisory })}</p>
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
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/injuries/protocols"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <ClipboardList className="h-4 w-4" />
            {t('protocolLibrary')}
          </Link>
          <button
            onClick={() => { setShowCreateModal(true); loadAthletes(); loadTemplates(); }}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            {t('newInjury')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-300 dark:text-slate-600" /></div>
      ) : protocols.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16">
          <Shield className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('noActiveRtp')}</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{t('noActiveRtpHint')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {protocols.map((p: RTPProtocolSummary) => {
            const sequence = protocolSequence(p);
            const phaseIdx = sequence.indexOf(p.currentPhase);
            const progress = sequence.length > 1 ? (phaseIdx / (sequence.length - 1)) * 100 : 0;
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
                    <span className="text-slate-500 dark:text-slate-400">{typeLabelOf(p.injury.type)} — {BODY_LOCATIONS.find((l) => l.value === p.injury.location)?.label || p.injury.location}</span>
                    <span className={SEVERITY_COLORS[p.injury.severity]}>{SEVERITY_LABELS[p.injury.severity]}</span>
                  </div>

                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {t('injuredOn', { date: fmtDate(p.injury.dateOccurred, locale) })}
                  </p>

                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-400 via-amber-400 to-emerald-500"
                      style={{ width: `${Math.max(progress, 8)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className={`rounded-full border px-2 py-0.5 font-medium ${PHASE_COLORS[p.currentPhase] ?? PHASE_COLORS.PHASE_1}`}>
                      {(() => {
                        const ph = p.phases?.find((x) => x.phase === p.currentPhase);
                        if (p.currentPhase === 'CLEARED') return PHASE_SHORT.CLEARED;
                        return ph ? t('phaseNumber', { n: ph.order }) : PHASE_SHORT[p.currentPhase] ?? p.currentPhase;
                      })()}
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
            <Select
              label={t('onsetLabel')}
              options={[{ value: '', label: t('onsetNone') }, ...INJURY_ONSETS]}
              value={injuryForm.onset}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInjuryForm((f: InjuryForm) => ({ ...f, onset: e.target.value }))}
            />
          </div>
          {/* Localizzazione: elenco di suggerimenti ma testo libero, per le sedi
              che non rientrano nell'elenco. Se il testo coincide con una voce
              nota si salva il suo codice, così resta tradotta. */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('locationLabel')}</label>
            <input
              list="injury-locations"
              value={BODY_LOCATIONS.find((l) => l.value === injuryForm.location)?.label ?? injuryForm.location}
              placeholder={t('locationPlaceholder')}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const typed = e.target.value;
                const match = BODY_LOCATIONS.find((l) => l.label.toLowerCase() === typed.trim().toLowerCase());
                setInjuryForm((f: InjuryForm) => ({ ...f, location: match ? match.value : typed }));
              }}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
            <datalist id="injury-locations">
              {BODY_LOCATIONS.map((l) => (
                <option key={l.value} value={l.label} />
              ))}
            </datalist>
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

          {/* Protocollo di rientro: proposto dalla libreria in base a sede,
              tipo e severita'. Si vede prima di registrare, non dopo. */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-2 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('rtpProtocolLabel')}</span>
            </div>
            <Select
              options={[
                {
                  value: '',
                  label: templateMatch?.template
                    ? t('templateAuto', { name: templateLabel(templateMatch.template.code, templateMatch.template.name) })
                    : t('templateAutoNone'),
                  group: t('templateGroupAuto'),
                },
                ...templates.map((tp: TemplateOption) => {
                  const name = templateLabel(tp.code, tp.name);
                  return {
                    value: tp.id,
                    label: tp.isSystem ? name : `${name} ${t('templateOwnSuffix')}`,
                    group: t('templateGroupManual'),
                  };
                }),
              ]}
              value={templateId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTemplateId(e.target.value)}
            />
            {templateId === '' && templateMatch?.template && (
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                {t('templateEstimate', {
                  phases: templateMatch.template.phaseCount,
                  date: templateMatch.estimatedReturn ? fmtDate(templateMatch.estimatedReturn, locale) : '—',
                })}
              </p>
            )}
            {templateId === '' && templateMatch && !templateMatch.template && (
              <p className="mt-1.5 text-xs text-amber-600">{t('noTemplateMatch')}</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
