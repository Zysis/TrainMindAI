'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth-store';
import { LangSwitcher } from '@/components/i18n/lang-switcher';

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations('auth');
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const result = await login(email, password);
    if (result.success) {
      router.push('/home');
    } else {
      setError(result.error || t('loginError'));
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-teal-50 to-slate-50 px-4 dark:from-slate-950 dark:to-slate-900">
      {/* Selettore lingua: la scelta fatta qui diventa la lingua dell'app */}
      <div className="absolute right-4 top-4 z-50">
        <LangSwitcher />
      </div>

      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-600 text-2xl font-bold text-white shadow-lg">
          TM
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('appName')}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('areaLabel')}</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {error && (
          <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:bg-danger-700/20 dark:text-danger-500">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {t('email')}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            placeholder={t('emailPlaceholder')}
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {t('password')}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:opacity-50"
        >
          {isLoading ? t('loggingIn') : t('login')}
        </button>
      </form>

      <p className="mt-6 max-w-sm text-center text-xs text-slate-400 dark:text-slate-500">
        {t('noAccountHint')}
      </p>
    </div>
  );
}
