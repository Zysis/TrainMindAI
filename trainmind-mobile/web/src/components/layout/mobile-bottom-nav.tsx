'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Dumbbell,
  Brain,
  Menu as MenuIcon,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@trainmind/ui';
import { useSidebar } from '@/lib/sidebar/context';

interface BottomNavItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  action?: 'menu';
  matchPrefix?: string;
}

const items: BottomNavItem[] = [
  { label: 'dashboard', href: '/dashboard', icon: LayoutDashboard, matchPrefix: '/dashboard' },
  { label: 'calendar', href: '/dashboard/calendar', icon: Calendar },
  { label: 'teams', href: '/dashboard/teams', icon: Users },
  { label: 'training', href: '/dashboard/training', icon: Dumbbell },
  { label: 'aiChat', href: '/dashboard/chat', icon: Brain },
];

// Render only on screens < md (handled by parent wrapper class)
export function MobileBottomNav() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const { openMobile } = useSidebar();

  return (
    <nav
      aria-label="Bottom navigation"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-30 md:hidden',
        'border-t border-slate-200 bg-white/95 backdrop-blur',
        'dark:border-slate-700 dark:bg-slate-900/95',
        'pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <ul className="flex h-[var(--bottom-nav-height,56px)] items-stretch justify-around">
        {items.map((item) => {
          const isActive = item.href
            ? pathname === item.href
              || (item.matchPrefix
                ? pathname === item.matchPrefix
                : pathname.startsWith(item.href + '/'))
            : false;
          // Special: dashboard root match (not all /dashboard/*)
          const dashboardRoot = item.label === 'dashboard' && pathname === '/dashboard';
          const active = item.label === 'dashboard' ? dashboardRoot : isActive;

          const Icon = item.icon;
          const content = (
            <span
              className={cn(
                'flex h-full min-w-[64px] flex-col items-center justify-center gap-0.5 px-2 py-1',
                'text-[10px] font-medium leading-tight',
                'transition-colors',
                active
                  ? 'text-teal-600 dark:text-teal-400'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
              <span className="max-w-[64px] truncate">{t(item.label)}</span>
            </span>
          );

          return (
            <li key={item.label} className="flex-1">
              {item.href ? (
                <Link
                  href={item.href}
                  className="flex h-full w-full items-stretch justify-center"
                  aria-current={active ? 'page' : undefined}
                >
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={openMobile}
                  className="flex h-full w-full items-stretch justify-center"
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Floating "More" button when bottom nav already has 5 primary items.
 *  Kept as separate export in case design wants 4 + dedicated Menu.
 */
export function MobileMoreButton() {
  const { openMobile } = useSidebar();
  const t = useTranslations('nav');
  return (
    <button
      type="button"
      onClick={openMobile}
      className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      aria-label={t('menu') as string}
    >
      <MenuIcon className="h-5 w-5" />
    </button>
  );
}
