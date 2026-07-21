export const metadata = {
  title: 'Informativa Privacy — TrainMind Atleti',
};

const VERSION = '2026-07-18-beta';

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-10 text-slate-800">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Informativa Privacy per gli Atleti</h1>
      <p className="mb-8 text-sm text-slate-500">
        Ai sensi degli artt. 13-14 GDPR — Versione {VERSION} — 18 luglio 2026
      </p>

      <section className="space-y-5 text-sm leading-relaxed">
        <p>
          Questa app ti è stata proposta dalla tua società sportiva / dal tuo preparatore, che è il{' '}
          <strong>Titolare del trattamento</strong> dei tuoi dati. TrainMind AI (
          <span className="font-medium">[RAGIONE SOCIALE / NOME DEL TITOLARE DEL SERVIZIO]</span>, email{' '}
          <span className="font-medium">[EMAIL DI CONTATTO]</span>) gestisce la piattaforma come{' '}
          <strong>Responsabile del trattamento</strong> (art. 28 GDPR).
        </p>

        <div>
          <h2 className="mb-1 font-semibold text-slate-900">Quali dati raccogliamo</h2>
          <p>
            Dati anagrafici e sportivi (nome, data di nascita, ruolo, misure), risultati dei test fisici, e i dati
            che inserisci tu stesso nell&apos;app: <strong>benessere quotidiano</strong> (sonno, fatica, dolori
            muscolari, stress, umore, eventuali note e foto) e informazioni su <strong>infortuni e recupero</strong>.
            Alcuni di questi sono <strong>dati relativi alla salute</strong>: per trattarli è necessario il tuo{' '}
            <strong>consenso esplicito</strong> (art. 9.2.a GDPR), che ti chiediamo al momento della registrazione e
            che puoi revocare in ogni momento.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold text-slate-900">Perché li usiamo e chi li vede</h2>
          <p>
            I dati servono al tuo staff tecnico per pianificare gli allenamenti, monitorare il tuo stato di forma e
            gestire in sicurezza i rientri da infortunio. Li vedono solo il tuo staff (secondo i ruoli configurati)
            e i fornitori tecnici strettamente necessari (hosting nell&apos;UE; funzioni AI con invio dei soli dati
            minimi). Non vengono venduti né usati per pubblicità.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold text-slate-900">Se hai meno di 14 anni</h2>
          <p>
            La registrazione e i consensi devono essere effettuati o autorizzati da un tuo genitore (o da chi
            esercita la responsabilità genitoriale). In fase di registrazione viene richiesta questa conferma.
          </p>
        </div>

        <div>
          <h2 className="mb-1 font-semibold text-slate-900">I tuoi diritti</h2>
          <p>
            Puoi chiedere accesso, copia, rettifica o cancellazione dei tuoi dati, e revocare il consenso in
            qualsiasi momento, scrivendo alla tua società sportiva o a{' '}
            <span className="font-medium">[EMAIL DI CONTATTO]</span>. Puoi inoltre presentare reclamo al Garante
            Privacy (www.garanteprivacy.it). I dati sono conservati finché il tuo account è attivo, su server
            nell&apos;Unione Europea, protetti da cifratura e controllo degli accessi.
          </p>
        </div>

        <p className="border-t border-slate-200 pt-5 text-xs text-slate-400">
          Documento in versione Beta, in attesa di revisione legale. Le accettazioni sono registrate con data, ora
          e versione.
        </p>
      </section>
    </div>
  );
}
