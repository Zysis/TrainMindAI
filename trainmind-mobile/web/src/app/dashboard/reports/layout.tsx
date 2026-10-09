import { FeatureGate } from '@/components/plan/feature-gate';

/**
 * Tutta la sezione Report (generatore, invii programmati, giornaliero e
 * post-partita) e' fuori dalla prova gratuita: vedi apps/api/src/lib/plans.ts.
 * Giornaliero e post-partita hanno anche il proprio cancello (Starter).
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="reports">{children}</FeatureGate>;
}
