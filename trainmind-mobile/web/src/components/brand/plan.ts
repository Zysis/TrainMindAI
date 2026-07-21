/**
 * Plan helpers — single source of truth per il mapping
 * tier (enum DB) → slug pubblico (START / PRO / ULTRA).
 *
 * Usato da:
 *  - PlanBadge (topbar)
 *  - BrandLogo (sidebar, settings) per le varianti grafiche
 *  - SettingsPage per la card "Piano corrente"
 */

export type PlanSlug = 'START' | 'PRO' | 'ULTRA';
export type PlanKey = 'STARTER' | 'PROFESSIONAL' | 'ULTRA';

const TIER_TO_SLUG: Record<string, PlanSlug> = {
  starter: 'START',
  professional: 'PRO',
  ultra: 'ULTRA',
};

const TIER_TO_KEY: Record<string, PlanKey> = {
  starter: 'STARTER',
  professional: 'PROFESSIONAL',
  ultra: 'ULTRA',
};

export const PLAN_FULL_NAME: Record<PlanKey, string> = {
  STARTER: 'Starter',
  PROFESSIONAL: 'Professional',
  ULTRA: 'Ultra',
};

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
