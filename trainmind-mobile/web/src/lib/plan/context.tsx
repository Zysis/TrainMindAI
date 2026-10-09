'use client';

/**
 * Piano dell'organizzazione: prova, limiti, uso e listino.
 *
 * Una sola chiamata (`GET /billing/entitlements`) all'ingresso nella
 * dashboard, condivisa da banner, blocchi delle funzioni, badge e pagina
 * Abbonamento. Le regole vere stanno nell'API (apps/api/src/lib/plans.ts):
 * qui si leggono e si mostrano, non si decide niente.
 *
 * Se la chiamata fallisce (API vecchia, rete), il contesto resta `null` e
 * ogni componente si comporta come prima dei piani: niente blocchi, niente
 * banner. Un errore qui non deve mai togliere funzioni.
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch } from '@/lib/auth/fetch';

export type PlanTier = 'STARTER' | 'PROFESSIONAL' | 'ULTRA' | 'CLUB';
export type PlanFeature = 'ai' | 'analytics' | 'dailyReport' | 'gameReport' | 'reports' | 'adaptations';
export type PlanMode = 'legacy' | 'trial' | 'expired' | 'active';
export type BillingCycle = 'monthly' | 'yearly';

export interface CatalogPlan {
  tier: PlanTier;
  offer: 'INDIVIDUAL' | 'CLUB';
  teams: number;
  athletesPerTeam: number;
  seats: number;
  aiCredits: number;
  features: Record<PlanFeature, boolean>;
  extensions: boolean;
  price: { monthly: number; yearly: number };
}

export interface PlanCatalog {
  trial: { days: number; teams: number; athletesPerTeam: number; seats: number };
  plans: CatalogPlan[];
  extensions: {
    team: { monthly: number; yearly: number; aiCredits: number };
    athletePack: { size: number; monthly: number; yearly: number };
    seat: { monthly: number; yearly: number };
  };
  reactivationsPerMonth: number;
}

export interface PlanOverview {
  enforced: boolean;
  mode: PlanMode;
  tier: PlanTier;
  offer: 'INDIVIDUAL' | 'CLUB' | 'TRIAL';
  readOnly: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  intendedTier: PlanTier | null;
  billingCycle: BillingCycle | null;
  limits: { teams: number; athletesPerTeam: number; seats: number; aiCredits: number };
  features: Record<PlanFeature, boolean>;
  extensionsAllowed: boolean;
  extensions: { extraTeams: number; extraSeats: number };
  usage: {
    teams: number;
    athletesActive: number;
    athleteCapacity: number;
    perTeam: Array<{ id: string; name: string; athletes: number; capacity: number; extraAthletePacks: number }>;
    aiCreditsUsed: number;
    aiPeriodStart: string;
    aiAlert: boolean;
    reactivationsThisMonth: number;
    reactivationsLimit: number;
  };
  stripeConfigured: boolean;
  catalog: PlanCatalog;
}

interface PlanContextValue {
  plan: PlanOverview | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<PlanOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: PlanOverview }>('/billing/entitlements');
      setPlan(res.data);
    } catch {
      // Vedi la nota in testa al file: senza dati si torna al comportamento
      // di prima, non si blocca niente.
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <PlanContext.Provider value={{ plan, loading, refresh }}>{children}</PlanContext.Provider>;
}

/** Fuori dal provider (pagine di accesso, landing) restituisce un valore vuoto. */
export function usePlan(): PlanContextValue {
  return useContext(PlanContext) ?? { plan: null, loading: false, refresh: async () => {} };
}

/**
 * La funzione e' disponibile? Vero finche' non si sa il contrario: un piano
 * non applicato (interruttore spento, account storico) o non ancora letto
 * non toglie niente.
 */
export function useFeatureAvailable(feature: PlanFeature): boolean {
  const { plan } = usePlan();
  if (!plan || !plan.enforced) return true;
  return plan.features[feature] !== false;
}
