import { listMarketingContacts } from '@/lib/queries/contacts';

export const dynamic = 'force-dynamic';

/**
 * Il punto e virgola come separatore e il BOM in testa non sono un vezzo:
 * Excel in italiano apre cosi' il file in colonne e con gli accenti giusti,
 * mentre con la virgola e senza BOM finisce tutto in una colonna sola.
 */
function csvCell(value: string | null): string {
  const s = value ?? '';
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const contacts = await listMarketingContacts();

  const head = ['Nome', 'Cognome', 'Email', 'Società', 'Piano', 'Lingua', 'Consenso del', 'Versione documento'];
  const lines = [
    head.join(';'),
    ...contacts.map((c) =>
      [
        csvCell(c.firstName),
        csvCell(c.lastName),
        csvCell(c.email),
        csvCell(c.organization),
        csvCell(c.tier),
        csvCell(c.locale),
        csvCell(new Date(c.consentedAt).toISOString().slice(0, 10)),
        csvCell(c.docVersion),
      ].join(';'),
    ),
  ];

  const today = new Date().toISOString().slice(0, 10);

  return new Response('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="trainmind-contatti-marketing-${today}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
