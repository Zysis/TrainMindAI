'use client';

import { useEffect, useState } from 'react';

/**
 * SSR-safe matchMedia-based hook.
 * Returns true when viewport width is below `breakpoint` (default 768px = Tailwind `md`).
 * During SSR returns `false` so server output matches desktop layout; the effect
 * re-evaluates on mount.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile('matches' in e ? e.matches : (mq.matches));
    };
    handler(mq);
    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    // Safari < 14 fallback
    mq.addListener(handler as (e: MediaQueryListEvent) => void);
    return () => mq.removeListener(handler as (e: MediaQueryListEvent) => void);
  }, [breakpoint]);

  return isMobile;
}

/** Tablet: 768–1023px */
export function useIsTablet(): boolean {
  const [isTablet, setIsTablet] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
    const handler = () => setIsTablet(mq.matches);
    handler();
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);
  return isTablet;
}
