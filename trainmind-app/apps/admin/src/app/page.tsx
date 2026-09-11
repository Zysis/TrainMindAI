import { Card, Empty, Kpi, NotYet, PageHeader } from '@/components/ui';
import { HBars, MonthlyBars } from '@/components/charts';
import { fmtLocale, fmtMonth, fmtNum, fmtTier, fmtUsd } from '@/lib/format';
import {
  getLocaleBreakdown,
  getOverview,
  getSignupsByMonth,
  getTierBreakdown,
} from '@/lib/queries/overview';
import { getSourceBreakdown } from '@/lib/queries/acquisition';

export default async function Page() {
  const [overview, byMonth, byTier, byLocale, sources] = await Promise.all([
    getOverview(),
    getSignupsByMonth(),
    getTierBreakdown(),
    getLocaleBreakdown(),
    getSourceBreakdown(),
  ]);

  const activePct =
    overview.orgs === 0 ? 0 : Math.round((overview.orgsActive30 / overview.orgs) * 100);

  return (
    <>
      <PageHeader
        title="Panoramica"
        subtitle={
          overview.demoOrgs === 1
            ? 'Stato della piattaforma. Un\u2019organizzazione di prova è esclusa da tutti i numeri.'
            : `Stato della piattaforma. ${overview.demoOrgs} organizzazioni di prova sono escluse da tutti i numeri.`
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Società" value={fmtNum(overview.orgs)} hint={`${overview.orgsNew30} nuove in 30 giorni`} />
        <Kpi
          label="Attive"
          value={fmtNum(overview.orgsActive30)}
          hint={`${activePct}% del totale, ultimi 30 giorni`}
        />
        <Kpi label="Utenti staff" value={fmtNum(overview.staffUsers)} hint={`${overview.athleteAccounts} account atleta`} />
        <Kpi label="Atleti in anagrafica" value={fmtNum(overview.athletes)} hint={`${overview.teams} squadre`} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Nuove questa settimana" value={fmtNum(overview.orgsNew7)} />
        <Kpi label="Costo AI 30 giorni" value={fmtUsd(overview.aiCost30)} />
        <Kpi
          label="Media atleti per società"
          value={overview.orgs === 0 ? '—' : (overview.athletes / overview.orgs).toFixed(1).replace('.', ',')}
        />
        <Kpi
          label="Costo AI per società attiva"
          value={overview.orgsActive30 === 0 ? '—' : fmtUsd(overview.aiCost30 / overview.orgsActive30)}
        />
      </div>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-3">
        <Card
          title="Nuove società per mese"
          hint="Ultimi 12 mesi, conteggio delle organizzazioni create"
          className="lg:col-span-2"
        >
          {byMonth.some((m) => m.count > 0) ? (
            <MonthlyBars
              data={byMonth.map((m) => ({ label: fmtMonth(m.month), value: m.count }))}
              unit="società"
            />
          ) : (
            <p className="py-12 text-center text-sm text-slate-400">
              Nessuna iscrizione negli ultimi 12 mesi.
            </p>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Piano scelto" hint="Dichiarato in registrazione, non ancora pagato">
            <HBars
              colored
              rows={byTier.map((t) => ({ label: fmtTier(t.tier), value: t.count }))}
            />
          </Card>

          <Card title="Lingua dell'account">
            <HBars
              rows={byLocale.map((l) => ({ label: fmtLocale(l.locale), value: l.count }))}
            />
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <NotYet title="Ricavi e abbonamenti">
          Stripe non è ancora collegato in produzione: <code>STRIPE_SECRET_KEY</code> è
          vuota nel file di ambiente del server, quindi nessuna registrazione passa
          da un pagamento. Finché resta così, il piano che vedi qui sopra è una
          dichiarazione dell&apos;utente e non un incasso, e MRR, churn e conversione
          non sono calcolabili.
        </NotYet>

        <Card
          title="Provenienza degli iscritti"
          hint="Dal 4 settembre 2026 ogni iscrizione registra la sorgente da cui arriva"
        >
          {sources.length === 0 ? (
            <Empty>Nessuna società registrata.</Empty>
          ) : (
            <HBars rows={sources.map((s) => ({ label: s.source, value: s.count }))} />
          )}
        </Card>
      </div>
    </>
  );
}
