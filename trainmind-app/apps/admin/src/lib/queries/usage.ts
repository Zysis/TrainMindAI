import { n, q } from '@/lib/db';
import { DEMO_PATTERNS, ORG_ACTIVITY_CTE, REAL_ORGS_CTE } from '@/lib/scope';

/**
 * PREMESSA VALIDA PER TUTTO QUESTO FILE.
 *
 * L'unica traccia storica di attivita' nel database e' `audit_logs`, che il
 * plugin di audit scrive SOLO per gli endpoint che toccano dati personali o
 * sanitari: atleti, wellness, infortuni, RTP, metriche, report, inviti, GDPR.
 * Chi passa la giornata sul calendario, sugli esercizi o in periodizzazione
 * non compare qui.
 *
 * Quindi: questi numeri sono una STIMA PER DIFETTO dell'uso reale. Vanno letti
 * come tendenza, non come censimento. La Fase 2 aggiunge `lastActiveAt` sugli
 * utenti e li rende veri.
 */

/** Utenti distinti al giorno, ultimi N giorni. */
export async function getDau(days = 30): Promise<Array<{ day: string; value: number }>> {
  const rows = await q<{ day: string; value: string }>(
    `
    WITH ${REAL_ORGS_CTE},
    span AS (
      SELECT generate_series(
        (now() - make_interval(days => $2::int))::date, now()::date, interval '1 day'
      )::date AS day
    )
    SELECT to_char(s.day, 'YYYY-MM-DD') AS day,
           count(DISTINCT a."userId") AS value
    FROM span s
    LEFT JOIN audit_logs a
      ON a."createdAt"::date = s.day
     AND a."organizationId" IN (SELECT id FROM real_orgs)
    GROUP BY s.day
    ORDER BY s.day
    `,
    [DEMO_PATTERNS, days],
  );
  return rows.map((r) => ({ day: r.day, value: n(r.value) }));
}

/** Utenti distinti in una finestra mobile di `window` giorni, giorno per giorno. */
export async function getRollingActive(
  windowDays: number,
  days = 30,
): Promise<Array<{ day: string; value: number }>> {
  const rows = await q<{ day: string; value: string }>(
    `
    WITH ${REAL_ORGS_CTE},
    span AS (
      SELECT generate_series(
        (now() - make_interval(days => $2::int))::date, now()::date, interval '1 day'
      )::date AS day
    )
    SELECT
      to_char(s.day, 'YYYY-MM-DD') AS day,
      (
        SELECT count(DISTINCT a."userId")
        FROM audit_logs a
        WHERE a."createdAt"::date > s.day - make_interval(days => $3::int)
          AND a."createdAt"::date <= s.day
          AND a."organizationId" IN (SELECT id FROM real_orgs)
      ) AS value
    FROM span s
    ORDER BY s.day
    `,
    [DEMO_PATTERNS, days, windowDays],
  );
  return rows.map((r) => ({ day: r.day, value: n(r.value) }));
}

/** Aree di prodotto piu' toccate negli ultimi 30 giorni. */
export async function getTopResources(): Promise<Array<{ resource: string; count: number }>> {
  const rows = await q<{ resource: string; count: string }>(
    `
    WITH ${REAL_ORGS_CTE}
    SELECT a."resourceType" AS resource, count(*) AS count
    FROM audit_logs a
    WHERE a."createdAt" >= now() - interval '30 days'
      AND a."organizationId" IN (SELECT id FROM real_orgs)
    GROUP BY a."resourceType"
    ORDER BY count DESC
    LIMIT 12
    `,
    [DEMO_PATTERNS],
  );
  return rows.map((r) => ({ resource: r.resource, count: n(r.count) }));
}

/** Inviti atleta mandati e accettati: e' la misura dell'adozione della PWA atleti. */
export async function getInviteFunnel(): Promise<{
  sent: number;
  accepted: number;
  pending: number;
  expired: number;
  orgsInviting: number;
}> {
  const rows = await q<Record<string, string>>(
    `
    WITH ${REAL_ORGS_CTE}
    SELECT
      count(*) AS sent,
      count(*) FILTER (WHERE i.status = 'ACCEPTED') AS accepted,
      count(*) FILTER (WHERE i.status = 'PENDING')  AS pending,
      count(*) FILTER (WHERE i.status = 'EXPIRED')  AS expired,
      count(DISTINCT i."organizationId") AS orgs_inviting
    FROM athlete_invites i
    WHERE i."organizationId" IN (SELECT id FROM real_orgs)
    `,
    [DEMO_PATTERNS],
  );
  const r = rows[0] ?? {};
  return {
    sent: n(r.sent),
    accepted: n(r.accepted),
    pending: n(r.pending),
    expired: n(r.expired),
    orgsInviting: n(r.orgs_inviting),
  };
}

export type Cohort = { month: string; size: number; active: number; pct: number };

/**
 * Sopravvivenza per mese di iscrizione: delle societa' iscritte nel mese X,
 * quante hanno dato segno di vita negli ultimi 30 giorni.
 *
 * Non e' la retention a settimana 1 / 4 / 12 che si vede negli strumenti di
 * prodotto: quella richiede lo storico delle sessioni, e `audit_logs` da solo
 * non basta a ricostruirlo. Questa e' la versione onesta che i dati attuali
 * permettono.
 */
export async function getCohorts(): Promise<Cohort[]> {
  const rows = await q<Record<string, string>>(
    `
    WITH ${REAL_ORGS_CTE}, ${ORG_ACTIVITY_CTE}
    SELECT
      to_char(date_trunc('month', o."createdAt"), 'YYYY-MM-DD') AS month,
      count(*) AS size,
      count(*) FILTER (WHERE act.last_seen >= now() - interval '30 days') AS active
    FROM organizations o
    JOIN org_activity act ON act.org_id = o.id
    WHERE o.id IN (SELECT id FROM real_orgs)
    GROUP BY 1
    ORDER BY 1
    `,
    [DEMO_PATTERNS],
  );
  return rows.map((r) => {
    const size = n(r.size);
    const active = n(r.active);
    return { month: r.month, size, active, pct: size === 0 ? 0 : (active / size) * 100 };
  });
}
