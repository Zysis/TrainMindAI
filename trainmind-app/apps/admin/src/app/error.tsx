'use client';

/**
 * Errore durante la lettura del database.
 *
 * Attenzione a cosa NON si puo' fare qui: in produzione Next sostituisce il
 * messaggio degli errori lato server con un codice numerico prima che arrivi
 * al browser, quindi `error.message` non dice nulla di utile. Il dettaglio
 * vero sta nei log del container, e questa pagina serve a dire dove cercarlo
 * e quali sono le due cause probabili.
 *
 * Il caso "variabile non impostata" non passa di qui: lo intercetta il layout
 * con un pannello che spiega la configurazione.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-lg border border-danger-500/30 bg-danger-50 p-5">
      <h1 className="text-sm font-semibold text-danger-700">Non riesco a leggere i dati</h1>

      <p className="mt-2 text-sm text-slate-700">
        La pagina interroga Postgres a ogni caricamento e la richiesta non è
        andata a buon fine. Le due cause frequenti:
      </p>

      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
        <li>
          il database non risponde — controlla che il container{' '}
          <code className="rounded bg-white px-1 py-0.5 text-xs">trainmind-postgres</code> sia in salute;
        </li>
        <li>
          l&apos;utente <code className="rounded bg-white px-1 py-0.5 text-xs">trainmind_reporting</code>{' '}
          non ha la SELECT su una tabella nuova: dopo una migrazione va rilanciata la
          GRANT di <code className="rounded bg-white px-1 py-0.5 text-xs">infra/sql/reporting-role.sql</code>.
        </li>
      </ul>

      <p className="mt-3 text-sm text-slate-700">
        Il messaggio completo è nei log:{' '}
        <code className="rounded bg-white px-1 py-0.5 text-xs">dc logs --tail=50 admin</code>
        {error.digest ? (
          <>
            {' '}— cerca il codice{' '}
            <code className="rounded bg-white px-1 py-0.5 text-xs">{error.digest}</code>.
          </>
        ) : (
          '.'
        )}
      </p>

      <button
        onClick={reset}
        className="mt-4 rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
      >
        Riprova
      </button>
    </div>
  );
}
