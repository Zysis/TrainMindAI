'use client';

import { useSidebar } from '@/lib/sidebar/context';
import { cn } from '@trainmind/ui';

export function DashboardMain({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <main
      className={cn(
        'pt-[var(--topbar-height)] transition-[margin-left] duration-300',
        collapsed ? 'ml-[var(--sidebar-collapsed-width)]' : 'ml-[var(--sidebar-width)]',
      )}
    >
      {children}
    </main>
  );
}
