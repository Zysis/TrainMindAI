'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Activity, ShieldAlert } from 'lucide-react';
import { apiFetch } from '@/lib/auth/fetch';
import { useApiError } from '@/lib/i18n/api-error';
import { Badge } from '@/components/ui/badge';
import {
  SEVERITY_LABEL_KEYS, SEVERITY_COLORS,
  PHASE_LABEL_KEYS, PHASE_COLORS,
  injuryTypeLabelKey, bodyLocationLabelKey,
} from '@/lib/constants/injuries';

interface RtpProtocol {
  id: string;
  currentPhase: string;
  startDate: string;
  targetDate: string | null;
  _count: { phaseLogs: number; criteria: number };
}

interface Injury {
  id: string;
  type: string;
  onset: string | null;
  location: string;
  severity: number;
  status: 'ACTIVE' | 'RECOVERING' | 'RESOLVED';
  dateOccurred: string;
  dateResolved: string | null;
  notes: string | null;
  rtpProtocols: RtpProtocol[];
}

const STATUS_TONE: Record<string, 'danger' | 'warning' | 'success'> = {
  ACTIVE: 'danger',
  RECOVERING: 'warning',
  RESOLVED: 'success',
};

// Mappe esplicite invece di chiavi costruite a runtime: `t(\`status${x}\`)`
// compila benissimo e poi stampa "injuries.statusActive" a video, e nessuno
// scanner se ne accorge.
const STATUS_LABEL_KEYS: Record<string, string> = {
  ACTIVE: 'injStatusActive',
  RECOVERING: 'injStatusRecovering',
  RESOLVED: 'injStatusResolved',
};

const ONSET_LABEL_KEYS: Record<string, string> = {
  contusive: 'onsetContusive',
  overuse: 'onsetOveruse',
  traumatic: 'onsetTraumatic',
  non_traumatic: 'onsetNonTraumatic',
};

export function AthleteInjuriesTab({ athleteId }: { athleteId: string }) {
  const t = useTranslations('injuries');
  const tAth = useTranslations('athletes');
  const locale = useLocale();
  const apiError = useApiError();

  const [injuries, setInjuries] = useState<Injury[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: { injuries: Injury[] } }>(`/athletes/${athleteId}/injuries`);
      setInjuries(res.data.injuries || []);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId]);

  useEffect(() => { load(); }, [load]);

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  /** Giorni di stop: fino alla guarigione, o a oggi se ancora aperto. */
  const daysOut = (inj: Injury) => {
    const from = new Date(inj.dateOccurred).getTime();
    const to = inj.dateResolved ? new Date(inj.dateResolved).getTime() : Date.now();
    return Math.max(0, Math.round((to - from) / 86400000));
  };

  const typeLabel = (v: string) => {
    const k = injuryTypeLabelKey(v);
    return k ? t(k) : v;
  };
  // Le sedi non standard sono testo libero legittimo: si mostrano com'e'.
  const locationLabel = (v: string) => {
    const k = bodyLocationLabelKey(v);
    return k ? t(k) : v;
  };

  if (loading) {
    return (
      <div className="card flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }
  if (error) {
    return <div className="card py-10 text-center text-sm text-red-600">{error}</div>;
  }
  if (!injuries || injuries.length === 0) {
    return (
      <div className="card flex h-48 items-center justify-center">
        <div className="text-center">
          <ShieldAlert className="mx-auto mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400 dark:text-slate-500">{tAth('noInjuriesRecorded')}</p>
        </div>
      </div>
    );
  }

  const open = injuries.filter((i) => i.status !== 'RESOLVED').length;
  const totalDaysOut = injuries.reduce((n, i) => n + daysOut(i), 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <div className="card py-3">
          <p className="text-2xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{tAth('injTotal')}</p>
          <p className="mt-0.5 text-xl font-bold text-slate-900 dark:text-white">{injuries.length}</p>
        </div>
        <div className="card py-3">
          <p className="text-2xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{tAth('injOpen')}</p>
          <p className={`mt-0.5 text-xl font-bold ${open > 0 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>{open}</p>
        </div>
        <div className="card py-3">
          <p className="text-2xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{tAth('injDaysOut')}</p>
          <p className="mt-0.5 text-xl font-bold text-slate-900 dark:text-white">{totalDaysOut}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{tAth('injDaysOutHint')}</p>
        </div>
      </div>

      <div className="space-y-2">
        {injuries.map((inj) => (
          <div key={inj.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold text-slate-900 dark:text-white">
                    {typeLabel(inj.type)} — {locationLabel(inj.location)}
                  </h4>
                  <Badge variant={STATUS_TONE[inj.status] ?? 'default'}>
                    {STATUS_LABEL_KEYS[inj.status] ? tAth(STATUS_LABEL_KEYS[inj.status]) : inj.status}
                  </Badge>
                  <span className={`text-xs font-medium ${SEVERITY_COLORS[inj.severity] ?? ''}`}>
                    {t(SEVERITY_LABEL_KEYS[inj.severity] ?? '')}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {fmt(inj.dateOccurred)}
                  {inj.dateResolved ? ` → ${fmt(inj.dateResolved)}` : ` → ${tAth('injStillOpen')}`}
                  {' · '}
                  {tAth('injNDays', { n: daysOut(inj) })}
                  {inj.onset && ONSET_LABEL_KEYS[inj.onset] && ` · ${t(ONSET_LABEL_KEYS[inj.onset])}`}
                </p>
                {inj.notes && (
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{inj.notes}</p>
                )}
              </div>
            </div>

            {inj.rtpProtocols.length > 0 && (
              <div className="mt-3 border-t border-slate-100 dark:border-slate-700 pt-3 space-y-1.5">
                {inj.rtpProtocols.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <Activity className="h-3.5 w-3.5 text-slate-400" />
                    <span className={`rounded-full border px-2 py-0.5 font-medium ${PHASE_COLORS[p.currentPhase] ?? ''}`}>
                      {t(PHASE_LABEL_KEYS[p.currentPhase] ?? p.currentPhase)}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {tAth('rtpFrom', { date: fmt(p.startDate) })}
                      {p.targetDate && ` · ${tAth('rtpTarget', { date: fmt(p.targetDate) })}`}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500">
                      {tAth('rtpCounts', { logs: p._count.phaseLogs, criteria: p._count.criteria })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
