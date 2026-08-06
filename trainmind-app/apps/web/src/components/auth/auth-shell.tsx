'use client';

import { useTranslations } from 'next-intl';
import { BrandLogo } from '@/components/brand/brand-logo';
import { LangSwitcher } from '@/components/i18n/lang-switcher';

/**
 * Layout comune alle pagine di autenticazione: pannello brand a sinistra,
 * contenuto a destra e selettore lingua sempre raggiungibile in alto a destra.
 *
 * Il selettore scrive sullo store globale, lo stesso usato dalla landing:
 * arrivando su /login da "Accedi" la lingua risulta gia' quella scelta.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('auth');

  return (
    <div className="relative flex min-h-screen">
      {/* Selettore lingua — sopra a tutto, anche sul pannello scuro */}
      <div className="absolute right-4 top-4 z-50">
        <LangSwitcher />
      </div>

      {/* Pannello brand */}
      <div className="hidden w-1/2 items-center justify-center bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 lg:flex">
        <div className="max-w-md px-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/20 backdrop-blur-sm">
            <BrandLogo tone="dark" className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-bold text-white">
            Train<span className="text-teal-400">Mind</span> AI
          </h1>
          <p className="mt-3 text-teal-200/70">{t('tagline')}</p>
        </div>
      </div>

      {/* Contenuto */}
      <div className="flex w-full items-center justify-center px-8 py-8 lg:w-1/2">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
