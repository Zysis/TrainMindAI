'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { changePassword } from '@/lib/auth/api';

/** Stesse regole del backend (passwordField in schemas/auth.ts). */
const RULES = [
  { key: 'ruleLength', test: (p: string) => p.length >= 8 },
  { key: 'ruleUppercase', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'ruleNumber', test: (p: string) => /[0-9]/.test(p) },
] as const;

export function ChangePasswordCard() {
  const router = useRouter();
  const t = useTranslations('settings.password');
  const [isOpen, setIsOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allRulesOk = RULES.every((r) => r.test(newPassword));
  const passwordsMatch = newPassword.length > 0 && newPassword === confirm;

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirm('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!passwordsMatch) {
      setError(t('mismatch'));
      return;
    }

    setIsSubmitting(true);
    try {
      const message = await changePassword(currentPassword, newPassword);
      setSuccess(message);
      reset();
      setIsOpen(false);
      // Il backend ha invalidato la sessione: rimandiamo al login.
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('genericError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card dark:bg-slate-800 dark:border-slate-700">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
        <KeyRound className="h-5 w-5 text-teal-600" />
        {t('title')}
      </h2>

      {success && (
        <div className="mb-4 rounded-lg border border-teal-500/20 bg-teal-50 px-4 py-3 text-sm text-teal-800 dark:bg-teal-900/20 dark:text-teal-300">
          {success}
        </div>
      )}

      {!isOpen ? (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('intro')}
          </p>
          <button
            onClick={() => {
              setIsOpen(true);
              setSuccess('');
            }}
            className="flex-shrink-0 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {t('changeCta')}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-danger-500/20 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="currentPassword" className="label mb-1.5 block dark:text-slate-300">
              {t('current')}
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input-field dark:bg-slate-700 dark:border-slate-600 dark:text-white"
              required
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="label mb-1.5 block dark:text-slate-300">
              {t('new')}
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input-field dark:bg-slate-700 dark:border-slate-600 dark:text-white"
              required
              disabled={isSubmitting}
            />
          </div>

          <ul className="space-y-1">
            {RULES.map((rule) => {
              const ok = rule.test(newPassword);
              return (
                <li
                  key={rule.key}
                  className={`flex items-center gap-2 text-xs ${
                    ok ? 'text-teal-700 dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <span aria-hidden="true">{ok ? '✓' : '○'}</span>
                  {t(rule.key)}
                </li>
              );
            })}
          </ul>

          <div>
            <label htmlFor="confirmPassword" className="label mb-1.5 block dark:text-slate-300">
              {t('confirm')}
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input-field dark:bg-slate-700 dark:border-slate-600 dark:text-white"
              required
              disabled={isSubmitting}
            />
            {confirm.length > 0 && !passwordsMatch && (
              <p className="mt-1.5 text-xs text-danger-700 dark:text-red-400">
                {t('mismatch')}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting || !allRulesOk || !passwordsMatch || !currentPassword}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? t('saving') : t('save')}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                reset();
              }}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
