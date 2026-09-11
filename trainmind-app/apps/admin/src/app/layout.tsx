import type { Metadata } from 'next';
import Link from 'next/link';
import { isDbConfigured } from '@/lib/db';
import './globals.css';

export const metadata: Metadata = {
  title: 'TrainMind — Console',
  description: 'Console di amministrazione della piattaforma TrainMind',
  robots: { index: false, follow: false },
};

/**
 * Ogni pagina interroga il database a ogni richiesta. Senza questo, Next
 * proverebbe a pre-renderizzarle al build — quando il database non esiste.
 */
export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/', label: 'Panoramica' },
  { href: '/acquisizione', label: 'Acquisizione' },
  { href: '/attivazione', label: 'Attivazione' },
  { href: '/utilizzo', label: 'Utilizzo' },
  { href: '/societa', label: 'Società' },
  { href: '/costi', label: 'Costi' },
  { href: '/contatti', label: 'Contatti' },
];

/**
 * Mostrata al posto di ogni pagina quando manca la connessione al database.
 *
 * E' un controllo esplicito e non un errore lasciato correre: in produzione
 * Next sostituisce i messaggi degli errori lato server con un codice numerico,
 * quindi chi apre la console vedrebbe una schermata di errore muta. Qui invece
 * legge cosa manca e dove sistemarlo.
 */
function ConfigurazioneMancante() {
  return (
    <div className="rounded-lg border border-warning-500/40 bg-warning-50 p-5">
      <h1 className="text-sm font-semibold text-warning-700">Configurazione incompleta</h1>
      <p className="mt-2 text-sm text-slate-700">
        Manca la variabile <code className="rounded bg-white px-1 py-0.5 text-xs">DATABASE_URL_READONLY</code>,
        con cui la console legge il database usando l&apos;utente dedicato in sola
        lettura.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
        <li>
          Creare l&apos;utente una volta sola con{' '}
          <code className="rounded bg-white px-1 py-0.5 text-xs">infra/sql/reporting-role.sql</code>.
        </li>
        <li>
          Aggiungere la stringa di connessione a{' '}
          <code className="rounded bg-white px-1 py-0.5 text-xs">.env.deploy</code>.
        </li>
        <li>
          Riavviare il servizio:{' '}
          <code className="rounded bg-white px-1 py-0.5 text-xs">dc up -d admin</code>.
        </li>
      </ol>
      <p className="mt-3 text-sm text-slate-600">
        La procedura completa e in{' '}
        <code className="rounded bg-white px-1 py-0.5 text-xs">documentation/GUIDA_CONSOLE_ADMIN.md</code>.
      </p>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="flex h-14 items-center justify-between">
                <div className="flex items-baseline gap-3">
                  <span className="text-sm font-semibold tracking-tight text-slate-900">
                    TrainMind
                  </span>
                  <span className="text-sm text-slate-400">Console</span>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
                  sola lettura
                </span>
              </div>
              <nav className="-mb-px flex gap-1 overflow-x-auto">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
            {isDbConfigured() ? children : <ConfigurazioneMancante />}
          </main>

          <footer className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
            <p className="border-t border-slate-200 pt-4 text-xs text-slate-400">
              Dati letti in sola lettura dal database di produzione. Nessun dato
              sanitario degli atleti viene mostrato in questa console.
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
