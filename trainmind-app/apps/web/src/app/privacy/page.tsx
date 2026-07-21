import Link from 'next/link';

export const metadata = {
  title: 'Informativa Privacy — TrainMind AI',
};

const VERSION = '2026-07-18-beta';

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-slate-800">
      <h1 className="mb-1 text-3xl font-bold text-slate-900">Informativa sulla Privacy</h1>
      <p className="mb-8 text-sm text-slate-500">
        Ai sensi degli artt. 13-14 del Regolamento (UE) 2016/679 (&quot;GDPR&quot;) — Versione {VERSION} — ultimo
        aggiornamento: 18 luglio 2026
      </p>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">1. Titolare del trattamento</h2>
          <p>
            <span className="font-medium">[RAGIONE SOCIALE / NOME DEL TITOLARE DEL SERVIZIO]</span>, contattabile
            all&apos;indirizzo email <span className="font-medium">[EMAIL DI CONTATTO]</span>, è il Titolare del
            trattamento per i dati degli <strong>account dei professionisti</strong> (preparatori, staff). Per i
            dati degli <strong>atleti</strong> gestiti tramite la piattaforma, il Titolare è l&apos;organizzazione
            sportiva che li inserisce; TrainMind AI opera come Responsabile del trattamento ex art. 28 GDPR (vedi{' '}
            <Link href="/terms" className="text-teal-700 underline">
              Termini di Servizio
            </Link>
            ).
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">2. Dati trattati e finalità</h2>
          <p>
            (a) <strong>Dati account</strong>: nome, cognome, email, password (conservata in forma cifrata),
            organizzazione di appartenenza — per la creazione e gestione dell&apos;account e l&apos;erogazione del
            servizio (base giuridica: contratto, art. 6.1.b). (b) <strong>Dati d&apos;uso tecnici</strong>: log,
            indirizzo IP al momento delle accettazioni — per sicurezza e prova delle accettazioni (legittimo
            interesse, art. 6.1.f). (c) <strong>Dati sportivi e sanitari degli atleti</strong> (anagrafica, test
            fisici, benessere quotidiano, infortuni e percorsi di rientro): trattati per conto
            dell&apos;organizzazione titolare; per i dati relativi alla salute è richiesto il{' '}
            <strong>consenso esplicito dell&apos;atleta</strong> (art. 9.2.a GDPR), raccolto al momento della
            registrazione all&apos;app atleti.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">3. Modalità, conservazione e sicurezza</h2>
          <p>
            I dati sono trattati con strumenti elettronici, su server ubicati nell&apos;Unione Europea, protetti da
            cifratura in transito (HTTPS), controllo degli accessi per ruolo e backup periodici. I dati sono
            conservati per la durata dell&apos;account e cancellati o anonimizzati alla sua chiusura, salvo obblighi
            di legge. Durante la fase di test la piattaforma può contenere dati fittizi di dimostrazione.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">4. Destinatari e sub-responsabili</h2>
          <p>
            I dati non sono venduti né ceduti. Possono accedervi fornitori tecnici strettamente necessari:
            hosting cloud nell&apos;UE (IONOS SE) e, per le funzioni di intelligenza artificiale, OpenAI (con
            trasferimento extra-UE assistito dalle garanzie di cui agli artt. 44 ss. GDPR — clausole contrattuali
            standard). Ai fornitori vengono inviati solo i dati minimi necessari alla funzione richiesta.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">5. Diritti degli interessati</h2>
          <p>
            In ogni momento è possibile esercitare i diritti di cui agli artt. 15-22 GDPR (accesso, rettifica,
            cancellazione, limitazione, portabilità, opposizione, revoca del consenso senza pregiudicare la
            liceità del trattamento precedente) scrivendo a{' '}
            <span className="font-medium">[EMAIL DI CONTATTO]</span>. Gli atleti possono rivolgersi anche alla
            propria organizzazione sportiva (Titolare). È fatto salvo il diritto di reclamo al Garante per la
            Protezione dei Dati Personali (www.garanteprivacy.it).
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">6. Minori</h2>
          <p>
            L&apos;app atleti è destinata a sportivi anche minorenni: per gli atleti di età inferiore a 14 anni la
            registrazione e i consensi devono essere effettuati o autorizzati da chi esercita la responsabilità
            genitoriale, come dichiarato in fase di registrazione.
          </p>
        </div>

        <p className="border-t border-slate-200 pt-6 text-xs text-slate-400">
          Documento in versione Beta, in attesa di revisione legale. La versione accettata/presa in visione da
          ciascun utente è registrata con data, ora e versione del documento.
        </p>
      </section>
    </div>
  );
}
