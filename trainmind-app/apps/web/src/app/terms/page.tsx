import Link from 'next/link';

export const metadata = {
  title: 'Termini di Servizio — TrainMind',
};

const VERSION = '2026-07-18-beta';

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-slate-800">
      <h1 className="mb-1 text-3xl font-bold text-slate-900">Termini di Servizio</h1>
      <p className="mb-8 text-sm text-slate-500">
        Versione {VERSION} — ultimo aggiornamento: 18 luglio 2026
      </p>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">1. Il servizio e la fase Beta</h2>
          <p>
            TrainMind (&quot;il Servizio&quot;) è una piattaforma per preparatori fisici nel basket che consente la
            gestione di squadre, atleti, allenamenti, test fisici, dati di benessere e infortuni.{' '}
            <strong>
              Il Servizio è attualmente in fase di test (Beta): è fornito &quot;così com&apos;è&quot;, senza garanzie di
              disponibilità, continuità o conservazione dei dati.
            </strong>{' '}
            Durante la Beta il Servizio è gratuito e ad accesso limitato; funzionalità e dati potrebbero essere
            modificati o azzerati con preavviso ragionevole.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">2. Account e responsabilità</h2>
          <p>
            La registrazione crea un&apos;organizzazione di cui l&apos;utente registrante è amministratore. L&apos;utente è
            responsabile della custodia delle credenziali, della veridicità dei dati forniti e dell&apos;uso del
            Servizio da parte degli utenti della propria organizzazione (collaboratori e atleti invitati). È
            vietato usare il Servizio per finalità illecite o caricare contenuti di terzi senza averne diritto.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">3. Ruoli privacy e trattamento dati (accordo ex art. 28 GDPR)</h2>
          <p>
            Per i dati personali degli atleti inseriti o raccolti tramite il Servizio (inclusi dati relativi alla
            salute quali benessere, infortuni e percorsi di rientro), il{' '}
            <strong>Titolare del trattamento è l&apos;organizzazione utilizzatrice</strong> (la società sportiva o il
            preparatore), mentre TrainMind agisce come <strong>Responsabile del trattamento</strong> ai sensi
            dell&apos;art. 28 GDPR. Accettando i presenti Termini, il Titolare incarica TrainMind di trattare tali
            dati esclusivamente per l&apos;erogazione del Servizio, secondo le istruzioni documentate impartite
            tramite l&apos;uso della piattaforma. TrainMind: (a) tratta i dati solo per erogare il Servizio; (b)
            adotta misure di sicurezza adeguate (cifratura in transito, controllo accessi, backup); (c) non
            comunica i dati a terzi salvo sub-responsabili tecnici necessari (hosting UE, servizi AI di cui
            all&apos;informativa); (d) assiste il Titolare nell&apos;evasione delle richieste degli interessati; (e) al
            termine del rapporto cancella o restituisce i dati. L&apos;organizzazione si impegna a informare i propri
            atleti e a raccogliere i consensi ove richiesti.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">4. Funzioni di intelligenza artificiale</h2>
          <p>
            Alcune funzioni utilizzano modelli di intelligenza artificiale per generare suggerimenti (es. piani di
            allenamento, analisi del benessere). I contenuti generati sono di supporto e{' '}
            <strong>non sostituiscono il giudizio professionale</strong> del preparatore né il parere medico. Le
            decisioni su allenamenti, carichi e rientri da infortunio restano di esclusiva responsabilità
            dell&apos;utente professionista.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">5. Limitazione di responsabilità</h2>
          <p>
            Nei limiti consentiti dalla legge, durante la fase Beta TrainMind non risponde di danni indiretti,
            perdita di dati o mancato guadagno derivanti dall&apos;uso o dall&apos;impossibilità di usare il Servizio. Nulla
            in questi Termini esclude la responsabilità per dolo o colpa grave.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">6. Durata, modifiche e recesso</h2>
          <p>
            L&apos;utente può cessare l&apos;uso del Servizio e chiedere la cancellazione dell&apos;account in qualsiasi
            momento. Potremo aggiornare questi Termini: le modifiche sostanziali saranno comunicate e richiederanno
            nuova accettazione. La versione accettata da ciascun utente è registrata con data e ora.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">7. Legge applicabile e contatti</h2>
          <p>
            I presenti Termini sono regolati dalla legge italiana. Per ogni comunicazione:{' '}
            <span className="font-medium">[RAGIONE SOCIALE / NOME DEL TITOLARE DEL SERVIZIO]</span> — email:{' '}
            <span className="font-medium">[EMAIL DI CONTATTO]</span>.
          </p>
        </div>

        <p className="border-t border-slate-200 pt-6 text-xs text-slate-400">
          Documento in versione Beta, in attesa di revisione legale. Vedi anche l&apos;{' '}
          <Link href="/privacy" className="text-teal-700 underline">
            Informativa Privacy
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
