'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, Globe } from 'lucide-react';
import {
  LOCALES,
  DEFAULT_LOCALE,
  localeLabels,
  localeShortLabels,
  useLocaleStore,
  type Locale,
} from '@/lib/i18n/store';

/**
 * Selettore lingua condiviso fra landing e pagine di autenticazione.
 *
 * Scrive sempre sullo store globale (`useLocaleStore`), che persiste la scelta
 * in localStorage e — se l'utente e' gia' autenticato — la propaga al profilo.
 * E' questo che fa "sopravvivere" la lingua al passaggio landing -> login.
 */
export function LangSwitcher({ className = '' }: { className?: string }) {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Evita il mismatch di idratazione: in SSR non conosciamo localStorage,
  // quindi fino al mount mostriamo l'etichetta della lingua di default.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function escHandler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, []);

  const active: Locale = mounted ? locale : DEFAULT_LOCALE;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Select language"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <Globe className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
        {localeShortLabels[active]}
        <ChevronDown
          className={`h-3 w-3 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[140px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLocale(l);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-xs transition hover:bg-slate-50 dark:hover:bg-slate-700 ${
                active === l
                  ? 'font-semibold text-teal-700 dark:text-teal-400'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="font-mono text-[0.65rem] text-slate-400">
                  {localeShortLabels[l]}
                </span>
                {localeLabels[l]}
              </span>
              {active === l && <CheckCircle2 className="h-3 w-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
