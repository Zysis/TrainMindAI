import { AuthGuard } from '@/components/layout/auth-guard';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { DashboardMain } from '@/components/layout/dashboard-shell';
import { OfflineBanner } from '@/components/offline/offline-banner';
import { OnboardingTour } from '@/components/onboarding/onboarding-tour';
import { TeamProvider } from '@/lib/team/context';
import { SidebarProvider } from '@/lib/sidebar/context';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <TeamProvider>
        <SidebarProvider>
          <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <Sidebar />
            <Topbar />
            <DashboardMain>
              <OfflineBanner />
              <div className="p-6">{children}</div>
            </DashboardMain>
            <OnboardingTour />
          </div>
        </SidebarProvider>
      </TeamProvider>
    </AuthGuard>
  );
}
