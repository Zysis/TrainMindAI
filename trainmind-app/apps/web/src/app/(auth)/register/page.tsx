'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { useLocaleStore } from '@/lib/i18n/store';
import { AuthShell } from '@/components/auth/auth-shell';

/* ─────────────────────────────────────────────────────────
 * Piani selezionabili in registrazione.
 * Gli id coincidono con i valori accettati dall'API, che li
 * traduce nel tier dell'organizzazione.
 * ───────────────────────────────────────────────────────── */
type PlanId = 'starter' | 'professional' | 'ultra';

const PLANS: Array<{ id: PlanId; labelKey: string; price: number }> = [
  { id: 'starter', labelKey: 'planStarter', price: 14 },
  { id: 'professional', labelKey: 'planProfessional', price: 21 },
  { id: 'ultra', labelKey: 'planUltra', price: 30 },
];

function isPlanId(v: string | null): v is PlanId {
  return v === 'starter' || v === 'professional' || v === 'ultra';
}

/**
 * `useSearchParams` obbliga a un confine di Suspense in build statica:
 * il form vero sta nel componente interno, la pagina lo avvolge.
 */
export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations('auth');
  const { register, isAuthenticated } = useAuth();
  const locale = useLocaleStore((s) => s.locale);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  // Piano: preselezionato da ?plan= (arriva dalle card della landing),
  // ma resta modificabile qui. Se il parametro manca o e' sconosciuto
  // si parte da Starter.
  const planFromUrl = params.get('plan');
  const [plan, setPlan] = useState<PlanId>(
    isPlanId(planFromUrl) ? planFromUrl : 'starter',
  );

  // Nessun consenso pre-flaggato (conforme al principio del consenso libero).
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [consentHealthData, setConsentHealthData] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(false);
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

    if (!acceptTerms || !acceptPrivacy) {
      setError(t('consentRequired'));
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        email,
        password,
        firstName,
        lastName,
        organizationName,
        dateOfBirth,
        plan,
        acceptTerms,
        acceptPrivacy,
        consentHealthData,
        acceptMarketing,
        // La lingua scelta qui diventa la lingua di default dell'account.
        uiLanguage: locale,
      });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('registerError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell wide>
      <h2 className="mb-1 text-2xl font-bold text-slate-900">{t('createAccount')}</h2>
      <p className="mb-6 text-sm text-slate-500">{t('registerSubtitle')}</p>

      {error && (
        <div className="mb-4 rounded-lg border border-danger-500/20 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Due colonne: i campi vanno a coppie, cosi' il modulo sta
            in una schermata sola. Sotto lg torna a colonna singola. */}
        <div className="grid gap-4 sm:grid-cols-2">
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
            <label htmlFor="dateOfBirth" className="label mb-1.5 block">
              {t('dateOfBirth')}
            </label>
            <input
              id="dateOfBirth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
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

          <div className="sm:col-span-2">
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
        </div>

        {/* ─── Piano ─────────────────────────────────────────
            Controllo segmentato invece di una tendina: mostra le tre
            opzioni e i prezzi tutti insieme, senza aprire nulla.
            Sono radio veri, quindi restano navigabili da tastiera. */}
        <fieldset disabled={isSubmitting}>
          <legend className="label mb-1.5 block">{t('planLabel')}</legend>
          <div className="grid grid-cols-3 gap-2">
            {PLANS.map((p) => {
              const active = plan === p.id;
              return (
                <label
                  key={p.id}
                  className={`flex cursor-pointer flex-col items-center rounded-lg border px-2 py-2.5 text-center transition-colors ${
                    active
                      ? 'border-teal-600 bg-teal-50 ring-1 ring-teal-600'
                      : 'border-slate-300 bg-white hover:border-slate-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="plan"
                    value={p.id}
                    checked={active}
                    onChange={() => setPlan(p.id)}
                    className="sr-only"
                  />
                  <span
                    className={`text-sm font-semibold ${
                      active ? 'text-teal-800' : 'text-slate-700'
                    }`}
                  >
                    {t(p.labelKey)}
                  </span>
                  <span
                    className={`text-xs ${active ? 'text-teal-700' : 'text-slate-500'}`}
                  >
                    &euro;{p.price}
                    {t('planPerMonth')}
                  </span>
                </label>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">{t('planHint')}</p>
        </fieldset>

        {/* ─── CONSENSI: nessuna checkbox pre-flaggata ─── */}
        <div className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('consentsTitle')}
          </p>

          <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-700">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              disabled={isSubmitting}
              required
            />
            <span>
              {t.rich('consentTerms', {
                link: (chunks) => (
                  <Link href="/terms" target="_blank" className="font-medium text-teal-700 underline">
                    {chunks}
                  </Link>
                ),
              })}{' '}
              <span className="text-danger-600">*</span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-700">
            <input
              type="checkbox"
              checked={acceptPrivacy}
              onChange={(e) => setAcceptPrivacy(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              disabled={isSubmitting}
              required
            />
            <span>
              {t.rich('consentPrivacy', {
                link: (chunks) => (
                  <Link
                    href="/privacy"
                    target="_blank"
                    className="font-medium text-teal-700 underline"
                  >
                    {chunks}
                  </Link>
                ),
              })}{' '}
              <span className="text-danger-600">*</span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-700">
            <input
              type="checkbox"
              checked={consentHealthData}
              onChange={(e) => setConsentHealthData(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              disabled={isSubmitting}
            />
            <span>
              {t.rich('consentHealth', {
                b: (chunks) => <strong>{chunks}</strong>,
              })}
            </span>
          </label>

          <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-700">
            <input
              type="checkbox"
              checked={acceptMarketing}
              onChange={(e) => setAcceptMarketing(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              disabled={isSubmitting}
            />
            <span>{t('consentMarketing')}</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            <span className="text-danger-600">*</span> {t('requiredFields')}
            <span className="mx-2 text-slate-300">·</span>
            {t('dateOfBirthHint')}
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !acceptTerms || !acceptPrivacy}
          className="w-full rounded-lg bg-teal-700 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? t('creating') : t('createAccount')}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        {t('hasAccount')}{' '}
        <Link href="/login" className="font-medium text-teal-700 hover:text-teal-600">
          {t('login')}
        </Link>
      </p>
    </AuthShell>
  );
}
