'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { BrandLogo } from '@/components/brand/brand-logo';

export default function LoginPage() {
  const router = useRouter();
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
      setError(err instanceof Error ? err.message : 'Errore durante il login');
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

      {/* Right panel — login form */}
      <div className="flex w-full items-center justify-center px-8 lg:w-1/2">
        <div className="w-full max-w-sm">
          <h2 className="mb-2 text-2xl font-bold text-slate-900">Accedi</h2>
          <p className="mb-8 text-sm text-slate-500">Inserisci le tue credenziali per continuare</p>

          {error && (
            <div className="mb-4 rounded-lg border border-danger-500/20 bg-danger-50 px-4 py-3 text-sm text-danger-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="La tua password"
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
                Ricordami
              </label>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-teal-700 hover:text-teal-600"
              >
                Password dimenticata?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-teal-700 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Accesso in corso...' : 'Accedi'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Non hai un account?{' '}
            <Link
              href="/register"
              className="font-medium text-teal-700 hover:text-teal-600"
            >
              Registrati
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
