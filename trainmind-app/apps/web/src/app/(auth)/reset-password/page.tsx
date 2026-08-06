'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { resetPassword, verifyResetToken } from '@/lib/auth/api';
import { AuthShell } from '@/components/auth/auth-shell';

/** Stesse regole del backend (passwordField in schemas/auth.ts). */
const RULES = [
  { key: 'reset.rule8', test: (p: string) => p.length >= 8 },
  { key: 'reset.ruleUpper', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'reset.ruleNumber', test: (p: string) => /[0-9]/.test(p) },
] as const;

function ResetPasswordForm() {
  const router = useRouter();
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid' | 'done'>('checking');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Verifichiamo il token PRIMA di mostrare il form: inutile far compilare
  // la password all'utente per poi dirgli che il link e' scaduto.
  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setError(t('reset.noToken'));
      return;
    }
    verifyResetToken(token)
      .then((data) => {
        setMaskedEmail(data.email);
        setStatus('valid');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t('reset.invalidToken'));
        setStatus('invalid');
      });
  }, [token, t]);

  const allRulesOk = RULES.every((r) => r.test(password));
  const passwordsMatch = password.length > 0 && password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passwordsMatch) {
      setError(t('reset.mismatch'));
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(token, password);
      setStatus('done');
      // Piccola pausa per far leggere la conferma, poi al login.
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('reset.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'checking') {
    return <p className="text-sm text-slate-500">{t('reset.checking')}</p>;
  }

  if (status === 'invalid') {
    return (
      <>
        <h2 className="mb-2 text-2xl font-bold text-slate-900">{t('reset.invalidTitle')}</h2>
        <p className="mb-6 text-sm leading-relaxed text-slate-500">
          {error} {t('reset.invalidBody')}
        </p>
        <Link
          href="/forgot-password"
          className="block w-full rounded-lg bg-teal-700 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-teal-800"
        >
          {t('reset.requestNew')}
        </Link>
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium text-teal-700 hover:text-teal-600">
            {t('backToLogin')}
          </Link>
        </p>
      </>
    );
  }

  if (status === 'done') {
    return (
      <>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50">
          <svg
            className="h-6 w-6 text-teal-700"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="mb-2 text-2xl font-bold text-slate-900">{t('reset.doneTitle')}</h2>
        <p className="mb-6 text-sm text-slate-500">{t('reset.doneBody')}</p>
        <Link
          href="/login"
          className="block w-full rounded-lg bg-teal-700 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-teal-800"
        >
          {t('reset.goToLogin')}
        </Link>
      </>
    );
  }

  return (
    <>
      <h2 className="mb-2 text-2xl font-bold text-slate-900">{t('reset.title')}</h2>
      <p className="mb-8 text-sm text-slate-500">
        {t('reset.subtitle')} <strong className="text-slate-700">{maskedEmail}</strong>
      </p>

      {error && (
        <div className="mb-4 rounded-lg border border-danger-500/20 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="label mb-1.5 block">
            {t('reset.newPassword')}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
            required
            autoFocus
            disabled={isSubmitting}
          />
        </div>

        <ul className="space-y-1">
          {RULES.map((rule) => {
            const ok = rule.test(password);
            return (
              <li
                key={rule.key}
                className={`flex items-center gap-2 text-xs ${ok ? 'text-teal-700' : 'text-slate-400'}`}
              >
                <span aria-hidden="true">{ok ? '✓' : '○'}</span>
                {t(rule.key)}
              </li>
            );
          })}
        </ul>

        <div>
          <label htmlFor="confirm" className="label mb-1.5 block">
            {t('reset.confirmPassword')}
          </label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input-field"
            required
            disabled={isSubmitting}
          />
          {confirm.length > 0 && !passwordsMatch && (
            <p className="mt-1.5 text-xs text-danger-700">{t('reset.mismatch')}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !allRulesOk || !passwordsMatch}
          className="w-full rounded-lg bg-teal-700 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? t('reset.saving') : t('reset.submit')}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/login" className="font-medium text-teal-700 hover:text-teal-600">
          {t('backToLogin')}
        </Link>
      </p>
    </>
  );
}

function ResetPasswordFallback() {
  const t = useTranslations('auth');
  return <p className="text-sm text-slate-500">{t('reset.loading')}</p>;
}

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      {/* useSearchParams richiede un confine di Suspense in App Router */}
      <Suspense fallback={<ResetPasswordFallback />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
