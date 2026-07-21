'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Dumbbell,
  BookOpen,
  MessageSquare,
  BarChart3,
  Heart,
  Activity,
  Bell,
  Brain,
  Layers,
  Shield,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@trainmind/ui';
import { useTeam } from '@/hooks/use-team';
import { useAuth } from '@/hooks/use-auth';
import { useSidebar } from '@/lib/sidebar/context';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useState, useRef, useEffect } from 'react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { tierToPlanKey, tierToPlanSlug } from '@/components/brand/plan';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  tourId?: string;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { label: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'calendar', href: '/dashboard/calendar', icon: Calendar },
  { label: 'teams', href: '/dashboard/teams', icon: Users, tourId: 'nav-athletes' },
  {
    label: 'training', href: '/dashboard/training', icon: Dumbbell, tourId: 'nav-training',
    children: [
      { label: 'periodization', href: '/dashboard/periodization', icon: Layers },
      { label: 'mesocycles', href: '/dashboard/training', icon: Dumbbell },
      { label: 'sessions', href: '/dashboard/sessions', icon: ClipboardList },
      { label: 'exercises', href: '/dashboard/exercises', icon: BookOpen },
    ],
  },
  { label: 'wellness', href: '/dashboard/wellness', icon: Heart },
  { label: 'injuries', href: '/dashboard/injuries', icon: Shield },
  {
    label: 'analysisReports', href: '/dashboard/analytics', icon: BarChart3,
    children: [
      { label: 'analytics', href: '/dashboard/analytics', icon: Activity },
      { label: 'reports', href: '/dashboard/reports', icon: BarChart3 },
    ],
  },
  { label: 'alerts', href: '/dashboard/alerts', icon: Bell },
  {
    label: 'aiAssistant', href: '/dashboard/chat', icon: Brain,
    children: [
      { label: 'aiChat', href: '/dashboard/chat', icon: MessageSquare },
      { label: 'aiAdaptations', href: '/dashboard/adaptations', icon: Brain },
    ],
  },
];

const bottomNavItems: NavItem[] = [];

// ─── Team Selector ──────────────────────────────────────

function TeamSelector({ collapsed }: { collapsed: boolean }) {
  const t = useTranslations('nav');
  const { teams, selectedTeam, selectTeam, isLoading } = useTeam();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading || teams.length === 0) {
    if (isLoading && !collapsed) {
      return (
        <div className="mx-3 mb-2 rounded-lg bg-slate-800/50 px-3 py-2">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-700" />
        </div>
      );
    }
    return null;
  }

  if (collapsed) {
    return (
      <div ref={ref} className="relative px-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-center rounded-lg bg-slate-800 p-2.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white dark:text-slate-500"
          title={selectedTeam ? selectedTeam.name : t('allTeams')}
        >
          {selectedTeam?.color ? (
            <span className="h-4 w-4 rounded-full" style={{ backgroundColor: selectedTeam.color }} />
          ) : (
            <Users className="h-5 w-5" />
          )}
        </button>
        {open && (
          <div className="absolute left-full top-0 z-50 ml-2 w-48 rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-xl">
            <button
              onClick={() => { selectTeam(null); setOpen(false); }}
              className={cn('flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-700', !selectedTeam ? 'text-teal-400' : 'text-slate-300')}
            >
              {t('allTeams')}
            </button>
            {teams.map((team) => (
              <button
                key={team.id}
                onClick={() => { selectTeam(team.id); setOpen(false); }}
                className={cn('flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-700', selectedTeam?.id === team.id ? 'text-teal-400' : 'text-slate-300')}
              >
                {team.color && <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />}
                <span className="truncate">{team.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative mx-3 mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-700"
      >
        <span className="flex items-center gap-2 truncate">
          {selectedTeam?.color && (
            <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: selectedTeam.color }} />
          )}
          {selectedTeam ? selectedTeam.name : t('allTeams')}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-slate-400 dark:text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-xl">
          <button
            onClick={() => { selectTeam(null); setOpen(false); }}
            className={cn('flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-700', !selectedTeam ? 'text-teal-400' : 'text-slate-300')}
          >
            {t('allTeams')}
          </button>
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => { selectTeam(team.id); setOpen(false); }}
              className={cn('flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-700', selectedTeam?.id === team.id ? 'text-teal-400' : 'text-slate-300')}
            >
              {team.color && <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: team.color }} />}
              <span className="truncate">{team.name}</span>
              {team._count && <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">{team._count.athleteTeams}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Nav Group (collapsible) ────────────────────────────

function NavGroup({ item, pathname, collapsed, t }: { item: NavItem; pathname: string; collapsed: boolean; t: (key: string) => string }) {
  const childPaths = item.children?.map((c) => c.href) || [];
  const isChildActive = childPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const [open, setOpen] = useState(isChildActive);
  const [popover, setPopover] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isChildActive && !collapsed) setOpen(true);
  }, [isChildActive, collapsed]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setPopover(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (collapsed) {
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setPopover(!popover)}
          title={t(item.label)}
          className={cn(
            'flex w-full items-center justify-center rounded-lg p-2.5 transition-colors',
            isChildActive ? 'bg-teal-600/20 text-teal-400' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-800 hover:text-white',
          )}
        >
          <item.icon className="h-5 w-5" />
        </button>
        {popover && (
          <div className="absolute left-full top-0 z-50 ml-2 w-48 rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-xl">
            <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t(item.label)}</div>
            {item.children?.map((child) => {
              const isActive = pathname === child.href || pathname.startsWith(child.href + '/');
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={() => setPopover(false)}
                  className={cn('flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-700', isActive ? 'text-teal-400' : 'text-slate-300')}
                >
                  <child.icon className="h-4 w-4" />
                  {t(child.label)}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        {...(item.tourId ? { 'data-tour': item.tourId } : {})}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isChildActive ? 'bg-teal-600/20 text-teal-400' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-800 hover:text-white',
        )}
      >
        <item.icon className="h-5 w-5 flex-shrink-0" />
        {t(item.label)}
        <ChevronDown className={cn('ml-auto h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-700 pl-3">
          {item.children?.map((child) => {
            const isActive = pathname === child.href || pathname.startsWith(child.href + '/');
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'text-teal-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-800 hover:text-white',
                )}
              >
                <child.icon className="h-4 w-4 flex-shrink-0" />
                {t(child.label)}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed: collapsedRaw, toggle, mobileOpen, closeMobile } = useSidebar();
  const isMobile = useIsMobile();
  // On mobile, drawer always renders in EXPANDED form (full labels), regardless of stored collapsed
  const collapsed = isMobile ? false : collapsedRaw;
  const t = useTranslations('nav');
  const { user } = useAuth();
  const planKey = tierToPlanKey(user?.organization?.tier);
  const planSlug = tierToPlanSlug(user?.organization?.tier);

  // Auto-close drawer on route change (mobile)
  useEffect(() => {
    if (mobileOpen) closeMobile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Close on Escape (mobile)
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobile();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, closeMobile]);

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={closeMobile}
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-30 bg-black/50 backdrop-blur-sm transition-opacity md:hidden',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
      />
      <aside
        data-tour="sidebar"
        className={cn(
          'fixed left-0 top-0 z-40 flex h-[100dvh] flex-col bg-slate-900 shadow-sidebar',
          'transition-[width,transform] duration-300 ease-out',
          // Width: mobile always 280px, md+ uses var
          'w-[280px] md:w-[var(--sidebar-width)]',
          collapsed && 'md:w-[var(--sidebar-collapsed-width)]',
          // Slide on mobile, always visible md+
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
      {/* Logo */}
      <div className={cn('flex h-[var(--topbar-height)] items-center border-b border-slate-800', collapsed ? 'flex-col justify-center gap-1 px-2 py-2' : 'gap-3 px-6')}>
        <div className="relative flex-shrink-0">
          <BrandLogo tone="dark" plan={planKey} className="h-9 w-9" />
        </div>
        {!collapsed && (
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-white">
              Train<span className="text-teal-400">Mind</span>
            </span>
            {planSlug && (
              <span
                className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-[0.15em] text-amber-500"
                title={`Piano: ${planSlug}`}
              >
                {planSlug}
              </span>
            )}
          </div>
        )}
        {collapsed && planSlug && (
          <span
            className="rounded-sm bg-amber-500/10 px-1 py-px text-[0.55rem] font-extrabold uppercase tracking-[0.1em] text-amber-500"
            title={`Piano: ${planSlug}`}
          >
            {planSlug}
          </span>
        )}
      </div>

      {/* Team Selector */}
      <div className="border-b border-slate-800 py-3">
        <TeamSelector collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <nav className={cn('flex-1 space-y-1 overflow-y-auto py-4', collapsed ? 'px-2' : 'px-3')}>
        {navItems.map((item) => {
          if (item.children) {
            return <NavGroup key={item.label} item={item} pathname={pathname} collapsed={collapsed} t={t} />;
          }
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));

          if (collapsed) {
            return (
              <Link
                key={item.href}
                href={item.href}
                title={t(item.label)}
                className={cn(
                  'flex items-center justify-center rounded-lg p-2.5 transition-colors',
                  isActive ? 'bg-teal-600/20 text-teal-400' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-800 hover:text-white',
                )}
              >
                <item.icon className="h-5 w-5" />
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              {...(item.tourId ? { 'data-tour': item.tourId } : {})}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-teal-600/20 text-teal-400' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-800 hover:text-white',
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {t(item.label)}
            </Link>
          );
        })}
      </nav>

      {/* Bottom nav */}
      <div className={cn('border-t border-slate-800 py-3', collapsed ? 'px-2' : 'px-3')}>
        {bottomNavItems.map((item) => {
          const isActive = pathname === item.href;
          if (collapsed) {
            return (
              <Link
                key={item.href}
                href={item.href}
                title={t(item.label)}
                className={cn(
                  'flex items-center justify-center rounded-lg p-2.5 transition-colors',
                  isActive ? 'bg-teal-600/20 text-teal-400' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-800 hover:text-white',
                )}
              >
                <item.icon className="h-5 w-5" />
              </Link>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-teal-600/20 text-teal-400' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-800 hover:text-white',
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {t(item.label)}
            </Link>
          );
        })}

        {/* Toggle button (hidden on mobile drawer) */}
        <button
          onClick={toggle}
          className={cn(
            'mt-2 hidden w-full items-center rounded-lg p-2.5 text-sm font-medium text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-800 hover:text-white md:flex',
            collapsed ? 'justify-center' : 'gap-3 px-3',
          )}
          title={collapsed ? t('expand') : t('collapse')}
        >
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <><ChevronLeft className="h-5 w-5 flex-shrink-0" />{t('collapse')}</>}
        </button>
        {/* Mobile close button */}
        <button
          onClick={closeMobile}
          className="mt-2 flex w-full items-center gap-3 rounded-lg p-2.5 px-3 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-white md:hidden"
          aria-label="Close menu"
        >
          <ChevronLeft className="h-5 w-5 flex-shrink-0" />
          {t('close') /* falls back to key if missing translation */}
        </button>
      </div>
    </aside>
    </>
  );
}
