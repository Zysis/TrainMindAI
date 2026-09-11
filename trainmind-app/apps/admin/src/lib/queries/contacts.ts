import { q } from '@/lib/db';
import { DEMO_PATTERNS, REAL_ORGS_CTE } from '@/lib/scope';

export type Contact = {
  email: string;
  firstName: string;
  lastName: string;
  organization: string;
  tier: string;
  locale: string | null;
  consentedAt: string;
  docVersion: string;
};

/**
 * L'UNICO punto della console in cui compaiono nomi ed email.
 *
 * Il filtro non e' un dettaglio: entrano solo gli utenti con un consenso
 * MARKETING registrato e NON revocato. Chi ha revocato sparisce da qui allo
 * stesso istante, senza che nessuno debba ricordarsene. Gli account
 * disattivati e quelli cancellati per richiesta GDPR restano fuori.
 *
 * Questo elenco e' a tutti gli effetti un registro di dati personali:
 * esportarlo e' un trattamento, e il file che ne esce va trattato come tale.
 */
export async function listMarketingContacts(): Promise<Contact[]> {
  const rows = await q<Record<string, unknown>>(
    `
    WITH ${REAL_ORGS_CTE}
    SELECT
      u.email,
      u."firstName",
      u."lastName",
      o.name AS organization,
      o.tier::text AS tier,
      u.locale,
      c."acceptedAt" AS consented_at,
      c."docVersion"
    FROM users u
    JOIN organizations o ON o.id = u."organizationId"
    JOIN LATERAL (
      SELECT c."acceptedAt", c."docVersion"
      FROM consent_records c
      WHERE c."userId" = u.id
        AND c."docType" = 'MARKETING'
        AND c."revokedAt" IS NULL
      ORDER BY c."acceptedAt" DESC
      LIMIT 1
    ) c ON true
    WHERE u."deletedAt" IS NULL
      AND u."isActive" = true
      AND u."organizationId" IN (SELECT id FROM real_orgs)
    ORDER BY c."acceptedAt" DESC
    `,
    [DEMO_PATTERNS],
  );

  return rows.map((r) => ({
    email: String(r.email),
    firstName: String(r.firstName),
    lastName: String(r.lastName),
    organization: String(r.organization),
    tier: String(r.tier),
    locale: r.locale ? String(r.locale) : null,
    consentedAt: String(r.consented_at),
    docVersion: String(r.docVersion),
  }));
}

/** Riepilogo dei consensi, senza toccare un solo nome. */
export async function getConsentSummary(): Promise<
  Array<{ docType: string; granted: number; revoked: number }>
> {
  const rows = await q<Record<string, string>>(
    `
    WITH ${REAL_ORGS_CTE}
    SELECT
      c."docType",
      count(DISTINCT c."userId") FILTER (WHERE c."revokedAt" IS NULL) AS granted,
      count(DISTINCT c."userId") FILTER (WHERE c."revokedAt" IS NOT NULL) AS revoked
    FROM consent_records c
    JOIN users u ON u.id = c."userId"
    WHERE u."organizationId" IN (SELECT id FROM real_orgs)
    GROUP BY c."docType"
    ORDER BY c."docType"
    `,
    [DEMO_PATTERNS],
  );
  return rows.map((r) => ({
    docType: r.docType,
    granted: Number(r.granted ?? 0),
    revoked: Number(r.revoked ?? 0),
  }));
}
