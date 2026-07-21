'use client';

import { useState, useEffect, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, setToken, setRefreshToken } from '@/lib/api';

interface InviteInfo {
  email: string;
  athleteName: string;
  organizationName: string;
  organizationLogo?: string;
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptHealthData, setAcceptHealthData] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Link di invito non valido. Chiedi al tuo preparatore un nuovo invito.');
      setLoading(false);
      return;
    }

    api.validateInvite(token).then((res: { success: boolean; data?: InviteInfo; error?: { message: string } }) => {
      if (res.success && res.data) {
        setInviteInfo(res.data);
      } else {
        setError(res.error?.message || 'Invito non valido o scaduto');
      }
      setLoading(false);
    });
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La password deve essere di almeno 8 caratteri');
      return;
    }
    if (password !== confirmPassword) {
      setError('Le password non coincidono');
      return;
    }
    if (!acceptTerms || !acceptHealthData || !ageConfirmed) {
      setError('Per completare la registrazione devi confermare tutte le caselle qui sotto');
      return;
    }

    setSubmitting(true);
    const res = await api.register(token, password, { acceptTerms, acceptHealthData, ageConfirmed }) as {
      success: boolean;
      data?: { accessToken: string; refreshToken: string };
      error?: { message: string };
    };

    if (res.success && res.data) {
      setToken(res.data.accessToken);
      setRefreshToken(res.data.refreshToken);
      router.push('/home');
    } else {
      setError(res.error?.message || 'Errore durante la registrazione');
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  if (!inviteInfo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="rounded-2xl bg-danger-50 p-6 text-center dark:bg-danger-700/20">
          <p className="text-danger-700 dark:text-danger-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-teal-50 to-slate-50 px-4 dark:from-slate-950 dark:to-slate-900">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-600 text-white text-2xl font-bold shadow-lg">
          TM
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Benvenuto, {inviteInfo.athleteName}!
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {inviteInfo.organizationName} ti ha invitato
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {error && (
          <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
          <input
            type="email"
            value={inviteInfo.email}
            disabled
            className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Crea password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            placeholder="Minimo 8 caratteri"
          />
        </div>

        <div>
          <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Conferma password
          </label>
          <input
            id="confirm"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            placeholder="Ripeti password"
          />
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span>
              Accetto i{' '}
              <a href="https://app.trainmind-app.com/terms" target="_blank" rel="noreferrer" className="font-medium text-teal-600 underline">
                Termini di Servizio
              </a>{' '}
              e dichiaro di aver letto l&apos;{' '}
              <a href="/privacy" target="_blank" className="font-medium text-teal-600 underline">
                Informativa Privacy per gli Atleti
              </a>
            </span>
          </label>

          <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={acceptHealthData}
              onChange={(e) => setAcceptHealthData(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span>
              Acconsento espressamente al trattamento dei miei <strong>dati relativi alla salute</strong>{' '}
              (benessere, infortuni, recupero) per le finalità indicate nell&apos;informativa (art. 9.2.a GDPR)
            </span>
          </label>

          <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span>
              Dichiaro di avere almeno 14 anni, oppure che questa registrazione e i relativi consensi sono
              effettuati/autorizzati da chi esercita la responsabilità genitoriale
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting || !acceptTerms || !acceptHealthData || !ageConfirmed}
          className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
        >
          {submitting ? 'Creazione account...' : 'Crea account'}
        </button>
      </form>
    </div>
  );
}

// useSearchParams() richiede un confine Suspense per il prerender di produzione
export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
