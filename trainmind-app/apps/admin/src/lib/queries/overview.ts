import { n, q, q1 } from '@/lib/db';
import { DEMO_PATTERNS, ORG_ACTIVITY_CTE, REAL_ORGS_CTE } from '@/lib/scope';

export type Overview = {
  orgs: number;
  orgsNew30: number;
  orgsNew7: number;
  orgsActive30: number;
  staffUsers: number;
  athleteAccounts: number;
  athletes: number;
  teams: number;
  aiCost30: number;
  demoOrgs: number;
};

export async function getOverview(): Promise<Overview> {
  const row = await q1<Record<string, unknown>>(
    `
    WITH ${REAL_ORGS_CTE}, ${ORG_ACTIVITY_CTE}
    SELECT
      (SELECT count(*) FROM real_orgs) AS orgs,
      (SELECT count(*) FROM organizations o
         WHERE o."createdAt" >= now() - interval '30 days'
           AND o.id IN (SELECT id FROM real_orgs)) AS orgs_new_30,
      (SELECT count(*) FROM organizations o
         WHERE o."createdAt" >= now() - interval '7 days'
           AND o.id IN (SELECT id FROM real_orgs)) AS orgs_new_7,
      (SELECT count(*) FROM org_activity a
         WHERE a.last_seen >= now() - interval '30 days'
           AND a.org_id IN (SELECT id FROM real_orgs)) AS orgs_active_30,
      (SELECT count(*) FROM users u
         WHERE u."deletedAt" IS NULL AND u.role <> 'ATHLETE'
           AND u."organizationId" IN (SELECT id FROM real_orgs)) AS staff_users,
      (SELECT count(*) FROM users u
         WHERE u."deletedAt" IS NULL AND u.role = 'ATHLETE'
           AND u."organizationId" IN (SELECT id FROM real_orgs)) AS athlete_accounts,
      (SELECT count(*) FROM athletes a
         WHERE a."organizationId" IN (SELECT id FROM real_orgs)) AS athletes,
      (SELECT count(*) FROM teams t
         WHERE t."organizationId" IN (SELECT id FROM real_orgs)) AS teams,
      (SELECT coalesce(sum(l."costUsd"), 0) FROM ai_usage_logs l
         WHERE l."createdAt" >= now() - interval '30 days'
           AND l."organizationId" IN (SELECT id FROM real_orgs)) AS ai_cost_30,
      (SELECT count(*) FROM organizations o
         WHERE o.id NOT IN (SELECT id FROM real_orgs)) AS demo_orgs
    `,
    [DEMO_PATTERNS],
  );

  return {
    orgs: n(row?.orgs),
    orgsNew30: n(row?.orgs_new_30),
    orgsNew7: n(row?.orgs_new_7),
    orgsActive30: n(row?.orgs_active_30),
    staffUsers: n(row?.staff_users),
    athleteAccounts: n(row?.athlete_accounts),
    athletes: n(row?.athletes),
    teams: n(row?.teams),
    aiCost30: n(row?.ai_cost_30),
    demoOrgs: n(row?.demo_orgs),
  };
}

/** Iscrizioni per mese, ultimi 12 mesi, mesi vuoti compresi. */
export async function getSignupsByMonth(): Promise<Array<{ month: string; count: number }>> {
  const rows = await q<{ month: string; count: string }>(
    `
    WITH ${REAL_ORGS_CTE},
    months AS (
      SELECT generate_series(
        date_trunc('month', now()) - interval '11 months',
        date_trunc('month', now()),
        interval '1 month'
      ) AS month
    )
    SELECT
      to_char(m.month, 'YYYY-MM-DD') AS month,
      count(o.id) AS count
    FROM months m
    LEFT JOIN organizations o
      ON date_trunc('month', o."createdAt") = m.month
     AND o.id IN (SELECT id FROM real_orgs)
    GROUP BY m.month
    ORDER BY m.month
    `,
    [DEMO_PATTERNS],
  );
  return rows.map((r) => ({ month: r.month, count: n(r.count) }));
}

export async function getTierBreakdown(): Promise<Array<{ tier: string; count: number }>> {
  const rows = await q<{ tier: string; count: string }>(
    `
    WITH ${REAL_ORGS_CTE}
    SELECT o.tier::text AS tier, count(*) AS count
    FROM organizations o
    WHERE o.id IN (SELECT id FROM real_orgs)
    GROUP BY o.tier
    `,
    [DEMO_PATTERNS],
  );
  // Ordine fisso: i tre piani hanno un colore assegnato che non deve ballare
  // quando uno di loro resta a zero.
  const order = ['STARTER', 'PROFESSIONAL', 'ULTRA'];
  const map = new Map(rows.map((r) => [r.tier, n(r.count)]));
  return order.map((tier) => ({ tier, count: map.get(tier) ?? 0 }));
}

export async function getLocaleBreakdown(): Promise<Array<{ locale: string; count: number }>> {
  const rows = await q<{ locale: string | null; count: string }>(
    `
    WITH ${REAL_ORGS_CTE}
    SELECT u.locale AS locale, count(*) AS count
    FROM users u
    WHERE u."deletedAt" IS NULL
      AND u.role = 'ADMIN'
      AND u."organizationId" IN (SELECT id FROM real_orgs)
    GROUP BY u.locale
    ORDER BY count DESC
    `,
    [DEMO_PATTERNS],
  );
  return rows.map((r) => ({ locale: r.locale ?? '', count: n(r.count) }));
}
