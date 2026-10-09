'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowUpRight, Info } from 'lucide-react';
import { usePlan } from '@/lib/plan/context';
import { useAuth } from '@/hooks/use-auth';

/**
 * Avviso "limite raggiunto" con la strada per superarlo: le estensioni per
 * Ultra e Club (squadra in piu', pacchetto da 5 atleti), il piano superiore
 * per gli altri. Compare solo con il piano applicato e solo quando il limite
 * e' davvero raggiunto; il controllo vero resta quello dell'API.
 */
export function PlanLimitNotice({ kind, teamId }: { kind: 'teams' | 'athletes'; teamId?: string }) {
  const { plan } = usePlan();
  const { user } = useAuth();
  const t = useTranslations('planLimit');
  if (!plan?.enforced || plan.readOnly) return null;

  const ext = plan.catalog.extensions;
  let testo: string;
  if (kind === 'teams') {
    if (plan.usage.teams < plan.limits.teams) return null;
    testo = t('teamsFull', { limit: plan.limits.teams });
  } else {
    const tm = plan.usage.perTeam.find((x) => x.id === teamId);
    if (!tm || tm.athletes < tm.capacity) return null;
    testo = t('athletesFull', { used: tm.athletes, limit: tm.capacity });
  }

  const estendibile = plan.extensionsAllowed && plan.mode === 'active';
  const consiglio = estendibile
    ? kind === 'teams'
      ? t('teamsExtend', { monthly: ext.team.monthly, credits: ext.team.aiCredits })
      : t('athletesExtend', { size: ext.athletePack.size, monthly: ext.athletePack.monthly })
    : t('upgrade');
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
      <Info className="h-4 w-4 flex-shrink-0 text-amber-600" />
      <p className="min-w-0 flex-1 text-slate-700 dark:text-slate-300">
        <span className="font-semibold">{testo}</span> {consiglio}
        {!isAdmin && ` ${t('askAdmin')}`}
      </p>
      {isAdmin && (
        <Link
          href={estendibile ? '/dashboard/billing#estensioni' : '/dashboard/billing'}
          className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
        >
          {estendibile ? t('ctaExtend') : t('ctaUpgrade')}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
