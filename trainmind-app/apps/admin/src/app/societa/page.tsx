import { Card, PageHeader } from '@/components/ui';
import { OrgTable } from '@/components/org-table';
import { listOrgs } from '@/lib/queries/orgs';

export default async function Page({
  searchParams,
}: {
  searchParams: { prova?: string };
}) {
  const includeDemo = searchParams.prova === '1';
  const rows = await listOrgs(includeDemo);

  return (
    <>
      <PageHeader
        title="Società"
        subtitle="Un account per società. Le schede mostrano conteggi, mai dati di salute degli atleti."
      />
      <Card>
        <OrgTable rows={rows} />
        <p className="mt-4 text-xs text-slate-500">
          {includeDemo ? (
            <>
              Stai vedendo anche gli account di prova.{' '}
              <a href="/societa" className="text-teal-700 hover:underline">
                Nascondili
              </a>
              .
            </>
          ) : (
            <>
              Gli account di prova sono esclusi.{' '}
              <a href="/societa?prova=1" className="text-teal-700 hover:underline">
                Mostrali
              </a>{' '}
              per controllare che il filtro tolga quello che deve.
            </>
          )}
        </p>
      </Card>
    </>
  );
}
