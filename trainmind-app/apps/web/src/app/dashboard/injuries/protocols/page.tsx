'use client';

/**
 * Libreria dei protocolli RTP.
 *
 * I protocolli di sistema sono in sola lettura: il seed li riallinea a ogni
 * deploy, quindi una modifica fatta sopra sparirebbe senza dirlo a nessuno.
 * Per cambiarli si duplica e si lavora sulla copia dell'organizzazione.
 *
 * L'editor scrive fasi e criteri in blocco: sono un documento, non righe con
 * vita propria, ed e' anche il motivo per cui il PUT dell'API li riscrive
 * tutti invece di fare un merge per id.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Loader2, Copy, Trash2, Pencil, ClipboardList,
  ChevronDown, ChevronRight, Lock, X, Eye,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { apiFetch } from '@/lib/auth/fetch';
import { useApiError } from '@/lib/i18n/api-error';
import { INJURY_TYPE_DEFS } from '@/lib/constants/injuries';
import { RTP_BODY_ZONES, RTP_BODY_REGIONS, RTP_COMPARATORS } from '@trainmind/types';
import {
  rtpText, rtpTemplateKey, rtpPhaseKey, rtpCriterionKey, rtpTestName, rtpUnit,
} from '@trainmind/types/rtp-i18n';

// ─── Tipi ────────────────────────────────────────────────

interface TemplateCriterion {
  id?: string;
  order: number;
  description: string;
  testCode: string | null;
  comparator: string | null;
  targetValue: number | null;
  unit: string | null;
  mandatory: boolean;
}

interface TemplatePhase {
  id?: string;
  order: number;
  name: string;
  goal: string | null;
  minDays: number | null;
  typicalDays: number | null;
  /** Assente nell'elenco: la lista scarica solo il conteggio. */
  criteria?: TemplateCriterion[];
  _count?: { criteria: number };
}

interface Template {
  id: string;
  organizationId: string | null;
  code: string | null;
  name: string;
  description: string | null;
  bodyZone: string | null;
  bodyRegion: string | null;
  injuryType: string | null;
  severityMin: number | null;
  severityMax: number | null;
  isSystem: boolean;
  isActive: boolean;
  phases: TemplatePhase[];
}

const EMPTY_CRITERION: TemplateCriterion = {
  order: 1, description: '', testCode: null, comparator: null,
  targetValue: null, unit: null, mandatory: true,
};

function emptyTemplate(): Template {
  return {
    id: '', organizationId: null, code: null, name: '', description: null,
    bodyZone: null, bodyRegion: null, injuryType: null,
    severityMin: null, severityMax: null, isSystem: false, isActive: true,
    phases: [1, 2, 3].map((n) => ({
      order: n, name: '', goal: null, minDays: null, typicalDays: null,
      criteria: [{ ...EMPTY_CRITERION }],
    })),
  };
}

/** Giorni tipici sommati: la stima di rientro che il protocollo produrra'. */
function totalDays(phases: TemplatePhase[]): number | null {
  let sum = 0;
  let any = false;
  for (const p of phases) if (p.typicalDays != null && p.typicalDays > 0) { sum += p.typicalDays; any = true; }
  return any ? sum : null;
}

// ─── Pagina ──────────────────────────────────────────────

export default function RtpProtocolsPage() {
  const { toast } = useToast();
  const apiError = useApiError();
  const locale = useLocale();
  const t = useTranslations('rtpTemplates');
  const tInj = useTranslations('injuries');
  const tCommon = useTranslations('common');

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [editing, setEditing] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState(false);

  const ZONE_OPTIONS = useMemo(
    () => [{ value: '', label: t('anyZone') }, ...RTP_BODY_ZONES.map((z) => ({ value: z, label: t(`zone_${z}`) }))],
    [t],
  );
  const REGION_OPTIONS = useMemo(
    () => [{ value: '', label: t('anyRegion') }, ...RTP_BODY_REGIONS.map((r) => ({ value: r, label: t(`region_${r}`) }))],
    [t],
  );
  const TYPE_OPTIONS = useMemo(
    () => [{ value: '', label: t('anyType') }, ...INJURY_TYPE_DEFS.map(({ value, labelKey }) => ({ value, label: tInj(labelKey) }))],
    [t, tInj],
  );
  const COMPARATOR_OPTIONS = useMemo(
    () => [{ value: '', label: t('noThreshold') }, ...RTP_COMPARATORS.map((c) => ({ value: c, label: t(`comparator_${c}`) }))],
    [t],
  );

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ success: boolean; data: { templates: Template[] } }>('/rtp-templates');
      setTemplates(res.data.templates);
    } catch (err: unknown) {
      toast('error', apiError(err, t('loadError')));
    } finally {
      setLoading(false);
    }
    // Dipendenze volutamente ridotte a `toast`: `t` e `apiError` servono solo
    // per il messaggio di errore e sono stabili, ma tenerli qui ha gia'
    // prodotto un ciclo di fetch infinito quando `apiError` non era memoizzata.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function openEditor(id: string) {
    try {
      const res = await apiFetch<{ success: boolean; data: { template: Template } }>(`/rtp-templates/${id}`);
      setEditing(res.data.template);
    } catch (err: unknown) {
      toast('error', apiError(err, t('loadError')));
    }
  }

  async function duplicate(tpl: Template) {
    try {
      const res = await apiFetch<{ success: boolean; data: { template: Template } }>(
        `/rtp-templates/${tpl.id}/duplicate`, { method: 'POST', body: JSON.stringify({}) },
      );
      toast('success', t('duplicated'));
      await load();
      setEditing(res.data.template);
    } catch (err: unknown) {
      toast('error', apiError(err, t('saveError')));
    }
  }

  async function save() {
    if (!editing) return;
    if (!editing.name.trim()) { toast('error', t('nameRequired')); return; }
    for (const ph of editing.phases) {
      if (!ph.name.trim()) { toast('error', t('phaseNameRequired')); return; }
      if (!(ph.criteria ?? []).some((c) => c.description.trim())) { toast('error', t('criterionRequired')); return; }
    }

    // Si rinumera qui: l'utente aggiunge e toglie righe, l'API pretende
    // 1..N contigui.
    const payload = {
      name: editing.name.trim(),
      description: editing.description?.trim() || null,
      bodyZone: editing.bodyZone || null,
      bodyRegion: editing.bodyRegion || null,
      injuryType: editing.injuryType || null,
      severityMin: editing.severityMin,
      severityMax: editing.severityMax,
      isActive: editing.isActive,
      phases: editing.phases.map((ph, i) => ({
        order: i + 1,
        name: ph.name.trim(),
        goal: ph.goal?.trim() || null,
        minDays: ph.minDays,
        typicalDays: ph.typicalDays,
        criteria: (ph.criteria ?? [])
          .filter((c) => c.description.trim())
          .map((c, j) => ({
            order: j + 1,
            description: c.description.trim(),
            testCode: c.testCode?.trim() || null,
            comparator: c.comparator || null,
            targetValue: c.comparator ? c.targetValue : null,
            unit: c.unit?.trim() || null,
            mandatory: c.mandatory,
          })),
      })),
    };

    setSaving(true);
    try {
      if (editing.id) {
        await apiFetch(`/rtp-templates/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiFetch('/rtp-templates', { method: 'POST', body: JSON.stringify(payload) });
      }
      toast('success', t('saved'));
      setEditing(null);
      load();
    } catch (err: unknown) {
      toast('error', apiError(err, t('saveError')));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await apiFetch(`/rtp-templates/${toDelete.id}`, { method: 'DELETE' });
      toast('success', t('deleted'));
      setToDelete(null);
      load();
    } catch (err: unknown) {
      toast('error', apiError(err, t('deleteError')));
    } finally {
      setDeleting(false);
    }
  }

  // ── Modifiche locali all'editor ──
  function patchPhase(index: number, patch: Partial<TemplatePhase>) {
    setEditing((e) => (e ? { ...e, phases: e.phases.map((ph, i) => (i === index ? { ...ph, ...patch } : ph)) } : e));
  }
  function addPhase() {
    setEditing((e) => {
      if (!e || e.phases.length >= 6) return e;
      return {
        ...e,
        phases: [...e.phases, {
          order: e.phases.length + 1, name: '', goal: null, minDays: null, typicalDays: null,
          criteria: [{ ...EMPTY_CRITERION }],
        }],
      };
    });
  }
  function removePhase(index: number) {
    setEditing((e) => (e && e.phases.length > 3 ? { ...e, phases: e.phases.filter((_, i) => i !== index) } : e));
  }
  function patchCriterion(pi: number, ci: number, patch: Partial<TemplateCriterion>) {
    setEditing((e) => (e ? {
      ...e,
      phases: e.phases.map((ph, i) => (i === pi
        ? { ...ph, criteria: (ph.criteria ?? []).map((c, j) => (j === ci ? { ...c, ...patch } : c)) }
        : ph)),
    } : e));
  }
  function addCriterion(pi: number) {
    setEditing((e) => (e ? {
      ...e,
      phases: e.phases.map((ph, i) => (i === pi
        ? { ...ph, criteria: [...(ph.criteria ?? []), { ...EMPTY_CRITERION, order: (ph.criteria?.length ?? 0) + 1 }] }
        : ph)),
    } : e));
  }
  function removeCriterion(pi: number, ci: number) {
    setEditing((e) => (e ? {
      ...e,
      phases: e.phases.map((ph, i) => (i === pi ? { ...ph, criteria: (ph.criteria ?? []).filter((_, j) => j !== ci) } : ph)),
    } : e));
  }

  /** Riga di applicabilita': "Ginocchio · Legamentosa · severità 3-5". */
  function scopeLine(tpl: Template): string {
    const bits: string[] = [];
    if (tpl.bodyZone) bits.push(t(`zone_${tpl.bodyZone}`));
    else if (tpl.bodyRegion) bits.push(t(`region_${tpl.bodyRegion}`));
    if (tpl.injuryType) {
      const def = INJURY_TYPE_DEFS.find((d) => d.value === tpl.injuryType);
      bits.push(def ? tInj(def.labelKey) : tpl.injuryType);
    }
    if (tpl.severityMin != null || tpl.severityMax != null) {
      bits.push(t('severityRange', { min: tpl.severityMin ?? 1, max: tpl.severityMax ?? 5 }));
    }
    return bits.length ? bits.join(' · ') : t('appliesToAll');
  }

  // ── Testo clinico che arriva dal database ──
  //
  // Il seed scrive l'italiano; inglese e spagnolo stanno in `rtp-i18n`,
  // indicizzati sul `code` del protocollo di sistema. I protocolli
  // dell'organizzazione (creati a mano o duplicati) non hanno codice:
  // `rtpText` non trova la chiave e restituisce la stringa del database,
  // cioe' esattamente quello che ha scritto il medico. E' voluto.

  function tplName(tpl: Template): string {
    return rtpText(locale, rtpTemplateKey(tpl.code), tpl.name);
  }
  function tplDescription(tpl: Template): string | null {
    const key = rtpTemplateKey(tpl.code);
    return rtpText(locale, key ? `${key}#d` : null, tpl.description);
  }
  function phaseName(tpl: Template, ph: TemplatePhase): string {
    return rtpText(locale, rtpPhaseKey(tpl.code, ph.order), ph.name);
  }
  function phaseGoal(tpl: Template, ph: TemplatePhase): string | null {
    const key = rtpPhaseKey(tpl.code, ph.order);
    return rtpText(locale, key ? `${key}#g` : null, ph.goal);
  }
  function criterionText(tpl: Template, ph: TemplatePhase, c: TemplateCriterion): string {
    return rtpText(locale, rtpCriterionKey(tpl.code, ph.order, c.order), c.description);
  }

  /**
   * Valore di un campo dell'editor. La traduzione si mostra solo sui
   * protocolli di sistema, che stanno dentro un fieldset disabilitato e non
   * si salvano mai (il footer offre "duplica per modificare", non "salva").
   * Su un protocollo modificabile il campo resta legato alla stringa del
   * database: mostrare l'inglese significherebbe farglielo salvare sopra il
   * proprio testo alla prima modifica di un altro campo.
   */
  function roValue(tpl: Template, translated: string | null, raw: string | null): string {
    return (tpl.isSystem ? translated : raw) ?? '';
  }

  const systemTemplates = templates.filter((x) => x.isSystem);
  const ownTemplates = templates.filter((x) => !x.isSystem);

  function TemplateCard({ tpl }: { tpl: Template }) {
    const open = expanded === tpl.id;
    const days = totalDays(tpl.phases);
    return (
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <button
            type="button"
            onClick={() => setExpanded(open ? null : tpl.id)}
            className="flex min-w-0 flex-1 items-start gap-2 text-left"
          >
            {open ? <ChevronDown className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" /> : <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{tplName(tpl)}</span>
                {tpl.isSystem && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 dark:border-slate-600 dark:text-slate-400">
                    <Lock className="h-3 w-3" />
                    {t('systemBadge')}
                  </span>
                )}
                {!tpl.isActive && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">{t('inactiveBadge')}</span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{scopeLine(tpl)}</p>
            </div>
          </button>
          <div className="flex flex-shrink-0 items-center gap-3">
            <div className="text-right text-xs text-slate-500 dark:text-slate-400">
              <p>{t('phaseCount', { count: tpl.phases.length })}</p>
              {days != null && <p>{t('totalDays', { days })}</p>}
            </div>
            <button
              type="button"
              onClick={() => openEditor(tpl.id)}
              title={tpl.isSystem ? t('openReadonly') : tCommon('edit')}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-700"
            >
              {tpl.isSystem ? <Eye className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => duplicate(tpl)} title={t('duplicate')} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700">
              <Copy className="h-4 w-4" />
            </button>
            {!tpl.isSystem && (
              <>
                <button type="button" onClick={() => setToDelete(tpl)} title={tCommon('delete')} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {open && (
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-700">
            {tpl.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tplDescription(tpl)}
              </p>
            )}
            {tpl.phases.map((ph) => (
              <div key={ph.id ?? ph.order} className="flex items-baseline justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {tInj('phaseNamed', { n: ph.order, name: phaseName(tpl, ph) })}
                </span>
                <span className="flex-shrink-0 text-xs text-slate-400 dark:text-slate-500">
                  {t('criteriaCount', { count: ph.criteria?.length ?? ph._count?.criteria ?? 0 })}
                  {ph.typicalDays != null ? ` · ${t('daysShort', { days: ph.typicalDays })}` : ''}
                </span>
              </div>
            ))}
            {tpl.isSystem && (
              <p className="pt-1 text-xs text-slate-400 dark:text-slate-500">{t('systemReadonlyHint')}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/injuries" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => setEditing(emptyTemplate())}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
        >
          <Plus className="h-4 w-4" />
          {t('newTemplate')}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {t('ownSection')} ({ownTemplates.length})
            </h2>
            {ownTemplates.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-10 text-center">
                <ClipboardList className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('noOwnTemplates')}</p>
                <p className="mt-1 max-w-md text-xs text-slate-400 dark:text-slate-500">{t('noOwnTemplatesHint')}</p>
              </div>
            ) : (
              ownTemplates.map((tpl) => <TemplateCard key={tpl.id} tpl={tpl} />)
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {t('systemSection')} ({systemTemplates.length})
            </h2>
            {systemTemplates.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-10 text-center">
                <ClipboardList className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('noSystemTemplates')}</p>
                <p className="mt-1 max-w-lg text-xs text-slate-400 dark:text-slate-500">{t('noSystemTemplatesHint')}</p>
                <code className="mt-2 rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  pnpm --filter @trainmind/api exec tsx src/scripts/seed-rtp-templates.ts
                </code>
              </div>
            ) : (
              systemTemplates.map((tpl) => <TemplateCard key={tpl.id} tpl={tpl} />)
            )}
          </section>
        </>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('deleteTitle')}
        message={t('deleteMessage', { name: toDelete ? tplName(toDelete) : '' })}
        detail={t('deleteDetail')}
        busy={deleting}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />

      {/* Editor */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.isSystem ? t('viewTitle') : editing?.id ? t('editTitle') : t('newTitle')}
        size="xl"
        footer={
          <>
            <button onClick={() => setEditing(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
              {editing?.isSystem ? tCommon('close') : tCommon('cancel')}
            </button>
            {editing?.isSystem ? (
              <button
                onClick={() => { const src = editing; setEditing(null); duplicate(src); }}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
              >
                <Copy className="h-4 w-4" />
                {t('duplicateToEdit')}
              </button>
            ) : (
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {tCommon('save')}
              </button>
            )}
          </>
        }
      >
        {editing && (
          // fieldset invece di un `disabled` su ogni campo: un solo punto,
          // e il browser disabilita da solo tutto quello che c'e' dentro,
          // compresi i pulsanti "aggiungi fase" e "aggiungi criterio".
          <fieldset disabled={editing.isSystem} className="min-w-0 space-y-5">
            {editing.isSystem && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                {t('systemReadonlyHint')}
              </p>
            )}
            <Input
              label={t('nameLabel')}
              value={roValue(editing, tplName(editing), editing.name)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditing({ ...editing, name: e.target.value })}
            />
            <Input
              label={t('descriptionLabel')}
              value={roValue(editing, tplDescription(editing), editing.description)}
              placeholder={t('descriptionPlaceholder')}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditing({ ...editing, description: e.target.value })}
            />

            {/* Applicabilita' */}
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">{t('scopeTitle')}</p>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{t('scopeHint')}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Select
                  label={t('zoneLabel')}
                  options={ZONE_OPTIONS}
                  value={editing.bodyZone ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditing({ ...editing, bodyZone: e.target.value || null })}
                />
                <Select
                  label={t('regionLabel')}
                  options={REGION_OPTIONS}
                  value={editing.bodyRegion ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditing({ ...editing, bodyRegion: e.target.value || null })}
                />
                <Select
                  label={t('typeLabel')}
                  options={TYPE_OPTIONS}
                  value={editing.injuryType ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditing({ ...editing, injuryType: e.target.value || null })}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Select
                  label={t('severityMinLabel')}
                  options={[{ value: '', label: t('anySeverity') }, ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))]}
                  value={editing.severityMin != null ? String(editing.severityMin) : ''}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditing({ ...editing, severityMin: e.target.value ? Number(e.target.value) : null })}
                />
                <Select
                  label={t('severityMaxLabel')}
                  options={[{ value: '', label: t('anySeverity') }, ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))]}
                  value={editing.severityMax != null ? String(editing.severityMax) : ''}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditing({ ...editing, severityMax: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>

            {/* Fasi */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t('phasesTitle')} ({editing.phases.length}/6)
                </p>
                <button
                  type="button"
                  onClick={addPhase}
                  disabled={editing.phases.length >= 6}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-30 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('addPhase')}
                </button>
              </div>

              {editing.phases.map((ph, pi) => (
                <div key={pi} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                      {pi + 1}
                    </span>
                    <input
                      value={roValue(editing, phaseName(editing, ph), ph.name)}
                      placeholder={t('phaseNamePlaceholder')}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => patchPhase(pi, { name: e.target.value })}
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => removePhase(pi)}
                      disabled={editing.phases.length <= 3}
                      title={t('removePhase')}
                      className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <input
                      value={roValue(editing, phaseGoal(editing, ph), ph.goal)}
                      placeholder={t('phaseGoalPlaceholder')}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => patchPhase(pi, { goal: e.target.value })}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm sm:col-span-1 dark:border-slate-600 dark:bg-slate-900"
                    />
                    <input
                      type="number"
                      min={0}
                      value={ph.minDays ?? ''}
                      placeholder={t('minDaysPlaceholder')}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => patchPhase(pi, { minDays: e.target.value === '' ? null : Number(e.target.value) })}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                    />
                    <input
                      type="number"
                      min={0}
                      value={ph.typicalDays ?? ''}
                      placeholder={t('typicalDaysPlaceholder')}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => patchPhase(pi, { typicalDays: e.target.value === '' ? null : Number(e.target.value) })}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                    />
                  </div>

                  <div className="space-y-2">
                    {(ph.criteria ?? []).map((c, ci) => (
                      <div key={ci} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900">
                        <div className="flex items-center gap-2">
                          <input
                            value={roValue(editing, criterionText(editing, ph, c), c.description)}
                            placeholder={t('criterionPlaceholder')}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => patchCriterion(pi, ci, { description: e.target.value })}
                            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
                          />
                          <label className="flex flex-shrink-0 items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <input
                              type="checkbox"
                              checked={c.mandatory}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => patchCriterion(pi, ci, { mandatory: e.target.checked })}
                              className="rounded border-slate-300"
                            />
                            {t('mandatoryLabel')}
                          </label>
                          <button
                            type="button"
                            onClick={() => removeCriterion(pi, ci)}
                            className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <input
                            value={roValue(editing, rtpTestName(locale, c.testCode), c.testCode)}
                            placeholder={t('testPlaceholder')}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => patchCriterion(pi, ci, { testCode: e.target.value })}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                          />
                          <select
                            value={c.comparator ?? ''}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => patchCriterion(pi, ci, { comparator: e.target.value || null })}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800"
                          >
                            {COMPARATOR_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step="any"
                            value={c.targetValue ?? ''}
                            placeholder={t('targetPlaceholder')}
                            disabled={!c.comparator}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => patchCriterion(pi, ci, { targetValue: e.target.value === '' ? null : Number(e.target.value) })}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800"
                          />
                          <input
                            value={roValue(editing, rtpUnit(locale, c.unit), c.unit)}
                            placeholder={t('unitPlaceholder')}
                            disabled={!c.comparator}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => patchCriterion(pi, ci, { unit: e.target.value })}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800"
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addCriterion(pi)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t('addCriterion')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        )}
      </Modal>
    </div>
  );
}
