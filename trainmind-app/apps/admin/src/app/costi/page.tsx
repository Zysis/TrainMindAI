import Link from 'next/link';
import { Badge, Card, Empty, Kpi, NotYet, PageHeader, Table, TierBadge } from '@/components/ui';
import { HBars, MonthlyBars } from '@/components/charts';
import { fmtMonth, fmtNum, fmtUsd } from '@/lib/format';
import { getAiCostByMonth, getAiCostByOperation, getAiCostByOrg } from '@/lib/queries/costs';

const OP_LABEL: Record<string, string> = {
  CHAT: 'Chat',
  COACH: 'AI Coach',
  GENERATE: 'Generazione piani',
  WELLNESS: 'Analisi wellness',
  RTP: 'Return to play',
  REPORT: 'Report',
};

export default async function Page() {
  const [byMonth, byOperation, byOrg] = await Promise.all([
    getAiCostByMonth(),
    getAiCostByOperation(),
    getAiCostByOrg(),
  ]);

  const current = byMonth[byMonth.length - 1];
  const previous = byMonth[byMonth.length - 2];
  const total12 = byMonth.reduce((sum, m) => sum + m.cost, 0);

  return (
    <>
      <PageHeader
        title="Costi"
        subtitle="Quanto costa far girare l'intelligenza artificiale, società per società."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Mese in corso" value={fmtUsd(current?.cost ?? 0)} hint={`${fmtNum(current?.calls ?? 0)} chiamate`} />
        <Kpi label="Mese precedente" value={fmtUsd(previous?.cost ?? 0)} />
        <Kpi label="Ultimi 12 mesi" value={fmtUsd(total12)} />
        <Kpi label="Token nel mese" value={fmtNum(current?.tokens ?? 0)} />
      </div>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-3">
        <Card title="Costo AI per mese" hint="Somma dei costi stimati al momento della chiamata" className="lg:col-span-2">
          {byMonth.some((m) => m.cost > 0) ? (
            <MonthlyBars
              data={byMonth.map((m) => ({
                label: fmtMonth(m.month),
                // Il grafico ragiona in centesimi: importi come 0,004 $ sarebbero
                // barre invisibili, e il tooltip mostra comunque il valore.
                value: Math.round(m.cost * 100) / 100,
              }))}
              unit="USD"
            />
          ) : (
            <Empty>Nessun consumo AI registrato negli ultimi 12 mesi.</Empty>
          )}
        </Card>

        <Card title="Per tipo di operazione" hint="Ultimi 90 giorni, in centesimi di dollaro">
          {byOperation.length === 0 ? (
            <Empty>Nessuna chiamata registrata.</Empty>
          ) : (
            <HBars
              rows={byOperation.map((o) => ({
                label: OP_LABEL[o.operation] ?? o.operation,
                value: Math.round(o.cost * 100),
                hint: `(${o.calls} chiamate)`,
              }))}
              suffix="¢"
            />
          )}
        </Card>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        <Card title="Società più onerose" className="lg:col-span-2">
          {byOrg.length === 0 ? (
            <Empty>Nessun consumo AI registrato.</Empty>
          ) : (
            <Table head={['Società', 'Piano', 'Costo', 'Chiamate', 'Errori']}>
              {byOrg.map((o) => (
                <tr key={o.id}>
                  <td className="px-3 py-2">
                    <Link href={`/societa/${o.id}`} className="text-teal-700 hover:underline">
                      {o.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2"><TierBadge tier={o.tier} /></td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-900">{fmtUsd(o.cost)}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-900">{fmtNum(o.calls)}</td>
                  <td className="px-3 py-2">
                    {o.errors > 0 ? <Badge tone="danger">{o.errors}</Badge> : <span className="text-slate-400">—</span>}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <NotYet title="Margine per cliente">
          Il costo lo sappiamo, il ricavo no: senza Stripe collegato non c&apos;è un
          incasso da mettere accanto a queste cifre. Quando le chiavi live saranno
          in produzione, questa colonna diventa il margine reale per società — ed è
          la sola metrica che dice se un piano regge il proprio consumo di AI.
        </NotYet>
      </div>
    </>
  );
}
