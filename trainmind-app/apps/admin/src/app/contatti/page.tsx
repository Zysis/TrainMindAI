import { Card, Empty, Kpi, PageHeader, Table, TierBadge } from '@/components/ui';
import { fmtDate, fmtLocale, fmtNum } from '@/lib/format';
import { getConsentSummary, listMarketingContacts } from '@/lib/queries/contacts';

const DOC_LABEL: Record<string, string> = {
  TERMS: 'Termini di servizio',
  PRIVACY_ACK: 'Informativa privacy',
  PRIVACY_ATHLETE_ACK: 'Informativa atleti',
  HEALTH_DATA: 'Dati sanitari (art. 9)',
  AGE_DECLARATION: 'Dichiarazione di età',
  MARKETING: 'Marketing',
  COOKIES: 'Cookie',
};

export default async function Page() {
  const [contacts, consents] = await Promise.all([listMarketingContacts(), getConsentSummary()]);

  return (
    <>
      <PageHeader
        title="Contatti"
        subtitle="L'unica pagina della console in cui compaiono nomi ed email, e solo di chi ha acconsentito."
      />

      <div className="mb-6 rounded-lg border border-slate-300 bg-white p-4">
        <p className="text-sm text-slate-700">
          Entrano qui solo gli utenti con un consenso <strong>MARKETING</strong> registrato
          e <strong>non revocato</strong>, attivi e non cancellati. Chi revoca sparisce da
          questo elenco nello stesso istante, senza che nessuno debba ricordarsene.
          L&apos;esportazione è un trattamento di dati personali: il file che ne esce va
          conservato di conseguenza.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Contatti utilizzabili" value={fmtNum(contacts.length)} />
        {consents
          .filter((c) => ['MARKETING', 'HEALTH_DATA', 'TERMS'].includes(c.docType))
          .map((c) => (
            <Kpi
              key={c.docType}
              label={DOC_LABEL[c.docType] ?? c.docType}
              value={fmtNum(c.granted)}
              hint={c.revoked > 0 ? `${c.revoked} revocati` : 'nessuna revoca'}
            />
          ))}
      </div>

      <div className="mt-6">
        <Card
          title="Elenco contatti"
          hint="Ordinati dal consenso più recente"
        >
          <div className="mb-4">
            <a
              href="/contatti/csv"
              className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
            >
              Scarica CSV
            </a>
          </div>

          {contacts.length === 0 ? (
            <Empty>Nessun contatto ha acconsentito al marketing.</Empty>
          ) : (
            <Table head={['Nome', 'Email', 'Società', 'Piano', 'Lingua', 'Consenso del', 'Versione']}>
              {contacts.map((c) => (
                <tr key={c.email}>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-900">
                    {c.firstName} {c.lastName}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{c.email}</td>
                  <td className="px-3 py-2 text-slate-600">{c.organization}</td>
                  <td className="px-3 py-2"><TierBadge tier={c.tier} /></td>
                  <td className="px-3 py-2 text-slate-600">{fmtLocale(c.locale)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmtDate(c.consentedAt)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{c.docVersion}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>

      <div className="mt-4">
        <Card title="Tutti i consensi registrati" hint="Conteggio per tipo di documento, senza nomi">
          <Table head={['Documento', 'Attivi', 'Revocati']}>
            {consents.map((c) => (
              <tr key={c.docType}>
                <td className="px-3 py-2 text-slate-900">{DOC_LABEL[c.docType] ?? c.docType}</td>
                <td className="px-3 py-2 tabular-nums text-slate-900">{c.granted}</td>
                <td className="px-3 py-2 tabular-nums text-slate-900">{c.revoked}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}
