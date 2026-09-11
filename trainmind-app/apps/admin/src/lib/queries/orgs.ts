import { n, q, q1 } from '@/lib/db';
import { DEMO_PATTERNS, ORG_ACTIVITY_CTE, REAL_ORGS_CTE } from '@/lib/scope';

export type OrgRow = {
  id: string;
  name: string;
  slug: string;
  tier: string;
  createdAt: string;
  lastSeen: string | null;
  users: number;
  teams: number;
  athletes: number;
  aiCost: number;
  subscriptionStatus: string | null;
  isDemo: boolean;
};

/**
 * Elenco societa'. `includeDemo` mostra anche gli account di prova: serve solo
 * a controllare che il filtro stia togliendo quello che deve.
 */
export async function listOrgs(includeDemo = false): Promise<OrgRow[]> {
  const rows = await q<Record<string, unknown>>(
    `
    WITH ${REAL_ORGS_CTE}, ${ORG_ACTIVITY_CTE}
    SELECT
      o.id,
      o.name,
      o.slug,
      o.tier::text AS tier,
      o."createdAt",
      o."subscriptionStatus",
      act.last_seen,
      (o.id NOT IN (SELECT id FROM real_orgs)) AS is_demo,
      (SELECT count(*) FROM users u
        WHERE u."organizationId" = o.id AND u."deletedAt" IS NULL AND u.role <> 'ATHLETE') AS users,
      (SELECT count(*) FROM teams t    WHERE t."organizationId" = o.id) AS teams,
      (SELECT count(*) FROM athletes a WHERE a."organizationId" = o.id) AS athletes,
      (SELECT coalesce(sum(l."costUsd"), 0) FROM ai_usage_logs l
        WHERE l."organizationId" = o.id) AS ai_cost
    FROM organizations o
    JOIN org_activity act ON act.org_id = o.id
    WHERE ($2::boolean OR o.id IN (SELECT id FROM real_orgs))
    ORDER BY o."createdAt" DESC
    `,
    [DEMO_PATTERNS, includeDemo],
  );

  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    slug: String(r.slug),
    tier: String(r.tier),
    createdAt: String(r.createdAt),
    lastSeen: r.last_seen ? String(r.last_seen) : null,
    users: n(r.users),
    teams: n(r.teams),
    athletes: n(r.athletes),
    aiCost: n(r.ai_cost),
    subscriptionStatus: r.subscriptionStatus ? String(r.subscriptionStatus) : null,
    isDemo: Boolean(r.is_demo),
  }));
}

export type OrgDetail = OrgRow & {
  sport: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  signupReferrer: string | null;
  athleteAccounts: number;
  sessions: number;
  wellnessLogs: number;
  invitesSent: number;
  invitesAccepted: number;
  aiCalls: number;
  members: Array<{
    role: string;
    locale: string | null;
    createdAt: string;
    lastLoginAt: string | null;
    marketing: boolean;
  }>;
};

/**
 * Scheda di una societa'.
 *
 * Nota deliberata: qui NON compaiono ne' i nomi degli atleti ne' un solo
 * valore di wellness, infortunio o RTP. Solo conteggi. I dati sanitari non
 * escono mai dal perimetro di chi cura quella squadra, nemmeno per il
 * gestore della piattaforma.
 *
 * Anche i membri dello staff sono elencati per ruolo e non per nome: qui serve
 * capire com'e' composto l'account, non sapere chi sono le persone. Nomi ed
 * email stanno solo nella pagina Contatti, e solo per chi ha dato il consenso.
 */
export async function getOrgDetail(id: string): Promise<OrgDetail | null> {
  const row = await q1<Record<string, unknown>>(
    `
    WITH ${REAL_ORGS_CTE}, ${ORG_ACTIVITY_CTE}
    SELECT
      o.id, o.name, o.slug, o.sport, o.tier::text AS tier, o."createdAt",
      o."subscriptionStatus", act.last_seen,
      o."utmSource", o."utmMedium", o."utmCampaign", o."signupReferrer",
      (o.id NOT IN (SELECT id FROM real_orgs)) AS is_demo,
      (SELECT count(*) FROM users u
        WHERE u."organizationId" = o.id AND u."deletedAt" IS NULL AND u.role <> 'ATHLETE') AS users,
      (SELECT count(*) FROM users u
        WHERE u."organizationId" = o.id AND u."deletedAt" IS NULL AND u.role = 'ATHLETE') AS athlete_accounts,
      (SELECT count(*) FROM teams t    WHERE t."organizationId" = o.id) AS teams,
      (SELECT count(*) FROM athletes a WHERE a."organizationId" = o.id) AS athletes,
      (SELECT count(*) FROM training_sessions s
        WHERE s."organizationId" = o.id AND s."isTemplate" = false) AS sessions,
      (SELECT count(*) FROM wellness_logs w
        JOIN athletes a ON a.id = w."athleteId" WHERE a."organizationId" = o.id) AS wellness_logs,
      (SELECT count(*) FROM athlete_invites i WHERE i."organizationId" = o.id) AS invites_sent,
      (SELECT count(*) FROM athlete_invites i
        WHERE i."organizationId" = o.id AND i.status = 'ACCEPTED') AS invites_accepted,
      (SELECT count(*) FROM ai_usage_logs l WHERE l."organizationId" = o.id) AS ai_calls,
      (SELECT coalesce(sum(l."costUsd"), 0) FROM ai_usage_logs l
        WHERE l."organizationId" = o.id) AS ai_cost
    FROM organizations o
    JOIN org_activity act ON act.org_id = o.id
    WHERE o.id = $2
    `,
    [DEMO_PATTERNS, id],
  );

  if (!row) return null;

  const members = await q<Record<string, unknown>>(
    `
    SELECT
      u.role::text AS role,
      u.locale,
      u."createdAt",
      u."lastLoginAt",
      EXISTS (
        SELECT 1 FROM consent_records c
        WHERE c."userId" = u.id AND c."docType" = 'MARKETING' AND c."revokedAt" IS NULL
      ) AS marketing
    FROM users u
    WHERE u."organizationId" = $1 AND u."deletedAt" IS NULL AND u.role <> 'ATHLETE'
    ORDER BY u."createdAt"
    `,
    [id],
  );

  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    sport: String(row.sport),
    utmSource: row.utmSource ? String(row.utmSource) : null,
    utmMedium: row.utmMedium ? String(row.utmMedium) : null,
    utmCampaign: row.utmCampaign ? String(row.utmCampaign) : null,
    signupReferrer: row.signupReferrer ? String(row.signupReferrer) : null,
    tier: String(row.tier),
    createdAt: String(row.createdAt),
    lastSeen: row.last_seen ? String(row.last_seen) : null,
    users: n(row.users),
    athleteAccounts: n(row.athlete_accounts),
    teams: n(row.teams),
    athletes: n(row.athletes),
    sessions: n(row.sessions),
    wellnessLogs: n(row.wellness_logs),
    invitesSent: n(row.invites_sent),
    invitesAccepted: n(row.invites_accepted),
    aiCalls: n(row.ai_calls),
    aiCost: n(row.ai_cost),
    subscriptionStatus: row.subscriptionStatus ? String(row.subscriptionStatus) : null,
    isDemo: Boolean(row.is_demo),
    members: members.map((m) => ({
      role: String(m.role),
      locale: m.locale ? String(m.locale) : null,
      createdAt: String(m.createdAt),
      lastLoginAt: m.lastLoginAt ? String(m.lastLoginAt) : null,
      marketing: Boolean(m.marketing),
    })),
  };
}
