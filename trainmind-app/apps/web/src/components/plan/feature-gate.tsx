'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Lock, ArrowUpRight } from 'lucide-react';
import { useFeatureAvailable, type PlanFeature } from '@/lib/plan/context';

/**
 * Mostra la pagina solo se la funzione e' nel piano. Altrimenti, al posto
 * della pagina, una scheda che dice cosa sblocca il piano superiore.
 *
 * Non sostituisce il controllo dell'API (che risponde comunque 402): evita
 * solo di aprire una pagina che poi mostrerebbe errori a ogni riquadro.
 * Finche' il piano non e' applicato, o non e' ancora stato letto, mostra la
 * pagina com'e' sempre stata.
 */
export function FeatureGate({ feature, children }: { feature: PlanFeature; children: ReactNode }) {
  const available = useFeatureAvailable(feature);
  const t = useTranslations('planGate');
  if (available) return <>{children}</>;

  return (
    <div className="mx-auto mt-10 max-w-xl">
      <div className="card text-center dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
          <Lock className="h-6 w-6 text-amber-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t(`${feature}.title`)}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t(`${feature}.body`)}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('availableFrom', { feature })}</p>
        <Link
          href="/dashboard/billing"
          className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
        >
          {t('cta')}
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
