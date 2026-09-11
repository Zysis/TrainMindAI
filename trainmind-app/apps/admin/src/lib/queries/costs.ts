import { n, q } from '@/lib/db';
import { DEMO_PATTERNS, REAL_ORGS_CTE } from '@/lib/scope';

/** Costo AI per mese, ultimi 12. */
export async function getAiCostByMonth(): Promise<
  Array<{ month: string; cost: number; calls: number; tokens: number }>
> {
  const rows = await q<Record<string, string>>(
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
      coalesce(sum(l."costUsd"), 0) AS cost,
      count(l.id) AS calls,
      coalesce(sum(l."totalTokens"), 0) AS tokens
    FROM months m
    LEFT JOIN ai_usage_logs l
      ON date_trunc('month', l."createdAt") = m.month
     AND l."organizationId" IN (SELECT id FROM real_orgs)
    GROUP BY m.month
    ORDER BY m.month
    `,
    [DEMO_PATTERNS],
  );
  return rows.map((r) => ({
    month: r.month,
    cost: n(r.cost),
    calls: n(r.calls),
    tokens: n(r.tokens),
  }));
}

/** Costo per operazione (chat, coach, generate, wellness, rtp, report). */
export async function getAiCostByOperation(): Promise<
  Array<{ operation: string; cost: number; calls: number }>
> {
  const rows = await q<Record<string, string>>(
    `
    WITH ${REAL_ORGS_CTE}
    SELECT l.operation::text AS operation,
           coalesce(sum(l."costUsd"), 0) AS cost,
           count(*) AS calls
    FROM ai_usage_logs l
    WHERE l."organizationId" IN (SELECT id FROM real_orgs)
      AND l."createdAt" >= now() - interval '90 days'
    GROUP BY l.operation
    ORDER BY cost DESC
    `,
    [DEMO_PATTERNS],
  );
  return rows.map((r) => ({ operation: r.operation, cost: n(r.cost), calls: n(r.calls) }));
}

/** Le societa' che costano di piu' in AI. */
export async function getAiCostByOrg(limit = 20): Promise<
  Array<{ id: string; name: string; tier: string; cost: number; calls: number; errors: number }>
> {
  const rows = await q<Record<string, unknown>>(
    `
    WITH ${REAL_ORGS_CTE}
    SELECT
      o.id, o.name, o.tier::text AS tier,
      coalesce(sum(l."costUsd"), 0) AS cost,
      count(l.id) AS calls,
      count(l.id) FILTER (WHERE l.success = false) AS errors
    FROM organizations o
    LEFT JOIN ai_usage_logs l ON l."organizationId" = o.id
    WHERE o.id IN (SELECT id FROM real_orgs)
    GROUP BY o.id, o.name, o.tier
    HAVING coalesce(sum(l."costUsd"), 0) > 0
    ORDER BY cost DESC
    LIMIT $2
    `,
    [DEMO_PATTERNS, limit],
  );
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    tier: String(r.tier),
    cost: n(r.cost),
    calls: n(r.calls),
    errors: n(r.errors),
  }));
}
