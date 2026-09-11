/**
 * Che cosa conta come "societa' vera".
 *
 * Il database di produzione contiene anche gli account di prova creati per i
 * preparatori e le due organizzazioni demo del seed. Lasciarli dentro
 * gonfierebbe ogni metrica di acquisizione e falserebbe l'attivazione, quindi
 * di norma sono esclusi ovunque.
 *
 * I criteri stanno in una variabile d'ambiente e non nel codice: quando gli
 * account di prova cambiano si aggiorna `.env.deploy` e si riavvia il
 * container, senza ricompilare.
 */
export const DEMO_PATTERNS: string[] = (
  process.env.ADMIN_DEMO_EMAIL_PATTERNS ?? '%@demo.com,%@pro.com,%@starter.com,%@example.com'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * CTE da anteporre a ogni query. Si aspetta che `$1` sia SEMPRE il primo
 * parametro e contenga DEMO_PATTERNS: e' una convenzione scomoda ma tiene
 * tutte le query allineate senza costruire SQL a stringhe.
 */
export const REAL_ORGS_CTE = `
  real_orgs AS (
    SELECT o.id
    FROM organizations o
    WHERE NOT EXISTS (
      SELECT 1 FROM users u
      WHERE u."organizationId" = o.id
        AND u.email LIKE ANY($1::text[])
    )
  )
`;

/**
 * Ultimo segno di vita di una societa'.
 *
 * ATTENZIONE al limite: `audit_logs` registra solo gli endpoint che toccano
 * dati personali o sanitari (atleti, wellness, infortuni, RTP, report,
 * metriche, inviti, GDPR). Chi usa solo calendario ed esercizi non lascia
 * traccia. Percio' il valore e' il piu' recente fra ultimo login e ultimo
 * accesso tracciato, ed e' comunque una stima per difetto.
 */
export const ORG_ACTIVITY_CTE = `
  org_activity AS (
    SELECT
      o.id AS org_id,
      GREATEST(
        (SELECT max(u."lastLoginAt") FROM users u WHERE u."organizationId" = o.id),
        (SELECT max(a."createdAt")  FROM audit_logs a WHERE a."organizationId" = o.id)
      ) AS last_seen
    FROM organizations o
  )
`;
