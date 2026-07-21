'use client';

import { useSidebar } from '@/lib/sidebar/context';
import { cn } from '@trainmind/ui';

export function DashboardMain({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <main
      className={cn(
        'pt-[var(--topbar-height)] transition-[margin-left] duration-300',
        // Mobile: no sidebar margin (drawer overlays). md+: align next to sidebar.
        'ml-0',
        collapsed
          ? 'md:ml-[var(--sidebar-collapsed-width)]'
          : 'md:ml-[var(--sidebar-width)]',
        // Reserve space for fixed bottom nav on mobile (handled via padding to allow scroll to bottom)
        'pb-[calc(var(--bottom-nav-height,56px)+env(safe-area-inset-bottom))] md:pb-0',
        // Safe-area sides (iPhone landscape notch)
        'pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]',
      )}
    >
      {children}
    </main>
  );
}
