'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { AuthShell } from '@/components/auth/auth-shell';

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations('auth');
  const { register, isAuthenticated } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
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

    if (password.length < 8) {
      setError(t('passwordMinLength'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }

    setIsSubmitting(true);

    try {
      await register({ email, password, firstName, lastName, organizationName });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('registerError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <h2 className="mb-2 text-2xl font-bold text-slate-900">{t('createAccount')}</h2>
      <p className="mb-8 text-sm text-slate-500">{t('registerSubtitle')}</p>

      {error && (
        <div className="mb-4 rounded-lg border border-danger-500/20 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="firstName" className="label mb-1.5 block">
            {t('firstName')}
          </label>
          <input
            id="firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder={t('firstNamePlaceholder')}
            className="input-field"
            required
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="lastName" className="label mb-1.5 block">
            {t('lastName')}
          </label>
          <input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder={t('lastNamePlaceholder')}
            className="input-field"
            required
            disabled={isSubmitting}
          />
        </div>

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
            placeholder={t('passwordHint')}
            className="input-field"
            required
            minLength={8}
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="label mb-1.5 block">
            {t('confirmPassword')}
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t('confirmPasswordPlaceholder')}
            className="input-field"
            required
            minLength={8}
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="organizationName" className="label mb-1.5 block">
            {t('organizationName')}
          </label>
          <input
            id="organizationName"
            type="text"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            placeholder={t('orgPlaceholder')}
            className="input-field"
            required
            disabled={isSubmitting}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-teal-700 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? t('creating') : t('createAccount')}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        {t('hasAccount')}{' '}
        <Link href="/login" className="font-medium text-teal-700 hover:text-teal-600">
          {t('login')}
        </Link>
      </p>
    </AuthShell>
  );
}
