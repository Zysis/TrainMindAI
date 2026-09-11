import { n, q } from '@/lib/db';
import { DEMO_PATTERNS, REAL_ORGS_CTE } from '@/lib/scope';

/** Iscrizioni per giorno negli ultimi N giorni, giorni vuoti compresi. */
export async function getSignupsByDay(days = 90): Promise<Array<{ day: string; count: number }>> {
  const rows = await q<{ day: string; count: string }>(
    `
    WITH ${REAL_ORGS_CTE},
    span AS (
      SELECT generate_series(
        (now() - make_interval(days => $2::int))::date,
        now()::date,
        interval '1 day'
      )::date AS day
    )
    SELECT to_char(s.day, 'YYYY-MM-DD') AS day, count(o.id) AS count
    FROM span s
    LEFT JOIN organizations o
      ON o."createdAt"::date = s.day
     AND o.id IN (SELECT id FROM real_orgs)
    GROUP BY s.day
    ORDER BY s.day
    `,
    [DEMO_PATTERNS, days],
  );
  return rows.map((r) => ({ day: r.day, count: n(r.count) }));
}

/** Piano scelto in registrazione, per mese: dice come si muove il mix. */
export async function getSignupsByTierMonth(): Promise<
  Array<{ month: string; tier: string; count: number }>
> {
  const rows = await q<{ month: string; tier: string; count: string }>(
    `
    WITH ${REAL_ORGS_CTE}
    SELECT
      to_char(date_trunc('month', o."createdAt"), 'YYYY-MM-DD') AS month,
      o.tier::text AS tier,
      count(*) AS count
    FROM organizations o
    WHERE o.id IN (SELECT id FROM real_orgs)
      AND o."createdAt" >= date_trunc('month', now()) - interval '11 months'
    GROUP BY 1, 2
    ORDER BY 1, 2
    `,
    [DEMO_PATTERNS],
  );
  return rows.map((r) => ({ month: r.month, tier: r.tier, count: n(r.count) }));
}

/**
 * Lingua dichiarata al momento del consenso. E' il dato piu' vicino a una
 * provenienza geografica che il database contenga oggi: l'indirizzo IP e'
 * salvato nei consensi ma tradurlo in un paese richiederebbe un database
 * GeoIP a bordo, che su questo VPS non vale il peso. Il paese vero arrivera'
 * da Umami nella Fase 3.
 */
export async function getSignupLanguages(): Promise<Array<{ language: string; count: number }>> {
  const rows = await q<{ language: string | null; count: string }>(
    `
    WITH ${REAL_ORGS_CTE}
    SELECT c.language, count(DISTINCT u."organizationId") AS count
    FROM consent_records c
    JOIN users u ON u.id = c."userId"
    WHERE c."docType" = 'TERMS'
      AND u."organizationId" IN (SELECT id FROM real_orgs)
    GROUP BY c.language
    ORDER BY count DESC
    `,
    [DEMO_PATTERNS],
  );
  return rows.map((r) => ({ language: r.language ?? '', count: n(r.count) }));
}

/** Quante societa' hanno accettato il marketing, sul totale. */
export async function getMarketingOptIn(): Promise<{ granted: number; total: number }> {
  const rows = await q<{ granted: string; total: string }>(
    `
    WITH ${REAL_ORGS_CTE}
    SELECT
      count(*) FILTER (
        WHERE EXISTS (
          SELECT 1 FROM consent_records c
          WHERE c."userId" = u.id AND c."docType" = 'MARKETING' AND c."revokedAt" IS NULL
        )
      ) AS granted,
      count(*) AS total
    FROM users u
    WHERE u.role = 'ADMIN'
      AND u."deletedAt" IS NULL
      AND u."organizationId" IN (SELECT id FROM real_orgs)
    `,
    [DEMO_PATTERNS],
  );
  return { granted: n(rows[0]?.granted), total: n(rows[0]?.total) };
}

/**
 * Data in cui la raccolta della provenienza e' entrata in produzione.
 * Prima di questo istante l'assenza di sorgente non significa "diretto":
 * significa che nessuno stava guardando.
 */
export const TRACKING_SINCE = '2026-09-04T00:00:00Z';

export type SourceRow = { source: string; count: number; known: boolean };

/**
 * Da dove arrivano le societa'.
 *
 * Quattro casi, e la differenza conta:
 *  - una sorgente vera (`utmSource` valorizzato);
 *  - "da altri siti": nessun parametro di campagna ma un referrer noto, cioe'
 *    un articolo, un forum, un passaparola — il dettaglio sta nel riquadro dei
 *    siti che portano iscrizioni;
 *  - "diretto o non tracciato": ne' parametri ne' referrer, cioe' chi ha
 *    digitato l'indirizzo o e' arrivato da un canale che non li porta (un
 *    messaggio, una mail, un QR);
 *  - "prima del tracciamento": iscrizioni antecedenti al deploy, per cui la
 *    sorgente non e' mai stata osservata e non e' ricostruibile.
 *
 * Tenerli separati evita la lettura sbagliata piu' comune: leggere come
 * "traffico diretto" quello che invece e' solo un buco nella misurazione.
 */
export async function getSourceBreakdown(): Promise<SourceRow[]> {
  const rows = await q<{
    source: string | null;
    count: string;
    before: boolean;
    has_referrer: boolean;
  }>(
    `
    WITH ${REAL_ORGS_CTE}
    SELECT
      o."utmSource" AS source,
      (o."createdAt" < $2::timestamptz) AS before,
      (o."signupReferrer" IS NOT NULL) AS has_referrer,
      count(*) AS count
    FROM organizations o
    WHERE o.id IN (SELECT id FROM real_orgs)
    GROUP BY 1, 2, 3
    ORDER BY count DESC
    `,
    [DEMO_PATTERNS, TRACKING_SINCE],
  );

  const out: SourceRow[] = [];
  let untracked = 0;
  let direct = 0;
  let fromSites = 0;

  for (const r of rows) {
    const count = n(r.count);
    if (r.source) out.push({ source: r.source, count, known: true });
    else if (r.before) untracked += count;
    else if (r.has_referrer) fromSites += count;
    else direct += count;
  }

  out.sort((a, b) => b.count - a.count);
  if (fromSites > 0) out.push({ source: 'Da altri siti', count: fromSites, known: false });
  if (direct > 0) out.push({ source: 'Diretto o non tracciato', count: direct, known: false });
  if (untracked > 0) {
    out.push({ source: 'Iscritte prima del tracciamento', count: untracked, known: false });
  }
  return out;
}

export type CampaignRow = {
  source: string;
  medium: string;
  campaign: string;
  count: number;
};

/** Sorgente, mezzo e campagna insieme: e' il dettaglio su cui si decide dove spendere. */
export async function getCampaigns(limit = 30): Promise<CampaignRow[]> {
  const rows = await q<Record<string, unknown>>(
    `
    WITH ${REAL_ORGS_CTE}
    SELECT
      o."utmSource"   AS source,
      o."utmMedium"   AS medium,
      o."utmCampaign" AS campaign,
      count(*) AS count
    FROM organizations o
    WHERE o.id IN (SELECT id FROM real_orgs)
      AND o."utmSource" IS NOT NULL
    GROUP BY 1, 2, 3
    ORDER BY count DESC
    LIMIT $2
    `,
    [DEMO_PATTERNS, limit],
  );
  return rows.map((r) => ({
    source: String(r.source),
    medium: r.medium ? String(r.medium) : '—',
    campaign: r.campaign ? String(r.campaign) : '—',
    count: n(r.count),
  }));
}

/** I siti che portano iscrizioni senza campagna: passaparola, forum, articoli. */
export async function getReferrers(limit = 15): Promise<Array<{ host: string; count: number }>> {
  const rows = await q<{ host: string; count: string }>(
    `
    WITH ${REAL_ORGS_CTE}
    SELECT
      -- Solo il nome del sito: il percorso completo e' rumore, e a volte
      -- contiene parametri che non abbiamo motivo di conservare a schermo.
      split_part(split_part(replace(replace(o."signupReferrer", 'https://', ''), 'http://', ''), '/', 1), '?', 1) AS host,
      count(*) AS count
    FROM organizations o
    WHERE o.id IN (SELECT id FROM real_orgs)
      AND o."signupReferrer" IS NOT NULL
      AND o."utmSource" IS NULL
    GROUP BY 1
    ORDER BY count DESC
    LIMIT $2
    `,
    [DEMO_PATTERNS, limit],
  );
  return rows.map((r) => ({ host: r.host || '—', count: n(r.count) }));
}
