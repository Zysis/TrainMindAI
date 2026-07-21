'use client';

import { useAuth } from '@/hooks/use-auth';
import { tierToPlanSlug } from './plan';

/**
 * PlanBadge — etichetta amber in alto a destra che identifica il piano
 * della subscription corrente: START · PRO · ULTRA.
 *
 * Legge `user.organization.tier` e usa l'helper condiviso `tierToPlanSlug`
 * per normalizzare al brand slug pubblico. Restituisce `null` se non c'è
 * un tier riconosciuto.
 */
export function PlanBadge({ className = '' }: { className?: string }) {
  const { user } = useAuth();
  const label = tierToPlanSlug(user?.organization?.tier);
  if (!label) return null;

  return (
    <span
      title={`Piano: ${label}`}
      className={`inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-amber-500 ${className}`}
    >
      {label}
    </span>
  );
}
