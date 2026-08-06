'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { AuthShell } from '@/components/auth/auth-shell';

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations('auth');
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already authenticated
  if (isAuthenticated) {
    router.push('/dashboard');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <h2 className="mb-2 text-2xl font-bold text-slate-900">{t('login')}</h2>
      <p className="mb-8 text-sm text-slate-500">{t('loginSubtitle')}</p>

      {error && (
        <div className="mb-4 rounded-lg border border-danger-500/20 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="label mb-1.5 block">
            {t('email')}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')}
            className="input-field"
            required
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="password" className="label mb-1.5 block">
            {t('password')}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('passwordPlaceholder')}
            className="input-field"
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            {t('rememberMe')}
          </label>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-teal-700 hover:text-teal-600"
          >
            {t('forgotPassword')}
          </Link>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-teal-700 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? t('loggingIn') : t('login')}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        {t('noAccount')}{' '}
        <Link href="/register" className="font-medium text-teal-700 hover:text-teal-600">
          {t('register')}
        </Link>
      </p>
    </AuthShell>
  );
}
