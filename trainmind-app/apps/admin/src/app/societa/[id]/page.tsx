import { notFound } from 'next/navigation';
import { BackLink, Badge, Card, Kpi, Table, TierBadge } from '@/components/ui';
import { fmtAgo, fmtDate, fmtDateTime, fmtLocale, fmtNum, fmtUsd } from '@/lib/format';
import { getOrgDetail } from '@/lib/queries/orgs';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Amministratore',
  TRAINER: 'Preparatore',
  MEDICAL: 'Staff medico',
  VIEWER: 'Osservatore',
};

export default async function Page({ params }: { params: { id: string } }) {
  const org = await getOrgDetail(params.id);
  if (!org) notFound();

  return (
    <>
      <div className="mb-4">
        <BackLink href="/societa">&larr; Tutte le società</BackLink>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{org.name}</h1>
        <TierBadge tier={org.tier} />
        {org.isDemo ? <Badge tone="warning">account di prova</Badge> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Iscritta il" value={fmtDate(org.createdAt)} />
        <Kpi label="Ultima attività" value={fmtAgo(org.lastSeen)} hint={org.lastSeen ? fmtDateTime(org.lastSeen) : 'mai vista'} />
        <Kpi label="Utenti staff" value={fmtNum(org.users)} hint={`${org.athleteAccounts} account atleta`} />
        <Kpi label="Costo AI totale" value={fmtUsd(org.aiCost)} hint={`${fmtNum(org.aiCalls)} chiamate`} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Squadre" value={fmtNum(org.teams)} />
        <Kpi label="Atleti" value={fmtNum(org.athletes)} />
        <Kpi label="Sessioni svolte o pianificate" value={fmtNum(org.sessions)} />
        <Kpi label="Rilevazioni wellness" value={fmtNum(org.wellnessLogs)} hint="solo il conteggio" />
      </div>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
        <Card title="Composizione dello staff" hint="Per ruolo, senza nomi: qui serve capire com'è fatto l'account">
          <Table head={['Ruolo', 'Lingua', 'Creato', 'Ultimo accesso', 'Marketing']}>
            {org.members.map((m, i) => (
              <tr key={i}>
                <td className="px-3 py-2 text-slate-900">{ROLE_LABEL[m.role] ?? m.role}</td>
                <td className="px-3 py-2 text-slate-600">{fmtLocale(m.locale)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmtDate(m.createdAt)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmtAgo(m.lastLoginAt)}</td>
                <td className="px-3 py-2">
                  {m.marketing ? <Badge tone="teal">si</Badge> : <span className="text-slate-400">—</span>}
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        <div className="space-y-4">
          <Card title="App atleti">
            <div className="grid grid-cols-2 gap-3">
              <Kpi label="Inviti spediti" value={fmtNum(org.invitesSent)} />
              <Kpi label="Accettati" value={fmtNum(org.invitesAccepted)} />
            </div>
          </Card>

          <Card title="Provenienza">
            {org.utmSource || org.signupReferrer ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Sorgente</dt>
                  <dd className="text-slate-900">{org.utmSource ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Mezzo</dt>
                  <dd className="text-slate-900">{org.utmMedium ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Campagna</dt>
                  <dd className="text-slate-900">{org.utmCampaign ?? '—'}</dd>
                </div>
                {org.signupReferrer ? (
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-slate-500">Arrivata da</dt>
                    <dd className="break-all text-right text-xs text-slate-600">
                      {org.signupReferrer}
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="text-sm text-slate-500">
                {new Date(org.createdAt) < new Date('2026-09-04T00:00:00Z')
                  ? 'Iscritta prima del 4 settembre 2026, quando la provenienza non veniva ancora registrata. Non è ricostruibile.'
                  : 'Nessun parametro di campagna: indirizzo digitato a mano, oppure arrivata da un canale che non li porta.'}
              </p>
            )}
          </Card>

          <Card title="Abbonamento">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Piano dichiarato</dt>
                <dd className="text-slate-900">{org.tier}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Stato Stripe</dt>
                <dd className="text-slate-900">{org.subscriptionStatus ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Identificativo</dt>
                <dd className="font-mono text-xs text-slate-500">{org.slug}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-slate-500">
              Stripe non è collegato in produzione: lo stato qui sopra è il valore di
              partenza, non un pagamento verificato.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
