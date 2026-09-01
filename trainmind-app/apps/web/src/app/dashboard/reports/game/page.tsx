'use client';

/**
 * Report post-partita — scelta della partita, compilazione e download.
 *
 * L'elenco contiene solo partite COMPLETATE: prima del fischio finale i minuti
 * sono un cronometro in corsa e il report sarebbe la foto di qualcosa che si
 * muove ancora. Lo stesso vincolo e' ripetuto lato API.
 *
 * L'unica cosa scritta a mano sono le aspettative 0-5 e le note; tutto il
 * resto — minuti, turni, interruzioni, carico, ACWR, media stagionale — si
 * ricalcola a ogni apertura.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft, Save, Download, Loader2, Trophy, Activity, Timer } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Select } from '@/components/ui/select';
import { apiFetch } from '@/lib/auth/fetch';
import { useApiError } from '@/lib/i18n/api-error';
import { getAccessToken } from '@/lib/auth/api';
import { API_BASE_URL, API_PREFIX } from '@/lib/constants';
import { useTeam } from '@/hooks/use-team';

// ─── Tipi (specchio di GameReportData lato API) ─────────

interface GameStint {
  quarter: number;
  periodLabel: string;
  inMs: number;
  outMs: number;
  durationMs: number;
  breaks: number;
}

interface GamePlayer {
  athleteId: string;
  athleteName: string;
  jerseyNumber: number | null;
  photoUrl: string | null;
  minutes: number;
  totalPlayingMs: number;
  msByPeriod: Record<string, number>;
  stints: GameStint[];
  stintCount: number;
  breakCount: number;
  rpe: number | null;
  load: number | null;
  seasonAvgMinutes: number | null;
  minutesDelta: number | null;
  acwr: number | null;
  acwrZone: 'low' | 'optimal' | 'high' | 'danger' | null;
  readiness: number | null;
  readinessNote: string | null;
}

interface GameReport {
  kind: 'GAME';
  metadata: { organizationName: string; teamName?: string; generatedBy: string };
  gameSessionId: string;
  homeTeamName: string;
  awayTeamName: string;
  isHome: boolean | null;
  homeScore: number | null;
  awayScore: number | null;
  competition: string | null;
  venue: string | null;
  playedAt: string;
  dateLabel: string;
  timeLabel: string;
  quarters: number;
  overtimes: number;
  quarterDurationMs: number;
  periodLabels: string[];
  players: GamePlayer[];
  summary: {
    playersUsed: number;
    playersDressed: number;
    totalMinutes: number;
    expectedMinutes: number;
    avgRpe: number | null;
    totalLoad: number;
    avgStintsPerPlayer: number | null;
    totalBreaks: number;
  };
  statusLabels: Record<string, string>;
}

interface GameListItem {
  gameSessionId: string;
  title: string;
  playedAt: string;
  teamName: string | null;
  opponent: string | null;
  isHome: boolean | null;
  homeScore: number | null;
  awayScore: number | null;
  competition: string | null;
  playersUsed: number;
}

// ─── Colori ─────────────────────────────────────────────
// Scritti per intero: Tailwind non genera classi costruite a runtime.

const STATUS_TONE: Record<number, { on: string; off: string }> = {
  0: { on: 'bg-red-400 text-red-950 border-red-500', off: 'border-slate-200 dark:border-slate-600 text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/40' },
  1: { on: 'bg-orange-400 text-orange-950 border-orange-500', off: 'border-slate-200 dark:border-slate-600 text-slate-400 hover:bg-orange-50 dark:hover:bg-orange-950/40' },
  2: { on: 'bg-amber-300 text-amber-950 border-amber-400', off: 'border-slate-200 dark:border-slate-600 text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-950/40' },
  3: { on: 'bg-lime-300 text-lime-950 border-lime-400', off: 'border-slate-200 dark:border-slate-600 text-slate-400 hover:bg-lime-50 dark:hover:bg-lime-950/40' },
  4: { on: 'bg-green-300 text-green-950 border-green-400', off: 'border-slate-200 dark:border-slate-600 text-slate-400 hover:bg-green-50 dark:hover:bg-green-950/40' },
  5: { on: 'bg-emerald-400 text-emerald-950 border-emerald-500', off: 'border-slate-200 dark:border-slate-600 text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40' },
};

const ZONE_TONE: Record<string, string> = {
  low: 'text-sky-600 dark:text-sky-400',
  optimal: 'text-emerald-600 dark:text-emerald-400',
  high: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
};
const ZONE_KEY: Record<string, string> = {
  low: 'zoneLow', optimal: 'zoneOptimal', high: 'zoneHigh', danger: 'zoneDanger',
};

function fmtMin(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** L'API risponde `{ error: { message } }`; il testo grezzo e' l'ultima risorsa. */
async function readApiError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string }; message?: string };
    return parsed.error?.message || parsed.message || text || `HTTP ${res.status}`;
  } catch {
    return text || `HTTP ${res.status}`;
  }
}

export default function GameReportPage() {
  const t = useTranslations('gameReport');
  const locale = useLocale();
  const { toast } = useToast();
  const apiError = useApiError();
  const { teams, selectedTeamId } = useTeam();

  const [teamId, setTeamId] = useState('');
  const [games, setGames] = useState<GameListItem[]>([]);
  const [gameId, setGameId] = useState('');
  const [report, setReport] = useState<GameReport | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState<'PDF' | 'DOCX' | null>(null);
  const [dirty, setDirty] = useState(false);

  // Le uniche cose compilabili: fuori da `report` cosi' un ricaricamento non
  // se le porta via a meta'.
  const [readiness, setReadiness] = useState<Record<string, number | null>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!teamId && selectedTeamId) setTeamId(selectedTeamId);
  }, [selectedTeamId, teamId]);

  // ─── Elenco partite completate ───────────────────────

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
      const res = await apiFetch<{ data: GameListItem[] }>(`/game-report/list${qs}`);
      setGames(res.data || []);
      // La partita scelta puo' non esserci piu' dopo un cambio squadra.
      setGameId((prev) => ((res.data || []).some((g) => g.gameSessionId === prev) ? prev : ''));
    } catch (err) {
      setGames([]);
      toast('error', apiError(err, t('listError')));
    } finally {
      setLoadingList(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  useEffect(() => { void loadList(); }, [loadList]);

  // ─── Report della partita scelta ─────────────────────

  const loadReport = useCallback(async () => {
    if (!gameId) { setReport(null); return; }
    setLoading(true);
    try {
      const res = await apiFetch<{ data: { report: GameReport } }>(
        `/game-report/${gameId}?locale=${locale}`,
      );
      const r = res.data.report;
      setReport(r);
      setReadiness(Object.fromEntries(r.players.map((p) => [p.athleteId, p.readiness])));
      setNotes(Object.fromEntries(r.players.map((p) => [p.athleteId, p.readinessNote ?? ''])));
      setDirty(false);
    } catch (err) {
      setReport(null);
      toast('error', apiError(err, t('loadError')));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, locale]);

  useEffect(() => { void loadReport(); }, [loadReport]);

  // ─── Salvataggio ─────────────────────────────────────

  const save = async () => {
    if (!report) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ data: { report: GameReport } }>(
        `/game-report/${report.gameSessionId}/readiness?locale=${locale}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            entries: report.players.map((p) => ({
              athleteId: p.athleteId,
              readiness: readiness[p.athleteId] ?? null,
              readinessNote: notes[p.athleteId]?.trim() || null,
            })),
          }),
        },
      );
      const r = res.data.report;
      setReport(r);
      setReadiness(Object.fromEntries(r.players.map((p) => [p.athleteId, p.readiness])));
      setNotes(Object.fromEntries(r.players.map((p) => [p.athleteId, p.readinessNote ?? ''])));
      setDirty(false);
      toast('success', t('saved'));
    } catch (err) {
      toast('error', apiError(err, t('saveError')));
    } finally {
      setSaving(false);
    }
  };

  // ─── Download ────────────────────────────────────────

  const download = async (format: 'PDF' | 'DOCX') => {
    if (!report) return;
    setDownloading(format);
    try {
      const token = getAccessToken();
      if (!token) { toast('error', t('sessionExpired')); return; }
      const res = await fetch(
        `${API_BASE_URL}${API_PREFIX}/game-report/${report.gameSessionId}/export?format=${format}&locale=${locale}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(await readApiError(res));
      const blob = await res.blob();
      if (blob.size === 0) throw new Error(t('emptyFile'));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const slug = `${report.homeTeamName}-${report.awayTeamName}`
        .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      a.download = `report-partita-${slug}-${report.playedAt.slice(0, 10)}.${format.toLowerCase()}`;
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

  // ─── Opzioni ─────────────────────────────────────────

  const gameOptions = games.map((g) => {
    const score = g.homeScore != null && g.awayScore != null ? ` ${g.homeScore}-${g.awayScore}` : '';
    const opp = g.opponent ?? g.title;
    const vs = g.isHome === false ? `${opp} vs ${g.teamName ?? ''}` : `${g.teamName ?? ''} vs ${opp}`;
    const d = new Date(g.playedAt).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: '2-digit' });
    return { value: g.gameSessionId, label: `${d} · ${vs.trim()}${score}` };
  });

  const setPlayerReadiness = (athleteId: string, value: number) => {
    // Ricliccare lo stesso numero lo toglie: senza, una readiness messa per
    // sbaglio non si potrebbe piu' svuotare.
    setReadiness((prev) => ({ ...prev, [athleteId]: prev[athleteId] === value ? null : value }));
    setDirty(true);
  };

  // ─── Render ──────────────────────────────────────────

  return (
    <div className="space-y-6">
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
            disabled={saving || loading || !report}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? t('saving') : t('save')}
          </button>
          {(['PDF', 'DOCX'] as const).map((f) => (
            <button
              key={f}
              onClick={() => download(f)}
              disabled={!!downloading || loading || !report}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {downloading === f ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Selettori */}
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-2">
        <Select
          label={t('team')}
          options={[{ value: '', label: t('allTeams') }, ...teams.map((x) => ({ value: x.id, label: x.name }))]}
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
        />
        <Select
          label={`${t('game')} *`}
          options={[{ value: '', label: loadingList ? t('loadingGames') : t('chooseGame') }, ...gameOptions]}
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
        />
      </div>

      {!loadingList && games.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
          <Trophy className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('noGames')}</p>
        </div>
      )}

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        </div>
      )}

      {!loading && report && (
        <>
          {/* Tabellone */}
          <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center">
              <div className="flex-1 px-5 py-4 text-center text-lg font-bold text-slate-900 dark:text-white">
                {report.homeTeamName}
              </div>
              <div className="border-x border-slate-100 px-6 py-4 text-center font-mono text-2xl font-black tabular-nums text-slate-900 dark:border-slate-700 dark:text-white">
                {report.homeScore != null && report.awayScore != null
                  ? `${report.homeScore} - ${report.awayScore}`
                  : '—'}
              </div>
              <div className="flex-1 px-5 py-4 text-center text-lg font-bold text-slate-900 dark:text-white">
                {report.awayTeamName}
              </div>
            </div>
            <p className="border-t border-slate-100 px-5 py-2 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {report.dateLabel} · {report.timeLabel}
              {report.venue ? ` · ${report.venue}` : ''}
              {report.competition ? ` · ${report.competition}` : ''}
            </p>
          </div>

          {/* Riepilogo squadra */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {([
              ['playersUsed', `${report.summary.playersUsed} / ${report.summary.playersDressed}`],
              ['totalMinutes', `${report.summary.totalMinutes} / ${report.summary.expectedMinutes}`],
              ['avgRpe', report.summary.avgRpe != null ? String(report.summary.avgRpe) : '—'],
              ['totalLoad', report.summary.totalLoad > 0 ? String(report.summary.totalLoad) : '—'],
              ['avgStints', report.summary.avgStintsPerPlayer != null ? String(report.summary.avgStintsPerPlayer) : '—'],
              ['totalBreaks', String(report.summary.totalBreaks)],
            ] as const).map(([key, value]) => (
              <div key={key} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-2xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{t(key)}</p>
                <p className="font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
              </div>
            ))}
          </div>

          {/* Disponibilità: l'unica parte compilabile */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-700">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t('readinessTitle')}</h2>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className="inline-flex items-center gap-1.5 text-2xs text-slate-500 dark:text-slate-400">
                    <span className={`flex h-4 w-4 items-center justify-center rounded border text-2xs font-bold ${STATUS_TONE[n].on}`}>{n}</span>
                    {report.statusLabels[String(n)]}
                  </span>
                ))}
              </div>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {report.players.map((p) => (
                <div key={p.athleteId} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded object-cover" />
                    ) : (
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-slate-100 text-xs font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                        {p.athleteName.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    {p.jerseyNumber != null && (
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-slate-800 text-2xs font-bold text-white dark:bg-slate-600">
                        {p.jerseyNumber}
                      </span>
                    )}
                    <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">{p.athleteName}</span>
                  </div>

                  <span className={`w-14 flex-shrink-0 text-right font-mono text-sm tabular-nums ${
                    p.totalPlayingMs > 0 ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    {p.totalPlayingMs > 0 ? fmtMin(p.totalPlayingMs) : t('dnp')}
                  </span>

                  <div className="flex flex-shrink-0 gap-1">
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setPlayerReadiness(p.athleteId, n)}
                        title={report.statusLabels[String(n)]}
                        className={`h-7 w-7 rounded border text-xs font-bold transition-colors ${
                          readiness[p.athleteId] === n ? STATUS_TONE[n].on : STATUS_TONE[n].off
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>

                  <input
                    value={notes[p.athleteId] ?? ''}
                    onChange={(e) => { setNotes((prev) => ({ ...prev, [p.athleteId]: e.target.value })); setDirty(true); }}
                    placeholder={t('notePlaceholder')}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Carico — sola lettura */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-700">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Activity className="h-4 w-4 text-slate-400" />
                {t('loadTitle')}
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
                    <th className="px-3 py-2 text-right font-medium">{t('seasonAvg')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('delta')}</th>
                    <th className="px-5 py-2 text-right font-medium">{t('acwr')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {report.players.filter((p) => p.totalPlayingMs > 0).map((p) => (
                    <tr key={p.athleteId}>
                      <td className="px-5 py-2 text-slate-800 dark:text-slate-200">{p.athleteName}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">{p.minutes}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">{p.rpe ?? '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-200">{p.load ?? '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">{p.seasonAvgMinutes ?? '—'}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${
                        p.minutesDelta == null || p.minutesDelta === 0
                          ? 'text-slate-400'
                          : p.minutesDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {p.minutesDelta == null ? '—' : `${p.minutesDelta > 0 ? '+' : ''}${p.minutesDelta}`}
                      </td>
                      <td className="px-5 py-2 text-right">
                        <span className={`font-mono font-semibold tabular-nums ${p.acwrZone ? ZONE_TONE[p.acwrZone] : 'text-slate-400'}`}>
                          {p.acwr ?? '—'}
                        </span>
                        {p.acwrZone && (
                          <span className={`ml-1.5 text-2xs ${ZONE_TONE[p.acwrZone]}`}>{t(ZONE_KEY[p.acwrZone])}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Turni in campo — sola lettura */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-700">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Timer className="h-4 w-4 text-slate-400" />
                {t('stintsTitle')}
              </h2>
              <span className="text-2xs text-slate-400">{t('readOnly')}</span>
            </div>
            <div className="space-y-2 px-5 py-4">
              {report.players.filter((p) => p.stints.length > 0).map((p) => {
                const span = report.periodLabels.length * report.quarterDurationMs;
                return (
                  <div key={p.athleteId}>
                    <div className="flex items-center gap-2">
                      <span className="w-28 flex-shrink-0 truncate text-right text-xs font-medium text-slate-600 dark:text-slate-400">
                        {p.athleteName}
                      </span>
                      <div className="relative h-4 flex-1 overflow-hidden rounded bg-slate-200 dark:bg-slate-700">
                        {report.periodLabels.slice(1).map((_, i) => (
                          <div
                            key={i}
                            className="absolute top-0 h-full w-px bg-slate-400 dark:bg-slate-500"
                            style={{ left: `${((i + 1) / report.periodLabels.length) * 100}%` }}
                          />
                        ))}
                        {p.stints.map((st, i) => (
                          <div
                            key={i}
                            title={`${st.periodLabel} · ${fmtMin(st.durationMs)}${st.breaks > 0 ? ` · ${st.breaks} ${t('breaks')}` : ''}`}
                            className="absolute top-0 h-full rounded-sm bg-blue-700 dark:bg-blue-500"
                            style={{
                              left: `${(((st.quarter - 1) * report.quarterDurationMs + st.inMs) / span) * 100}%`,
                              width: `${Math.max((st.durationMs / span) * 100, 0.4)}%`,
                            }}
                          />
                        ))}
                      </div>
                      <span className="w-12 flex-shrink-0 text-right font-mono text-xs tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                        {fmtMin(p.totalPlayingMs)}
                      </span>
                    </div>
                    <div className="ml-30 mt-0.5 flex flex-wrap gap-1 pl-30" style={{ marginLeft: '7.5rem' }}>
                      {p.stints.map((st, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1 py-px font-mono text-2xs tabular-nums text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                        >
                          {st.periodLabel} {fmtMin(st.durationMs)}
                          {st.breaks > 0 && (
                            <span className="font-sans font-semibold text-amber-600 dark:text-amber-400">⏸{st.breaks}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {dirty && <p className="text-center text-xs text-amber-600 dark:text-amber-400">{t('unsaved')}</p>}
        </>
      )}
    </div>
  );
}
