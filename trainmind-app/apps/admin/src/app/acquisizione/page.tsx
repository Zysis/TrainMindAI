import { Card, Empty, Kpi, PageHeader, Table } from '@/components/ui';
import { HBars, MonthlyBars } from '@/components/charts';
import { fmtLocale, fmtMonth, fmtNum, fmtPct, fmtTier } from '@/lib/format';
import {
  getCampaigns,
  getMarketingOptIn,
  getReferrers,
  getSignupLanguages,
  getSignupsByDay,
  getSignupsByTierMonth,
  getSourceBreakdown,
} from '@/lib/queries/acquisition';
import { getSignupsByMonth } from '@/lib/queries/overview';

export default async function Page() {
  const [byDay, byMonth, byTierMonth, languages, optIn, sources, campaigns, referrers] =
    await Promise.all([
      getSignupsByDay(90),
      getSignupsByMonth(),
      getSignupsByTierMonth(),
      getSignupLanguages(),
      getMarketingOptIn(),
      getSourceBreakdown(),
      getCampaigns(),
      getReferrers(),
    ]);

  const last30 = byDay.slice(-30).reduce((sum, d) => sum + d.count, 0);
  const prev30 = byDay.slice(-60, -30).reduce((sum, d) => sum + d.count, 0);
  const delta = prev30 === 0 ? null : ((last30 - prev30) / prev30) * 100;

  // Griglia mese × piano: i mesi sulle righe, i tre piani sulle colonne.
  const months = Array.from(new Set(byTierMonth.map((r) => r.month))).sort();
  const tiers = ['STARTER', 'PROFESSIONAL', 'ULTRA'];
  const grid = new Map(byTierMonth.map((r) => [`${r.month}|${r.tier}`, r.count]));

  return (
    <>
      <PageHeader
        title="Acquisizione"
        subtitle="Quante società si iscrivono, con che piano e in che lingua."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Ultimi 30 giorni" value={fmtNum(last30)} hint="nuove società" />
        <Kpi label="30 giorni precedenti" value={fmtNum(prev30)} />
        <Kpi
          label="Variazione"
          value={delta === null ? '—' : `${delta > 0 ? '+' : ''}${Math.round(delta)}%`}
          hint={delta === null ? 'nessuna base di confronto' : 'sul periodo precedente'}
        />
        <Kpi
          label="Consenso marketing"
          value={optIn.total === 0 ? '—' : fmtPct((optIn.granted / optIn.total) * 100)}
          hint={`${optIn.granted} su ${optIn.total} titolari`}
        />
      </div>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-3">
        <Card title="Iscrizioni per mese" hint="Ultimi 12 mesi" className="lg:col-span-2">
          <MonthlyBars
            data={byMonth.map((m) => ({ label: fmtMonth(m.month), value: m.count }))}
            unit="società"
          />
        </Card>

        <Card
          title="Lingua alla registrazione"
          hint="Presa dal consenso ai Termini: è il dato più vicino alla provenienza che abbiamo"
        >
          <HBars rows={languages.map((l) => ({ label: fmtLocale(l.language), value: l.count }))} />
        </Card>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <Card title="Mix dei piani nel tempo" hint="Piano scelto in registrazione, per mese">
          {months.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Nessun dato.</p>
          ) : (
            <Table head={['Mese', ...tiers.map((t) => fmtTier(t))]}>
              {months.map((m) => (
                <tr key={m}>
                  <td className="px-3 py-2 text-slate-700">{fmtMonth(m)}</td>
                  {tiers.map((t) => (
                    <td key={t} className="px-3 py-2 tabular-nums text-slate-900">
                      {grid.get(`${m}|${t}`) ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card
          title="Da dove arrivano"
          hint="Sorgente dichiarata dai parametri di campagna al momento dell'iscrizione"
        >
          {sources.length === 0 ? (
            <Empty>Nessuna società registrata.</Empty>
          ) : (
            <HBars
              rows={sources.map((s) => ({ label: s.source, value: s.count }))}
            />
          )}
          <p className="mt-4 text-xs text-slate-500">
            <strong className="text-slate-700">Da altri siti</strong> sono le iscrizioni
            senza parametri di campagna ma con un referrer noto: le trovi in dettaglio
            qui sotto. <strong className="text-slate-700">Diretto o non tracciato</strong>{' '}
            è chi non porta né parametri né referrer: indirizzo digitato a mano, un
            messaggio, una mail, un QR.{' '}
            <strong className="text-slate-700">Prima del tracciamento</strong> sono le
            iscrizioni antecedenti al 4 settembre 2026, quando la provenienza non veniva
            ancora osservata: quelle non sono ricostruibili, e tenerle separate evita di
            scambiare un buco nella misurazione per traffico diretto.
          </p>
        </Card>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <Card title="Campagne" hint="Sorgente, mezzo e campagna delle iscrizioni tracciate">
          {campaigns.length === 0 ? (
            <Empty>
              Nessuna iscrizione con parametri di campagna. Compariranno qui appena una
              societa si registrera da un link che li porta.
            </Empty>
          ) : (
            <Table head={['Sorgente', 'Mezzo', 'Campagna', 'Iscrizioni']}>
              {campaigns.map((c, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-slate-900">{c.source}</td>
                  <td className="px-3 py-2 text-slate-600">{c.medium}</td>
                  <td className="px-3 py-2 text-slate-600">{c.campaign}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-900">{c.count}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card
          title="Siti che portano iscrizioni"
          hint="Provenienze senza campagna: passaparola, articoli, forum"
        >
          {referrers.length === 0 ? (
            <Empty>Nessuna iscrizione arrivata da un altro sito.</Empty>
          ) : (
            <HBars rows={referrers.map((r) => ({ label: r.host, value: r.count }))} />
          )}
        </Card>
      </div>
    </>
  );
}
