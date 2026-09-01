'use client';

/**
 * Report giornaliero — compilazione e download.
 *
 * L'API restituisce sempre un payload completo: se il report del giorno non
 * è mai stato salvato arriva una bozza precompilata (rosa, attività dal
 * calendario, stato proposto da infortuni e protocolli RTP). Da lì in poi
 * comanda quello che scrive il preparatore: una volta salvato il report non
 * si ricalcola più da solo.
 *
 * Densità e carico sono in sola lettura e si rileggono a ogni apertura dai
 * cronometri e dalle sessioni della giornata.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import {
  ArrowLeft, Save, Download, Loader2, Plus, X, Sparkles, Clock, Activity,
  Stethoscope, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';
import {
  CLINICAL_FIELDS, NEXT_TRAINING_TONE, ACWR_TONE,
  type ClinicalFieldKey,
} from '@/lib/constants/daily-report';
import { useToast } from '@/components/ui/toast';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { apiFetch } from '@/lib/auth/fetch';
import { useApiError } from '@/lib/i18n/api-error';
import { getAccessToken } from '@/lib/auth/api';
import { API_BASE_URL, API_PREFIX } from '@/lib/constants';
import { useTeam } from '@/hooks/use-team';

// ─── Tipi (specchio di DailyReportData lato API) ────────

interface DailyActivity { label: string; minutes: number }

type ClinicalValues = Record<ClinicalFieldKey, string | null>;

interface DailyEntry {
  athleteId: string;
  athleteName: string;
  jerseyNumber: number | null;
  photoUrl: string | null;
  status: number;
  note: string | null;
  suggestedFrom?: 'injury' | 'rtp' | null;
  clinical: ClinicalValues;
  athleteLoad: {
    rpeToday: number | null;
    loadToday: number | null;
    acwr: number | null;
    acwrZone: 'low' | 'optimal' | 'high' | 'danger' | null;
  };
  openInjuryId: string | null;
}

interface DensityDrill { name: string; totalMs: number; perPlayerMs: number | null; workMs: number | null }

interface DensitySection {
  sessionId: string;
  title: string;
  gameDayLabel: string | null;
  timeRange: string | null;
  athletesAvailable: number;
  totalMs: number;
  activeMs: number;
  pauseMs: number;
  densityPct: number;
  densityBand: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  drills: DensityDrill[];
}

interface LoadRow {
  athleteId: string;
  athleteName: string;
  minutes: number;
  rpe: number | null;
  load: number | null;
  source: 'TRAINING' | 'GAME' | 'MIXED';
}

interface DailyReport {
  kind: 'DAILY';
  metadata: { organizationName: string; teamName?: string; generatedBy: string };
  date: string;
  weekdayLabel: string;
  teamId: string;
  activities: DailyActivity[];
  entries: DailyEntry[];
  teamLines: string | null;
  density: DensitySection[];
  densityDiagnostics: { sheets: number; withDrills: number; withoutDrills: number; eventsInDay: number };
  load: LoadRow[];
  saved: boolean;
  statusLabels: Record<string, string>;
}

// ─── Colori della scala 0-5 ─────────────────────────────
// Scritti per intero: Tailwind non genera classi costruite a runtime.

const STATUS_TONE: Record<number, { on: string; off: string }> = {
  0: { on: 'bg-red-400 text-red-950 border-red-500', off: 'border-slate-200 dark:border-slate-600 text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/40' },
  1: { on: 'bg-orange-400 text-orange-950 border-orange-500', off: 'border-slate-200 dark:border-slate-600 text-slate-400 hover:bg-orange-50 dark:hover:bg-orange-950/40' },
  2: { on: 'bg-amber-300 text-amber-950 border-amber-400', off: 'border-slate-200 dark:border-slate-600 text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-950/40' },
  3: { on: 'bg-lime-300 text-lime-950 border-lime-400', off: 'border-slate-200 dark:border-slate-600 text-slate-400 hover:bg-lime-50 dark:hover:bg-lime-950/40' },
  4: { on: 'bg-green-300 text-green-950 border-green-400', off: 'border-slate-200 dark:border-slate-600 text-slate-400 hover:bg-green-50 dark:hover:bg-green-950/40' },
  5: { on: 'bg-emerald-400 text-emerald-950 border-emerald-500', off: 'border-slate-200 dark:border-slate-600 text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40' },
};

const BAND_KEY: Record<DensitySection['densityBand'], string> = {
  LOW: 'bandLow', MEDIUM: 'bandMedium', HIGH: 'bandHigh', VERY_HIGH: 'bandVeryHigh',
};

const BAND_TONE: Record<DensitySection['densityBand'], string> = {
  LOW: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  MEDIUM: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  HIGH: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  VERY_HIGH: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const SOURCE_KEY: Record<LoadRow['source'], string> = {
  TRAINING: 'sourceTraining', GAME: 'sourceGame', MIXED: 'sourceMixed',
};

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtMs(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}min ${total % 60}s`;
}

/** L'API risponde `{ error: { message } }`; il testo grezzo è l'ultima risorsa. */
async function readApiError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string }; message?: string };
    return parsed.error?.message || parsed.message || text || `HTTP ${res.status}`;
  } catch {
    return text || `HTTP ${res.status}`;
  }
}

export default function DailyReportPage() {
  const t = useTranslations('dailyReport');
  const tVocab = useTranslations('dailyVocab');
  const locale = useLocale();
  const { toast } = useToast();
  const apiError = useApiError();
  const { teams, selectedTeamId } = useTeam();

  const [teamId, setTeamId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState<'PDF' | 'DOCX' | null>(null);
  const [dirty, setDirty] = useState(false);

  // Campi compilabili, tenuti fuori da `report` perché sono gli unici che
  // l'utente modifica: così un ricaricamento non se li porta via a metà.
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [teamLines, setTeamLines] = useState('');
  // Le nove tendine cliniche stanno dietro un pannello per riga: aperte tutte
  // insieme la tabella diventa illeggibile, e per una rosa sana restano vuote.
  const [openClinical, setOpenClinical] = useState<Set<string>>(new Set());

  // La squadra del selettore globale è il default, ma resta cambiabile:
  // il report è per squadra e capita di compilarne più d'uno di seguito.
  useEffect(() => {
    if (!teamId && selectedTeamId) setTeamId(selectedTeamId);
    else if (!teamId && teams.length > 0) setTeamId(teams[0].id);
  }, [selectedTeamId, teams, teamId]);

  const load = useCallback(async () => {
    if (!teamId || !date) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ data: { report: DailyReport } }>(
        `/daily-report?teamId=${encodeURIComponent(teamId)}&date=${date}&locale=${locale}`,
      );
      const r = res.data.report;
      setReport(r);
      setActivities(r.activities);
      setEntries(r.entries);
      setTeamLines(r.teamLines ?? '');
      setDirty(false);
    } catch (err) {
      setReport(null);
      toast('error', apiError(err, t('loadError')));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, date, locale]);

  useEffect(() => { void load(); }, [load]);

  // ─── Modifiche ──────────────────────────────────────

  const setStatus = (athleteId: string, status: number) => {
    setEntries((prev) => prev.map((e) => (e.athleteId === athleteId ? { ...e, status, suggestedFrom: null } : e)));
    setDirty(true);
  };

  const setNote = (athleteId: string, note: string) => {
    setEntries((prev) => prev.map((e) => (e.athleteId === athleteId ? { ...e, note } : e)));
    setDirty(true);
  };

  const setClinical = (athleteId: string, field: ClinicalFieldKey, value: string) => {
    setEntries((prev) => prev.map((e) =>
      e.athleteId === athleteId
        ? { ...e, clinical: { ...e.clinical, [field]: value === '' ? null : value } }
        : e));
    setDirty(true);
  };

  const toggleClinical = (athleteId: string) => {
    setOpenClinical((prev) => {
      const next = new Set(prev);
      if (next.has(athleteId)) next.delete(athleteId); else next.add(athleteId);
      return next;
    });
  };

  /** Quante tendine sono compilate: il badge sul pulsante del pannello chiuso. */
  const clinicalCount = (e: DailyEntry) =>
    CLINICAL_FIELDS.reduce((n, f) => n + (e.clinical?.[f.key] ? 1 : 0), 0);

  const updateActivity = (i: number, patch: Partial<DailyActivity>) => {
    setActivities((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
    setDirty(true);
  };

  const addActivity = () => { setActivities((prev) => [...prev, { label: '', minutes: 0 }]); setDirty(true); };
  const removeActivity = (i: number) => { setActivities((prev) => prev.filter((_, idx) => idx !== i)); setDirty(true); };

  // ─── Salvataggio ────────────────────────────────────

  const save = async () => {
    if (!teamId) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ data: { report: DailyReport } }>(`/daily-report?locale=${locale}`, {
        method: 'PUT',
        body: JSON.stringify({
          teamId,
          date,
          // Le attività senza nome sono righe che l'utente ha aggiunto e non
          // ha compilato: si scartano invece di far fallire la validazione.
          activities: activities
            .filter((a) => a.label.trim().length > 0)
            .map((a) => ({ label: a.label.trim(), minutes: Math.max(0, Math.round(a.minutes || 0)) })),
          teamLines: teamLines.trim() ? teamLines : null,
          entries: entries.map((e) => ({
            athleteId: e.athleteId,
            status: e.status,
            note: e.note?.trim() ? e.note.trim() : null,
            ...Object.fromEntries(CLINICAL_FIELDS.map((f) => [f.key, e.clinical?.[f.key] ?? null])),
          })),
        }),
      });
      const r = res.data.report;
      setReport(r);
      setActivities(r.activities);
      setEntries(r.entries);
      setTeamLines(r.teamLines ?? '');
      setDirty(false);
      toast('success', t('saved'));
    } catch (err) {
      toast('error', apiError(err, t('saveError')));
    } finally {
      setSaving(false);
    }
  };

  // ─── Download ───────────────────────────────────────

  const download = async (format: 'PDF' | 'DOCX') => {
    if (!teamId) return;
    setDownloading(format);
    try {
      const token = getAccessToken();
      if (!token) { toast('error', t('sessionExpired')); return; }

      const res = await fetch(
        `${API_BASE_URL}${API_PREFIX}/daily-report/export?teamId=${encodeURIComponent(teamId)}&date=${date}&format=${format}&locale=${locale}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(await readApiError(res));

      const blob = await res.blob();
      if (blob.size === 0) throw new Error(t('emptyFile'));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const slug = (report?.metadata.teamName || 'team').toLowerCase().replace(/\s+/g, '_');
      a.download = `report-giornaliero-${slug}-${date}.${format.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('success', t('downloaded', { format }));
    } catch (err) {
      toast('error', apiError(err, t('downloadError')));
    } finally {
      setDownloading(null);
    }
  };

  const teamOptions = teams.map((x) => ({ value: x.id, label: x.name }));
  const suggestedCount = entries.filter((e) => e.suggestedFrom).length;

  // ─── Render ─────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link
            href="/dashboard/reports"
            className="mt-1 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving || loading || !teamId}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? t('saving') : t('save')}
          </button>
          <button
            onClick={() => download('PDF')}
            disabled={!!downloading || loading || !teamId}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {downloading === 'PDF' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            PDF
          </button>
          <button
            onClick={() => download('DOCX')}
            disabled={!!downloading || loading || !teamId}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {downloading === 'DOCX' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            DOCX
          </button>
        </div>
      </div>

      {/* Selettori */}
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-3">
        <Select
          label={`${t('team')} *`}
          options={teamOptions}
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
        />
        <Input label={`${t('date')} *`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="flex items-end">
          {report && (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
              report.saved
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
            }`}>
              {report.saved ? t('statusSaved') : t('statusDraft')}
            </span>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        </div>
      )}

      {!loading && !report && teamId && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('noData')}</p>
        </div>
      )}

      {!loading && report && (
        <>
          {/* Intestazione del documento */}
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-lg font-bold text-slate-900 dark:text-white">{report.weekdayLabel}</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {new Date(`${report.date}T12:00:00Z`).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
              {report.metadata.teamName && (
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">· {report.metadata.teamName}</span>
              )}
            </div>
            {!report.saved && suggestedCount > 0 && (
              <p className="mt-2 inline-flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                {t('suggestedHint', { count: suggestedCount })}
              </p>
            )}
          </div>

          {/* Attività */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Clock className="h-4 w-4 text-slate-400" />
                {t('activities')}
              </h2>
              <button
                onClick={addActivity}
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-500 hover:border-teal-400 hover:text-teal-600 dark:border-slate-600"
              >
                <Plus className="h-3 w-3" /> {t('addActivity')}
              </button>
            </div>
            {activities.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">{t('noActivities')}</p>
            ) : (
              <div className="space-y-2">
                {activities.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={a.label}
                      onChange={(e) => updateActivity(i, { label: e.target.value })}
                      placeholder={t('activityPlaceholder')}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    />
                    <input
                      type="number"
                      min={0}
                      max={600}
                      value={a.minutes}
                      onChange={(e) => updateActivity(i, { minutes: Number(e.target.value) })}
                      className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm tabular-nums text-slate-900 outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    />
                    <span className="w-8 text-xs text-slate-400">{t('minutesShort')}</span>
                    <button
                      onClick={() => removeActivity(i)}
                      className="rounded p-1 text-slate-300 hover:text-red-500"
                      title={t('removeActivity')}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Giocatori */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-700">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t('players')}</h2>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className="inline-flex items-center gap-1.5 text-2xs text-slate-500 dark:text-slate-400">
                    <span className={`flex h-4 w-4 items-center justify-center rounded border text-2xs font-bold ${STATUS_TONE[n].on}`}>{n}</span>
                    {report.statusLabels[String(n)]}
                  </span>
                ))}
              </div>
            </div>
            {entries.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">{t('noPlayers')}</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {entries.map((e) => (
                  <div key={e.athleteId} className="px-5 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {e.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={e.photoUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded object-cover" />
                      ) : (
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-slate-100 text-xs font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                          {e.athleteName.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      {e.jerseyNumber != null && (
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-slate-800 text-2xs font-bold text-white dark:bg-slate-600">
                          {e.jerseyNumber}
                        </span>
                      )}
                      <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">{e.athleteName}</span>
                      {e.suggestedFrom && (
                        <span className="flex-shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-2xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          {t(e.suggestedFrom === 'rtp' ? 'fromRtp' : 'fromInjury')}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-shrink-0 gap-1">
                      {[0, 1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          onClick={() => setStatus(e.athleteId, n)}
                          title={report.statusLabels[String(n)]}
                          className={`h-7 w-7 rounded border text-xs font-bold transition-colors ${
                            e.status === n ? STATUS_TONE[n].on : STATUS_TONE[n].off
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>

                    <input
                      value={e.note ?? ''}
                      onChange={(ev) => setNote(e.athleteId, ev.target.value)}
                      placeholder={t('notePlaceholder')}
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    />

                    {/* Carico recente: informa la scelta dello stato, non la fa. */}
                    <div className="flex flex-shrink-0 items-center gap-2 text-2xs">
                      <span
                        className="rounded bg-slate-100 px-1.5 py-1 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                        title={t('rpeTooltip')}
                      >
                        {t('rpe')} <span className="font-mono font-semibold">{e.athleteLoad?.rpeToday ?? '—'}</span>
                      </span>
                      <span
                        className="rounded bg-slate-100 px-1.5 py-1 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                        title={t('acwrTooltip')}
                      >
                        {t('acwr')}{' '}
                        <span className={`font-mono font-semibold ${e.athleteLoad?.acwrZone ? ACWR_TONE[e.athleteLoad.acwrZone] : ''}`}>
                          {e.athleteLoad?.acwr ?? '—'}
                        </span>
                      </span>
                    </div>

                    <button
                      onClick={() => toggleClinical(e.athleteId)}
                      title={t('clinicalToggle')}
                      className={`flex flex-shrink-0 items-center gap-1 rounded-lg border px-2 py-1.5 text-2xs font-medium transition-colors ${
                        clinicalCount(e) > 0
                          ? 'border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Stethoscope className="h-3.5 w-3.5" />
                      {clinicalCount(e) > 0 && <span className="font-mono">{clinicalCount(e)}</span>}
                      {openClinical.has(e.athleteId) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  </div>

                  {/* Scheda medica: le nove tendine del foglio di fine giornata */}
                  {openClinical.has(e.athleteId) && (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-900/50">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-2xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {t('clinicalSection')}
                        </span>
                        {e.openInjuryId && (
                          <Link
                            href={`/dashboard/injuries?injuryId=${e.openInjuryId}`}
                            className="inline-flex items-center gap-1 text-2xs font-medium text-teal-600 hover:underline dark:text-teal-400"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {t('openInjury')}
                          </Link>
                        )}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                        {CLINICAL_FIELDS.map((f) => {
                          const value = e.clinical?.[f.key] ?? '';
                          const tone = f.key === 'nextTraining' && value ? NEXT_TRAINING_TONE[value] : '';
                          return (
                            <label key={f.key} className="block">
                              <span className="mb-0.5 block text-2xs font-medium text-slate-500 dark:text-slate-400">
                                {t(`field_${f.key}`)}
                              </span>
                              <select
                                value={value}
                                onChange={(ev) => setClinical(e.athleteId, f.key, ev.target.value)}
                                className={`w-full rounded-md border px-2 py-1.5 text-xs outline-none focus:border-teal-500 ${
                                  tone || 'border-slate-200 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white'
                                }`}
                              >
                                <option value="">—</option>
                                {f.codes.map((c) => (
                                  <option key={c} value={c}>{tVocab(`${f.key}.${c}`)}</option>
                                ))}
                              </select>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Linee per domani */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">{t('teamLines')}</h2>
            <textarea
              value={teamLines}
              onChange={(ev) => { setTeamLines(ev.target.value); setDirty(true); }}
              rows={4}
              placeholder={t('teamLinesPlaceholder')}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </section>

          {/* Carico — sola lettura */}
          {report.load.length === 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Activity className="h-4 w-4 text-slate-400" />
                {t('loadSummary')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('noLoad')}</p>
            </section>
          )}
          {report.load.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-700">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <Activity className="h-4 w-4 text-slate-400" />
                  {t('loadSummary')}
                </h2>
                <span className="text-2xs text-slate-400">{t('readOnly')}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
                      <th className="px-5 py-2 font-medium">{t('player')}</th>
                      <th className="px-3 py-2 text-right font-medium">{t('minutes')}</th>
                      <th className="px-3 py-2 text-right font-medium">{t('rpe')}</th>
                      <th className="px-3 py-2 text-right font-medium">{t('load')}</th>
                      <th className="px-5 py-2 font-medium">{t('source')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {report.load.map((l) => (
                      <tr key={l.athleteId}>
                        <td className="px-5 py-2 text-slate-800 dark:text-slate-200">{l.athleteName}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">{l.minutes}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">{l.rpe ?? '—'}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-200">{l.load ?? '—'}</td>
                        <td className="px-5 py-2 text-xs text-slate-500 dark:text-slate-400">{t(SOURCE_KEY[l.source])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Densità — sola lettura */}
          {report.density.length === 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
              <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">{t('density')}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {report.densityDiagnostics.sheets === 0
                  ? t('noDensityNoSheets', { events: report.densityDiagnostics.eventsInDay })
                  : t('noDensityNoDrills', { sheets: report.densityDiagnostics.sheets })}
              </p>
            </section>
          )}
          {report.density.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t('density')}</h2>
              {report.density.map((d) => {
                const maxRow = Math.max(1, ...d.drills.map((x) => x.totalMs + (x.perPlayerMs ?? 0) + (x.workMs ?? 0)));
                return (
                  <div key={d.sessionId} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{d.title}</h3>
                      {d.gameDayLabel && (
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-2xs font-bold text-white dark:bg-slate-600">{d.gameDayLabel}</span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${BAND_TONE[d.densityBand]}`}>
                        {t(BAND_KEY[d.densityBand])} · {d.densityPct}%
                      </span>
                    </div>
                    <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                      {d.timeRange ? `${d.timeRange} · ` : ''}
                      {t('athletesCount', { count: d.athletesAvailable })} · {fmtMs(d.totalMs)}
                    </p>

                    <div className="space-y-1.5">
                      {d.drills.map((x, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-32 flex-shrink-0 truncate text-right text-xs font-medium text-slate-600 dark:text-slate-400">{x.name}</span>
                          <div className="flex h-4 flex-1 overflow-hidden rounded">
                            <div className="flex flex-shrink-0 items-center justify-end bg-blue-700 pr-1 text-2xs italic text-white" style={{ width: `${(x.totalMs / maxRow) * 100}%` }}>
                              {fmtMs(x.totalMs)}
                            </div>
                            {x.perPlayerMs != null && x.perPlayerMs > 0 && (
                              <div className="flex flex-shrink-0 items-center justify-end bg-sky-400 pr-1 text-2xs italic text-white" style={{ width: `${(x.perPlayerMs / maxRow) * 100}%` }}>
                                {fmtMs(x.perPlayerMs)}
                              </div>
                            )}
                            {x.workMs != null && x.workMs > 0 && (
                              <div className="flex flex-shrink-0 items-center justify-end bg-slate-400 pr-1 text-2xs italic text-white" style={{ width: `${(x.workMs / maxRow) * 100}%` }}>
                                {fmtMs(x.workMs)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1"><i className="h-2 w-2 bg-blue-700" />{t('totalTime')}</span>
                      <span className="inline-flex items-center gap-1"><i className="h-2 w-2 bg-sky-400" />{t('perPlayer')}</span>
                      <span className="inline-flex items-center gap-1"><i className="h-2 w-2 bg-slate-400" />{t('workOnly')}</span>
                    </div>

                    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                      <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
                        <p className="text-slate-500 dark:text-slate-400">{t('activeTime')}</p>
                        <p className="font-mono font-semibold text-slate-800 dark:text-slate-200">{fmtMs(d.activeMs)} · {d.densityPct}%</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
                        <p className="text-slate-500 dark:text-slate-400">{t('totalTime')}</p>
                        <p className="font-mono font-semibold text-slate-800 dark:text-slate-200">{fmtMs(d.totalMs)}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
                        <p className="text-slate-500 dark:text-slate-400">{t('pauseTime')}</p>
                        <p className="font-mono font-semibold text-slate-800 dark:text-slate-200">{fmtMs(d.pauseMs)} · {100 - d.densityPct}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {dirty && (
            <p className="text-center text-xs text-amber-600 dark:text-amber-400">{t('unsaved')}</p>
          )}
        </>
      )}
    </div>
  );
}
