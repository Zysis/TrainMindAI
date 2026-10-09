import { FeatureGate } from '@/components/plan/feature-gate';

/** Adattamenti AI: fuori dalla prova gratuita, vedi apps/api/src/lib/plans.ts. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="adaptations">{children}</FeatureGate>;
}
