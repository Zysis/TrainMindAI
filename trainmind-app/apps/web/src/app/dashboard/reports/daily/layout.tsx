import { FeatureGate } from '@/components/plan/feature-gate';

/** Funzione non inclusa nello Starter: vedi apps/api/src/lib/plans.ts. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="dailyReport">{children}</FeatureGate>;
}
