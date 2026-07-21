'use client';

import { useEffect, useState, useRef } from 'react';
import { Bell, Search, ChevronDown, CheckCheck, AlertTriangle, Info, XCircle, CheckCircle2, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useSidebar } from '@/lib/sidebar/context';
import { cn } from '@trainmind/ui';
import { getInitials } from '@trainmind/utils';
import { apiFetch } from '@/lib/auth/fetch';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { PlanBadge } from '@/components/brand/plan-badge';

interface Notification {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data: Record<string, unknown> | null;
  alertRule: { name: string; type: string } | null;
}

const severityIcons: Record<string, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  danger: XCircle,
  success: CheckCircle2,
};

const severityColors: Record<string, string> = {
  info: 'text-blue-500 bg-blue-50',
  warning: 'text-amber-500 bg-amber-50',
  danger: 'text-red-500 bg-red-50',
  success: 'text-green-500 bg-green-50',
};

export function Topbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const t = useTranslations('topbar');
  const locale = useLocale();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const initials = user ? getInitials(user.firstName, user.lastName) : '??';
  const fullName = user ? `${user.firstName} ${user.lastName}` : t('user');
  const role = user?.role || '';

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const res = await apiFetch<{ data: { count: number } }>('/notifications/unread-count');
      setUnreadCount(res.data.count);
    } catch { /* ignore */ }
  };

  // Fetch notifications for dropdown
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: Notification[] }>('/notifications?limit=8');
      setNotifications(res.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  // Poll unread count + listen for external changes
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // ogni 30s

    // Sync when alerts page marks notifications as read
    const onSync = () => { fetchUnreadCount(); if (showDropdown) fetchNotifications(); };
    window.addEventListener('notifications-changed', onSync);

    return () => { clearInterval(interval); window.removeEventListener('notifications-changed', onSync); };
  }, [showDropdown]);

  // Load notifications when dropdown opens
  useEffect(() => {
    if (showDropdown) fetchNotifications();
  }, [showDropdown]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PUT', body: JSON.stringify({}) });
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
      window.dispatchEvent(new Event('notifications-changed'));
    } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    try {
      await apiFetch('/notifications/read-all', { method: 'PUT', body: JSON.stringify({}) });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      window.dispatchEvent(new Event('notifications-changed'));
    } catch { /* ignore */ }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return t('timeNow');
    if (diffMin < 60) return t('timeMinutes', { count: diffMin });
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return t('timeHours', { count: diffH });
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return t('timeDays', { count: diffD });
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };

  const { collapsed } = useSidebar();

  return (
    <header className={cn(
      "fixed right-0 top-0 z-30 flex h-[var(--topbar-height)] items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 transition-[left] duration-300 dark:border-slate-700 dark:bg-slate-900",
      collapsed ? 'left-[var(--sidebar-collapsed-width)]' : 'left-[var(--sidebar-width)]',
    )}>
      {/* Search */}
      <div className="flex w-full max-w-md items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
        <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          placeholder={t('search')}
          className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 dark:text-slate-500 focus:outline-none dark:text-slate-200 dark:placeholder:text-slate-500 dark:text-slate-400"
        />
        <kbd className="hidden rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-1.5 py-0.5 text-2xs font-medium text-slate-500 dark:text-slate-400 sm:inline-block dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400">
          ⌘K
        </kbd>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {/* Plan badge (START · PRO · ULTRA) */}
        <PlanBadge />

        {/* Notifications */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="relative rounded-lg p-2 text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-2xs font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-96 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl dark:border-slate-700 dark:bg-slate-800">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 px-4 py-3 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('notifications')}</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      {t('markAllRead')}
                    </button>
                  )}
                </div>
              </div>

              {/* Notification list */}
              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="flex h-24 items-center justify-center">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex h-24 items-center justify-center">
                    <p className="text-sm text-slate-400 dark:text-slate-500">{t('noNotifications')}</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const Icon = severityIcons[n.severity] || Info;
                    const colors = severityColors[n.severity] || severityColors.info;
                    return (
                      <div
                        key={n.id}
                        onClick={() => !n.isRead && markAsRead(n.id)}
                        className={`flex gap-3 px-4 py-3 border-b border-slate-50 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:hover:bg-slate-700 ${!n.isRead ? 'bg-teal-50/30 dark:bg-teal-900/20' : ''}`}
                      >
                        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${colors}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm ${!n.isRead ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                              {n.title}
                            </p>
                            {!n.isRead && (
                              <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-teal-500" />
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 dark:text-slate-400">{n.message}</p>
                          <p className="mt-1 text-2xs text-slate-400 dark:text-slate-500">{formatTime(n.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-2.5 dark:border-slate-700">
                <Link
                  href="/dashboard/alerts"
                  onClick={() => setShowDropdown(false)}
                  className="block text-center text-xs font-medium text-teal-700 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300"
                >
                  {t('viewAll')}
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-800"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white">
              {initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{fullName}</p>
              <p className="text-2xs text-slate-500 dark:text-slate-400">{role}</p>
            </div>
            <ChevronDown className={cn('h-4 w-4 text-slate-400 dark:text-slate-500 transition-transform dark:text-slate-500', showUserMenu && 'rotate-180')} />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-xl dark:border-slate-700 dark:bg-slate-800">
              <div className="border-b border-slate-100 dark:border-slate-700 px-4 py-3 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{fullName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => { setShowUserMenu(false); router.push('/dashboard/settings'); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <Settings className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  {t('settings')}
                </button>
                <button
                  onClick={() => { setShowUserMenu(false); logout(); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <LogOut className="h-4 w-4" />
                  {t('logout')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
