import { n, q } from '@/lib/db';
import { DEMO_PATTERNS, REAL_ORGS_CTE } from '@/lib/scope';

export type ActivationStep = { key: string; label: string; count: number; pct: number };

/**
 * Imbuto di attivazione: quante societa' hanno compiuto ciascun passo ENTRO
 * SETTE GIORNI dall'iscrizione.
 *
 * Il denominatore esclude chi si e' iscritto da meno di sette giorni: non ha
 * ancora avuto il tempo di fare il percorso, e contarlo fra i "fermi" farebbe
 * scendere il tasso ogni volta che arriva un cliente nuovo.
 */
export async function getActivationFunnel(): Promise<{
  eligible: number;
  steps: ActivationStep[];
}> {
  const rows = await q<Record<string, string>>(
    `
    WITH ${REAL_ORGS_CTE},
    cohort AS (
      SELECT o.id, o."createdAt", o."createdAt" + interval '7 days' AS deadline
      FROM organizations o
      WHERE o.id IN (SELECT id FROM real_orgs)
        AND o."createdAt" <= now() - interval '7 days'
    )
    SELECT
      count(*) AS eligible,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM teams t
        WHERE t."organizationId" = c.id AND t."createdAt" <= c.deadline
      )) AS team,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM athletes a
        WHERE a."organizationId" = c.id AND a."createdAt" <= c.deadline
      )) AS athlete,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM training_sessions s
        WHERE s."organizationId" = c.id
          AND s."isTemplate" = false
          AND s."createdAt" <= c.deadline
      )) AS session,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM wellness_logs w
        JOIN athletes a ON a.id = w."athleteId"
        WHERE a."organizationId" = c.id AND w."createdAt" <= c.deadline
      )) AS wellness,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM athlete_invites i
        WHERE i."organizationId" = c.id AND i."createdAt" <= c.deadline
      )) AS invite
    FROM cohort c
    `,
    [DEMO_PATTERNS],
  );

  const row = rows[0] ?? {};
  const eligible = n(row.eligible);
  const pct = (v: number) => (eligible === 0 ? 0 : (v / eligible) * 100);

  const steps: ActivationStep[] = [
    { key: 'team', label: 'Ha creato una squadra', count: n(row.team), pct: pct(n(row.team)) },
    { key: 'athlete', label: 'Ha aggiunto un atleta', count: n(row.athlete), pct: pct(n(row.athlete)) },
    { key: 'session', label: 'Ha pianificato una sessione', count: n(row.session), pct: pct(n(row.session)) },
    { key: 'wellness', label: 'Ha registrato un wellness', count: n(row.wellness), pct: pct(n(row.wellness)) },
    { key: 'invite', label: 'Ha invitato un atleta', count: n(row.invite), pct: pct(n(row.invite)) },
  ];

  return { eligible, steps };
}

export type StalledOrg = {
  id: string;
  name: string;
  tier: string;
  createdAt: string;
  athletes: number;
  teams: number;
};

/**
 * Le societa' iscritte da piu' di sette giorni che non hanno mai aggiunto un
 * atleta. E' l'unica lista di questa console pensata per essere agita: sono i
 * clienti da richiamare.
 */
export async function getStalledOrgs(limit = 50): Promise<StalledOrg[]> {
  const rows = await q<Record<string, unknown>>(
    `
    WITH ${REAL_ORGS_CTE}
    SELECT
      o.id,
      o.name,
      o.tier::text AS tier,
      o."createdAt",
      (SELECT count(*) FROM athletes a WHERE a."organizationId" = o.id) AS athletes,
      (SELECT count(*) FROM teams t WHERE t."organizationId" = o.id) AS teams
    FROM organizations o
    WHERE o.id IN (SELECT id FROM real_orgs)
      AND o."createdAt" <= now() - interval '7 days'
      AND NOT EXISTS (SELECT 1 FROM athletes a WHERE a."organizationId" = o.id)
    ORDER BY o."createdAt" DESC
    LIMIT $2
    `,
    [DEMO_PATTERNS, limit],
  );
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    tier: String(r.tier),
    createdAt: String(r.createdAt),
    athletes: n(r.athletes),
    teams: n(r.teams),
  }));
}
