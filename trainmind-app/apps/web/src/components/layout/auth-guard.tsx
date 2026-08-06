'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { ATHLETE_APP_URL, STAFF_ROLES } from '@/lib/constants';

/**
 * Protegge la dashboard dei preparatori.
 *
 * Oltre all'autenticazione verifica il RUOLO: questa applicazione mostra i dati
 * di tutti gli atleti dell'organizzazione (anagrafiche, wellness, infortuni),
 * quindi non deve essere accessibile a chi ha ruolo ATHLETE — che dispone di
 * un'app dedicata.
 *
 * Questo controllo e' solo il primo strato, quello che evita di caricare
 * un'interfaccia piena di errori 403. Il blocco che conta e' lato API, nel
 * decoratore `authenticate` di `apps/api/src/plugins/auth.ts`: senza quello,
 * basterebbe una chiamata diretta al backend per aggirare l'interfaccia.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const router = useRouter();

  const isStaff = !!user && (STAFF_ROLES as readonly string[]).includes(user.role);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Utente autenticato ma senza i permessi per quest'area.
  // Mostriamo una schermata esplicita invece di un redirect automatico: se
  // l'app atleti rimandasse indietro, un redirect creerebbe un ciclo, e
  // l'utente non capirebbe cosa sta succedendo.
  if (!isStaff) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 dark:bg-slate-900">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-900/20">
            <svg
              className="h-7 w-7 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          </div>

          <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">
            Area riservata allo staff tecnico
          </h1>
          <p className="mb-6 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Il tuo account e registrato come atleta. Questa dashboard e destinata a
            preparatori e staff medico: per i tuoi allenamenti e il questionario wellness
            usa l&apos;app TrainMind Athlete.
          </p>

          <a
            href={ATHLETE_APP_URL}
            className="block w-full rounded-lg bg-teal-700 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
          >
            Vai all&apos;app atleti
          </a>

          <button
            onClick={() => logout()}
            className="mt-3 w-full rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Esci
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
