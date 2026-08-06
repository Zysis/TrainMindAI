'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Home, Dumbbell, Heart, Clock, User } from 'lucide-react';

/** `key` punta al testo in messages/{lingua}.json, namespace `nav`. */
const NAV_ITEMS = [
  { href: '/home', key: 'home', icon: Home },
  { href: '/sessions', key: 'sessions', icon: Dumbbell },
  { href: '/wellness', key: 'wellness', icon: Heart },
  { href: '/history', key: 'history', icon: Clock },
  { href: '/profile', key: 'profile', icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations('nav');

  return (
    <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
      <div className="flex items-center justify-around px-2 py-1">
        {NAV_ITEMS.map(({ href, key, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs transition ${
                isActive
                  ? 'text-teal-600 dark:text-teal-400'
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className={isActive ? 'font-semibold' : 'font-medium'}>{t(key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
