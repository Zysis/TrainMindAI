'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { BrandLogo } from '@/components/brand/brand-logo';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
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
      setError('La password deve contenere almeno 8 caratteri');
      return;
    }

    if (password !== confirmPassword) {
      setError('Le password non corrispondono');
      return;
    }

    if (!acceptTerms) {
      setError('Per registrarti devi accettare i Termini di Servizio');
      return;
    }

    setIsSubmitting(true);

    try {
      await register({ email, password, firstName, lastName, organizationName, acceptTerms });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante la registrazione');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden w-1/2 items-center justify-center bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 lg:flex">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/20 backdrop-blur-sm">
            <BrandLogo tone="dark" className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-bold text-white">
            Train<span className="text-teal-400">Mind</span> AI
          </h1>
          <p className="mt-3 text-teal-200/70">
            La piattaforma intelligente per preparatori fisici nel basket
          </p>
        </div>
      </div>

      {/* Right panel — registration form */}
      <div className="flex w-full items-center justify-center px-8 lg:w-1/2">
        <div className="w-full max-w-sm">
          <h2 className="mb-2 text-2xl font-bold text-slate-900">Crea Account</h2>
          <p className="mb-8 text-sm text-slate-500">Inserisci i tuoi dati per registrarti</p>

          {error && (
            <div className="mb-4 rounded-lg border border-danger-500/20 bg-danger-50 px-4 py-3 text-sm text-danger-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="firstName" className="label mb-1.5 block">
                Nome
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Il tuo nome"
                className="input-field"
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="lastName" className="label mb-1.5 block">
                Cognome
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Il tuo cognome"
                className="input-field"
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="email" className="label mb-1.5 block">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@squadra.com"
                className="input-field"
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="password" className="label mb-1.5 block">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimo 8 caratteri"
                className="input-field"
                required
                minLength={8}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label mb-1.5 block">
                Conferma Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ripeti la password"
                className="input-field"
                required
                minLength={8}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="organizationName" className="label mb-1.5 block">
                Nome Organizzazione
              </label>
              <input
                id="organizationName"
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="La tua squadra o organizzazione"
                className="input-field"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="flex items-start gap-2 pt-1">
              <input
                id="acceptTerms"
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                disabled={isSubmitting}
              />
              <label htmlFor="acceptTerms" className="text-xs leading-relaxed text-slate-600">
                Ho letto e accetto i{' '}
                <Link href="/terms" target="_blank" className="font-medium text-teal-700 underline hover:text-teal-600">
                  Termini di Servizio
                </Link>{' '}
                (incluso l&apos;accordo sul trattamento dei dati degli atleti)
              </label>
            </div>

            <p className="text-xs leading-relaxed text-slate-500">
              Proseguendo dichiari di aver preso visione dell&apos;{' '}
              <Link href="/privacy" target="_blank" className="font-medium text-teal-700 underline hover:text-teal-600">
                Informativa Privacy
              </Link>
              .
            </p>

            <button
              type="submit"
              disabled={isSubmitting || !acceptTerms}
              className="w-full rounded-lg bg-teal-700 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Creazione in corso...' : 'Crea Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Hai già un account?{' '}
            <Link
              href="/login"
              className="font-medium text-teal-700 hover:text-teal-600"
            >
              Accedi
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
