'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { requestPasswordReset } from '@/lib/auth/api';
import { AuthShell } from '@/components/auth/auth-shell';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await requestPasswordReset(email);
      // Mostriamo la conferma anche se l'email non esiste: il server risponde
      // in modo identico nei due casi, per non rivelare quali account esistono.
      setSentTo(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('forgot.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell>
      {sentTo ? (
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-slate-900">{t('forgot.sentTitle')}</h2>
          <p className="mb-6 text-sm leading-relaxed text-slate-500">
            {t.rich('forgot.sentBody', {
              email: sentTo,
              b: (chunks) => <strong className="text-slate-700">{chunks}</strong>,
            })}
          </p>
          <p className="mb-6 text-xs text-slate-400">{t('forgot.spamHint')}</p>
          <button
            onClick={() => {
              setSentTo(null);
              setEmail('');
            }}
            className="w-full rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            {t('forgot.otherEmail')}
          </button>
        </>
      ) : (
        <>
          <h2 className="mb-2 text-2xl font-bold text-slate-900">{t('forgot.title')}</h2>
          <p className="mb-8 text-sm text-slate-500">{t('forgot.subtitle')}</p>

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
                autoFocus
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-teal-700 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? t('forgot.sending') : t('forgot.submit')}
            </button>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/login" className="font-medium text-teal-700 hover:text-teal-600">
          {t('backToLogin')}
        </Link>
      </p>
    </AuthShell>
  );
}
