/**
 * Plan helpers — single source of truth per il mapping
 * tier (enum DB) → slug pubblico (START / PRO / ULTRA / CLUB).
 *
 * STARTER, PROFESSIONAL e ULTRA sono l'offerta Individuale, CLUB e' il piano
 * unico dell'offerta Club/Societa' (dal 9/10/2026, vedi apps/api/src/lib/plans.ts).
 *
 * Usato da:
 *  - PlanBadge (topbar)
 *  - BrandLogo (sidebar, settings) per le varianti grafiche
 *  - SettingsPage per la card "Piano corrente"
 */

export type PlanSlug = 'START' | 'PRO' | 'ULTRA' | 'CLUB';
export type PlanKey = 'STARTER' | 'PROFESSIONAL' | 'ULTRA' | 'CLUB';

const TIER_TO_SLUG: Record<string, PlanSlug> = {
  starter: 'START',
  professional: 'PRO',
  ultra: 'ULTRA',
  club: 'CLUB',
};

const TIER_TO_KEY: Record<string, PlanKey> = {
  starter: 'STARTER',
  professional: 'PROFESSIONAL',
  ultra: 'ULTRA',
  club: 'CLUB',
};

export const PLAN_FULL_NAME: Record<PlanKey, string> = {
  STARTER: 'Starter',
  PROFESSIONAL: 'Professional',
  ULTRA: 'Ultra',
  CLUB: 'Club',
};

/** Piani al vertice della propria offerta: niente "passa al piano superiore". */
export function isTopPlan(key: PlanKey | null): boolean {
  return key === 'ULTRA' || key === 'CLUB';
}

/**
 * Normalizza un tier raw (es. 'STARTER', 'starter', 'Starter') al brand slug
 * pubblico ('START' | 'PRO' | 'ULTRA'). Restituisce null se non riconosciuto.
 */
export function tierToPlanSlug(tier?: string | null): PlanSlug | null {
  if (!tier) return null;
  return TIER_TO_SLUG[tier.toLowerCase().trim()] ?? null;
}

/**
 * Normalizza un tier raw alla key canonica STARTER | PROFESSIONAL | ULTRA.
 * Restituisce null se non riconosciuto.
 */
export function tierToPlanKey(tier?: string | null): PlanKey | null {
  if (!tier) return null;
  return TIER_TO_KEY[tier.toLowerCase().trim()] ?? null;
}
