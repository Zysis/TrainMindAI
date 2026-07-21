'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { BottomNav } from '@/components/layout/bottom-nav';
import { AppHeader } from '@/components/layout/app-header';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { checkAuth, isLoggedIn } = useAuthStore();

  useEffect(() => {
    if (!checkAuth()) {
      router.replace('/login');
    }
  }, [checkAuth, router]);

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 pb-20">
        <div className="page-enter">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
