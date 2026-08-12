'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { User, Building2, Bell, Shield, Palette, Sun, Moon, Sparkles, ArrowUpRight } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { useLocaleStore, LOCALES, localeLabels, localeFlags } from '@/lib/i18n/store';
import { useEffect, useState } from 'react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { PLAN_FULL_NAME, tierToPlanKey, tierToPlanSlug } from '@/components/brand/plan';
import { ChangePasswordCard } from '@/components/settings/change-password-card';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const t = useTranslations('settings');
  const { locale, setLocale } = useLocaleStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const planKey = tierToPlanKey(user?.organization?.tier);
  const planSlug = tierToPlanSlug(user?.organization?.tier);
  const planName = planKey ? PLAN_FULL_NAME[planKey] : null;
  const isUltra = planKey === 'ULTRA';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Piano corrente */}
          {planKey && (
            <div className="card relative overflow-hidden dark:bg-slate-800 dark:border-slate-700">
              <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-900 dark:bg-slate-900">
                    <BrandLogo tone="dark" plan={planKey} className="h-10 w-10" />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Piano corrente
                      </span>
                      <span
                        className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-amber-500"
                      >
                        {planSlug}
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                      {planName}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {isUltra
                        ? 'Sei sul piano top — nessun limite, supporto prioritario incluso.'
                        : 'Sblocca più squadre, atleti e funzionalità avanzate passando al piano superiore.'}
                    </p>
                  </div>
                </div>

                {isUltra ? (
                  <div className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="h-3.5 w-3.5" />
                    Piano top
                  </div>
                ) : (
                  <Link
                    href="/dashboard/billing"
                    className="group inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/20 transition hover:shadow-xl hover:shadow-amber-500/30"
                  >
                    Aggiorna piano
                    <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Profile */}
          <div className="card dark:bg-slate-800 dark:border-slate-700">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <User className="h-5 w-5 text-teal-600" />
              {t('profile')}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label mb-1.5 block dark:text-slate-300">{t('firstName')}</label>
                <input type="text" defaultValue={user?.firstName || ''} className="input-field dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
              </div>
              <div>
                <label className="label mb-1.5 block dark:text-slate-300">{t('lastName')}</label>
                <input type="text" defaultValue={user?.lastName || ''} className="input-field dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
              </div>
              <div className="col-span-2">
                <label className="label mb-1.5 block dark:text-slate-300">{t('email')}</label>
                <input type="email" defaultValue={user?.email || ''} className="input-field dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400" disabled />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                {t('saveChanges')}
              </button>
            </div>
          </div>

          {/* Organization */}
          <div className="card dark:bg-slate-800 dark:border-slate-700">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <Building2 className="h-5 w-5 text-teal-600" />
              {t('organization')}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label mb-1.5 block dark:text-slate-300">{t('orgName')}</label>
                <input type="text" defaultValue={user?.organization?.name || ''} className="input-field dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
              </div>
              <div>
                <label className="label mb-1.5 block dark:text-slate-300">{t('sport')}</label>
                <input type="text" defaultValue="Basketball" className="input-field dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400" disabled />
              </div>
            </div>
          </div>

          {/* Password */}
          <ChangePasswordCard />

          {/* Appearance — Theme */}
          <div className="card dark:bg-slate-800 dark:border-slate-700">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <Palette className="h-5 w-5 text-teal-600" />
              {t('appearance')}
            </h2>

            {/* Theme Toggle */}
            <div className="mb-6">
              <label className="label mb-1.5 block dark:text-slate-300">{t('theme')}</label>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{t('themeDesc')}</p>
              {mounted && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                      theme === 'light'
                        ? 'border-teal-600 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Sun className="h-5 w-5" />
                    {t('themeLight')}
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                      theme === 'dark'
                        ? 'border-teal-600 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Moon className="h-5 w-5" />
                    {t('themeDark')}
                  </button>
                </div>
              )}
            </div>

            {/* Language Selector */}
            <div>
              <label className="label mb-1.5 block dark:text-slate-300">{t('language')}</label>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{t('languageDesc')}</p>
              <div className="flex gap-3">
                {/* LOCALES invece di una lista scritta qui: l'ordine segue
                    quello dello switcher, con la lingua di default per prima. */}
                {LOCALES.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => setLocale(loc)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                      locale === loc
                        ? 'border-teal-600 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="text-lg">{localeFlags[loc]}</span>
                    {localeLabels[loc]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card cursor-pointer transition-colors hover:border-teal-200 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-teal-600">
            <Bell className="mb-2 h-5 w-5 text-teal-600" />
            <h3 className="font-semibold text-slate-900 dark:text-white">{t('notifications')}</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('notificationsDesc')}</p>
          </div>
          <div className="card cursor-pointer transition-colors hover:border-teal-200 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-teal-600">
            <Shield className="mb-2 h-5 w-5 text-teal-600" />
            <h3 className="font-semibold text-slate-900 dark:text-white">{t('security')}</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('securityDesc')}</p>
          </div>

          <button
            onClick={() => logout()}
            className="w-full rounded-lg border border-danger-500/30 bg-danger-50 py-2.5 text-sm font-semibold text-danger-700 transition-colors hover:bg-danger-500 hover:text-white dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white"
          >
            {t('logout')}
          </button>
        </div>
      </div>
    </div>
  );
}
