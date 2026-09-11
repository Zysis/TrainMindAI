import { Card, Empty, Kpi, PageHeader, Table } from '@/components/ui';
import { HBars, Trend } from '@/components/charts';
import { fmtMonth, fmtNum, fmtPct } from '@/lib/format';
import {
  getCohorts,
  getDau,
  getInviteFunnel,
  getRollingActive,
  getTopResources,
} from '@/lib/queries/usage';

const RESOURCE_LABEL: Record<string, string> = {
  athlete: 'Atleti',
  wellness_log: 'Wellness',
  injury: 'Infortuni',
  rtp_protocol: 'Return to play',
  metric: 'Test e metriche',
  report: 'Report',
  athlete_invite: 'Inviti atleta',
  gdpr: 'Richieste GDPR',
};

function short(day: string): string {
  const d = new Date(day);
  return Number.isNaN(d.getTime()) ? day : `${d.getDate()}/${d.getMonth() + 1}`;
}

export default async function Page() {
  const [dau, wau, mau, resources, invites, cohorts] = await Promise.all([
    getDau(30),
    getRollingActive(7, 30),
    getRollingActive(30, 30),
    getTopResources(),
    getInviteFunnel(),
    getCohorts(),
  ]);

  const last = <T extends { value: number }>(series: T[]) => series[series.length - 1]?.value ?? 0;
  const acceptRate = invites.sent === 0 ? null : (invites.accepted / invites.sent) * 100;

  return (
    <>
      <PageHeader
        title="Utilizzo"
        subtitle="Chi usa davvero la piattaforma, e quanto."
      />

      <div className="mb-6 rounded-lg border border-warning-500/30 bg-warning-50 p-4">
        <p className="text-sm text-slate-700">
          <strong className="text-warning-700">Questi numeri sono una stima per difetto.</strong>{' '}
          L&apos;unico registro storico di attività è <code>audit_logs</code>, che traccia
          solo gli endpoint su dati personali o sanitari: atleti, wellness, infortuni,
          return to play, test, report, inviti. Chi passa la giornata sul calendario,
          sugli esercizi o in periodizzazione non lascia traccia e qui non compare.
          La Fase 2 aggiunge un campo di ultima attività e li rende veri.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Attivi al giorno" hint={`Oggi: ${fmtNum(last(dau))} utenti`}>
          <Trend data={dau.map((d) => ({ label: short(d.day), value: d.value }))} />
        </Card>
        <Card title="Attivi in 7 giorni" hint={`Oggi: ${fmtNum(last(wau))} utenti`}>
          <Trend data={wau.map((d) => ({ label: short(d.day), value: d.value }))} />
        </Card>
        <Card title="Attivi in 30 giorni" hint={`Oggi: ${fmtNum(last(mau))} utenti`}>
          <Trend data={mau.map((d) => ({ label: short(d.day), value: d.value }))} />
        </Card>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <Card title="Aree più usate" hint="Accessi tracciati negli ultimi 30 giorni">
          {resources.length === 0 ? (
            <Empty>Nessun accesso tracciato negli ultimi 30 giorni.</Empty>
          ) : (
            <HBars
              rows={resources.map((r) => ({
                label: RESOURCE_LABEL[r.resource] ?? r.resource,
                value: r.count,
              }))}
            />
          )}
        </Card>

        <Card
          title="Adozione dell'app atleti"
          hint="Inviti spediti dai preparatori e loro esito"
        >
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Inviti spediti" value={fmtNum(invites.sent)} />
            <Kpi
              label="Accettati"
              value={acceptRate === null ? '—' : fmtPct(acceptRate)}
              hint={`${invites.accepted} atleti dentro`}
            />
            <Kpi label="In attesa" value={fmtNum(invites.pending)} />
            <Kpi
              label="Società che invitano"
              value={fmtNum(invites.orgsInviting)}
              hint="almeno un invito spedito"
            />
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card
          title="Sopravvivenza per mese di iscrizione"
          hint="Delle società iscritte in quel mese, quante hanno dato segno di vita negli ultimi 30 giorni"
        >
          {cohorts.length === 0 ? (
            <Empty>Nessuna società registrata.</Empty>
          ) : (
            <>
              <Table head={['Mese di iscrizione', 'Società', 'Ancora attive', 'Quota']}>
                {cohorts.map((c) => (
                  <tr key={c.month}>
                    <td className="px-3 py-2 text-slate-700">{fmtMonth(c.month)}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-900">{c.size}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-900">{c.active}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-900">{fmtPct(c.pct)}</td>
                  </tr>
                ))}
              </Table>
              <p className="mt-3 text-xs text-slate-500">
                Non è la retention a settimana 1, 4 e 12 degli strumenti di prodotto:
                quella richiede lo storico completo delle sessioni, che oggi non
                esiste. Questa è la versione che i dati attuali permettono senza
                inventare nulla.
              </p>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
