'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Clock, Lock, Sparkles } from 'lucide-react';
import { usePlan } from '@/lib/plan/context';

/**
 * Avvisi del piano sopra ogni pagina della dashboard: giorni di prova
 * rimasti, prova scaduta (sola lettura), crediti AI oltre l'80%.
 *
 * Compare solo quando il piano e' applicato davvero (PLAN_ENFORCEMENT acceso
 * e account non storico): a interruttore spento la dashboard resta identica.
 */
export function PlanBanner() {
  const t = useTranslations('planBanner');
  const { plan } = usePlan();
  if (!plan || !plan.enforced) return null;

  const cta = (
    <Link
      href="/dashboard/billing"
      className="ml-auto shrink-0 rounded-lg bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-white dark:bg-slate-900/60 dark:text-slate-100"
    >
      {t('choosePlan')}
    </Link>
  );

  if (plan.mode === 'expired') {
    return (
      <div
        role="status"
        className="mx-3 mt-3 sm:mx-4 md:mx-6 md:mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
      >
        <Lock className="h-4 w-4 shrink-0" />
        <span>
          <strong className="font-semibold">{t('expiredTitle')}</strong> {t('expiredBody')}
        </span>
        {cta}
      </div>
    );
  }

  if (plan.mode === 'trial') {
    return (
      <div
        role="status"
        className="mx-3 mt-3 sm:mx-4 md:mx-6 md:mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200"
      >
        <Clock className="h-4 w-4 shrink-0" />
        <span>{t('trial', { days: plan.trialDaysLeft ?? 0 })}</span>
        {cta}
      </div>
    );
  }

  if (plan.usage.aiAlert) {
    return (
      <div
        role="status"
        className="mx-3 mt-3 sm:mx-4 md:mx-6 md:mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
      >
        <Sparkles className="h-4 w-4 shrink-0" />
        <span>{t('aiAlert', { used: plan.usage.aiCreditsUsed, limit: plan.limits.aiCredits })}</span>
        <Link
          href="/dashboard/billing"
          className="ml-auto shrink-0 text-xs font-semibold underline underline-offset-2"
        >
          {t('seeUsage')}
        </Link>
      </div>
    );
  }

  return null;
}
