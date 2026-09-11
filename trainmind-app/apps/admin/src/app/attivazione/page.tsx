import Link from 'next/link';
import { Badge, Card, Empty, Kpi, PageHeader, Table, TierBadge } from '@/components/ui';
import { HBars } from '@/components/charts';
import { fmtDate, fmtNum, fmtPct } from '@/lib/format';
import { getActivationFunnel, getStalledOrgs } from '@/lib/queries/activation';

export default async function Page() {
  const [funnel, stalled] = await Promise.all([getActivationFunnel(), getStalledOrgs()]);

  const athleteStep = funnel.steps.find((s) => s.key === 'athlete');

  return (
    <>
      <PageHeader
        title="Attivazione"
        subtitle="Che cosa fanno le società nei primi sette giorni. Chi si è iscritto da meno di una settimana non è conteggiato: non ha ancora avuto il tempo."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Società valutabili" value={fmtNum(funnel.eligible)} hint="iscritte da oltre 7 giorni" />
        <Kpi
          label="Ha aggiunto un atleta"
          value={athleteStep ? fmtPct(athleteStep.pct) : '—'}
          hint="il passo che separa chi prova da chi usa"
        />
        <Kpi label="Mai partite" value={fmtNum(stalled.length)} hint="nessun atleta in anagrafica" />
        <Kpi
          label="Tasso di partenza"
          value={
            funnel.eligible === 0
              ? '—'
              : fmtPct(((funnel.eligible - stalled.length) / funnel.eligible) * 100)
          }
        />
      </div>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
        <Card
          title="Imbuto dei primi sette giorni"
          hint="Percentuale di società che ha compiuto il passo entro una settimana dall'iscrizione"
        >
          {funnel.eligible === 0 ? (
            <Empty>Nessuna società iscritta da più di sette giorni.</Empty>
          ) : (
            <HBars
              rows={funnel.steps.map((s) => ({
                label: s.label,
                value: Math.round(s.pct),
                hint: `(${s.count})`,
              }))}
              suffix="%"
            />
          )}
        </Card>

        <Card
          title="Come leggerlo"
          hint="I passi non sono in cascata stretta: una società può saltarne uno"
        >
          <ul className="space-y-2.5 text-sm text-slate-600">
            <li>
              <strong className="text-slate-900">Squadra e atleta</strong> sono i due
              gesti dell&apos;impostazione iniziale. Chi si ferma prima non ha mai
              davvero aperto il prodotto.
            </li>
            <li>
              <strong className="text-slate-900">Sessione e wellness</strong> segnano il
              passaggio all&apos;uso quotidiano: sono i primi dati che entrano da soli.
            </li>
            <li>
              <strong className="text-slate-900">Invito</strong> è il passo che porta gli
              atleti dentro la piattaforma, è l&apos;unico che si propaga da solo.
            </li>
          </ul>
        </Card>
      </div>

      <div className="mt-4">
        <Card
          title="Società da richiamare"
          hint="Iscritte da oltre sette giorni, nessun atleta mai inserito. È l'unica lista di questa console pensata per essere agita."
        >
          {stalled.length === 0 ? (
            <Empty>Nessuna: tutte le società hanno almeno un atleta.</Empty>
          ) : (
            <Table head={['Società', 'Piano', 'Iscritta il', 'Squadre', 'Atleti']}>
              {stalled.map((o) => (
                <tr key={o.id}>
                  <td className="px-3 py-2">
                    <Link href={`/societa/${o.id}`} className="text-teal-700 hover:underline">
                      {o.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <TierBadge tier={o.tier} />
                  </td>
                  <td className="px-3 py-2 text-slate-600">{fmtDate(o.createdAt)}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-900">{o.teams}</td>
                  <td className="px-3 py-2">
                    <Badge tone="warning">0</Badge>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
