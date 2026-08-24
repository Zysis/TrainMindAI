'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ClipboardCheck, Info } from 'lucide-react';
import { apiFetch } from '@/lib/auth/fetch';

// ─── Types ──────────────────────────────────────────────

interface AttendanceStats {
  trainings: number;
  present: number;
  unavailable: number;
  absent: number;
  attendanceRate: number | null;
  avgRpe: number | null;
  totalLoad: number;
}

interface AttendanceAthlete extends AttendanceStats {
  athleteId: string;
  firstName: string;
  lastName: string;
  byType: Record<string, AttendanceStats>;
}

interface AttendanceResponse {
  athletes: AttendanceAthlete[];
  types: string[];
  summary: {
    totalSheets: number;
    sheetsByType: Record<string, number>;
  };
}

interface Props {
  athleteId?: string;
  teamId?: string | null;
  dateFrom: string;
  dateTo: string;
}

/** Etichette dei tipi di allenamento, con le stesse chiavi usate dal calendario */
const TYPE_LABEL_KEYS: Record<string, string> = {
  gym: 'attTypeGym',
  basket: 'attTypeBasket',
  individual: 'attTypeIndividual',
  shooting: 'attTypeShooting',
  rehab: 'attTypeRehab',
  session: 'attTypeSession',
  other: 'attTypeOther',
};

/** Verde sopra l'80%, ambra fra 60 e 80, rosso sotto: come i semafori del foglio */
function rateTone(rate: number | null): string {
  if (rate == null) return 'text-slate-400 dark:text-slate-500';
  if (rate >= 80) return 'text-green-600 dark:text-green-400';
  if (rate >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function barTone(rate: number | null): string {
  if (rate == null) return 'bg-slate-300 dark:bg-slate-600';
  if (rate >= 80) return 'bg-green-500';
  if (rate >= 60) return 'bg-amber-400';
  return 'bg-red-500';
}

export function AttendancePanel({ athleteId, teamId, dateFrom, dateTo }: Props) {
  const t = useTranslations('analytics');
  const [data, setData] = useState<AttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (athleteId) params.set('athleteId', athleteId);
        if (teamId) params.set('teamId', teamId);
        if (dateFrom) params.set('from', dateFrom);
        if (dateTo) params.set('to', dateTo);
        const res = await apiFetch<{ data: AttendanceResponse }>(`/analytics/attendance?${params}`);
        if (!cancelled) setData(res.data);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [athleteId, teamId, dateFrom, dateTo]);

  const types = useMemo(() => {
    if (!data) return [];
    // Ordine stabile e leggibile, i tipi sconosciuti in coda
    const preferred = ['basket', 'gym', 'individual', 'shooting', 'rehab', 'session', 'other'];
    return [...data.types].sort((a, b) => {
      const ia = preferred.indexOf(a);
      const ib = preferred.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  }, [data]);

  const typeLabel = (type: string) =>
    TYPE_LABEL_KEYS[type] ? t(TYPE_LABEL_KEYS[type]) : type;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (!data || data.athletes.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <ClipboardCheck className="h-10 w-10 text-slate-300 dark:text-slate-600" />
        <p className="text-sm text-slate-400 dark:text-slate-500">{t('attNoData')}</p>
      </div>
    );
  }

  const headCell =
    'px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 whitespace-nowrap';
  const numCell = 'px-3 py-2 text-right font-mono text-sm tabular-nums whitespace-nowrap';

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t('attTitle')}</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('attSubtitle')}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className={`${headCell} text-left`}>{t('attAthlete')}</th>
                <th className={`${headCell} text-right`}>{t('attTrainings')}</th>
                <th className={`${headCell} text-right`}>{t('attPresent')}</th>
                <th className={`${headCell} text-right`}>{t('attUnavailable')}</th>
                <th className={`${headCell} text-right`}>{t('attAbsent')}</th>
                <th className={`${headCell} text-right`}>{t('attRate')}</th>
                <th className={`${headCell} text-right`}>{t('attAvgRpe')}</th>
                <th className={`${headCell} text-right`}>{t('attTotalLoad')}</th>
              </tr>
            </thead>
            <tbody>
              {data.athletes.map((a) => (
                <tr
                  key={a.athleteId}
                  className="border-t border-slate-100 dark:border-slate-700/60"
                >
                  <td className="px-3 py-2 text-sm font-medium text-slate-900 dark:text-white whitespace-nowrap">
                    {a.lastName} {a.firstName}
                  </td>
                  <td className={`${numCell} text-slate-600 dark:text-slate-300`}>{a.trainings}</td>
                  <td className={`${numCell} text-green-600 dark:text-green-400`}>{a.present}</td>
                  <td className={`${numCell} text-amber-600 dark:text-amber-400`}>{a.unavailable}</td>
                  <td className={`${numCell} text-red-600 dark:text-red-400`}>{a.absent}</td>
                  <td className={numCell}>
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        <div
                          className={`h-full rounded-full ${barTone(a.attendanceRate)}`}
                          style={{ width: `${a.attendanceRate ?? 0}%` }}
                        />
                      </div>
                      <span className={`font-semibold ${rateTone(a.attendanceRate)}`}>
                        {a.attendanceRate != null ? `${a.attendanceRate}%` : '—'}
                      </span>
                    </div>
                  </td>
                  <td className={`${numCell} text-slate-700 dark:text-slate-200`}>
                    {a.avgRpe != null ? a.avgRpe.toFixed(1) : '—'}
                  </td>
                  <td className={`${numCell} font-semibold text-teal-700 dark:text-teal-300`}>
                    {a.totalLoad > 0 ? a.totalLoad.toLocaleString('it-IT') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dettaglio per tipologia di allenamento */}
      {types.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t('attByType')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className={`${headCell} text-left`}>{t('attAthlete')}</th>
                  {types.map((type) => (
                    <th key={type} className={`${headCell} text-right`}>
                      {typeLabel(type)}
                      <span className="ml-1 font-normal normal-case text-slate-400 dark:text-slate-500">
                        ({data.summary.sheetsByType[type] ?? 0})
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.athletes.map((a) => (
                  <tr key={a.athleteId} className="border-t border-slate-100 dark:border-slate-700/60">
                    <td className="px-3 py-2 text-sm font-medium text-slate-900 dark:text-white whitespace-nowrap">
                      {a.lastName} {a.firstName}
                    </td>
                    {types.map((type) => {
                      const cell = a.byType[type];
                      return (
                        <td key={type} className={numCell}>
                          {cell ? (
                            <span className={`font-semibold ${rateTone(cell.attendanceRate)}`}>
                              {cell.present}/{cell.trainings}
                              <span className="ml-1 text-2xs font-normal text-slate-400 dark:text-slate-500">
                                {cell.attendanceRate != null ? `${cell.attendanceRate}%` : ''}
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-900/20 px-4 py-2.5">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
        <p className="text-xs text-blue-800 dark:text-blue-200">{t('attHint')}</p>
      </div>
    </div>
  );
}
