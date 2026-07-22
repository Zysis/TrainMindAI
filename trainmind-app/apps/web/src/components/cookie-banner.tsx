'use client';

/**
 * Cookie banner conforme alle Linee guida del Garante 10 giugno 2021.
 *
 * Struttura visiva:
 *  - "Accetta tutto", "Rifiuta tutto", "Personalizza" hanno lo stesso peso grafico
 *    (nessuna evidenza deceptive di "Accetta").
 *  - "X" in alto equivale a "Rifiuta tutto".
 *  - Nel pannello "Personalizza" ogni categoria è opt-in con descrizione chiara.
 *  - Il link "Preferenze cookie" nel footer riapre il banner (v. openCookiePreferences).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocaleStore } from '@/lib/i18n/store';
import {
  loadConsent,
  saveConsent,
  clearConsent,
  DEFAULT_CONSENT,
  COPY,
  type CookieCategory,
} from '@/lib/cookie-consent/store';

const OPEN_EVENT = 'trainmind:open-cookie-preferences';

/** Utility richiamabile dal footer per riaprire il banner. */
export function openCookiePreferences() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function CookieBanner() {
  const locale = useLocaleStore((s) => s.locale);
  const t = COPY[locale] ?? COPY.it;

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [choices, setChoices] = useState<Record<CookieCategory, boolean>>(DEFAULT_CONSENT);

  useEffect(() => {
    setMounted(true);
    const existing = loadConsent();
    if (!existing) setVisible(true);
    else setChoices(existing.categories);

    const onReopen = () => {
      const current = loadConsent();
      setChoices(current?.categories ?? DEFAULT_CONSENT);
      setCustomize(true);
      setVisible(true);
    };
    window.addEventListener(OPEN_EVENT, onReopen);
    return () => window.removeEventListener(OPEN_EVENT, onReopen);
  }, []);

  if (!mounted || !visible) return null;

  const acceptAll = () => {
    saveConsent({ necessary: true, analytics: true, marketing: true }, locale);
    setVisible(false);
    setCustomize(false);
  };
  const rejectAll = () => {
    saveConsent({ necessary: true, analytics: false, marketing: false }, locale);
    setVisible(false);
    setCustomize(false);
  };
  const saveCurrent = () => {
    saveConsent(choices, locale);
    setVisible(false);
    setCustomize(false);
  };
  // "X" equivale a Rifiuta (Linee guida Garante 2021).
  const closeAsReject = () => rejectAll();

  const toggle = (cat: CookieCategory) => {
    if (cat === 'necessary') return; // sempre attivo
    setChoices((c) => ({ ...c, [cat]: !c[cat] }));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-banner-heading"
      className="fixed inset-x-0 bottom-0 z-[1000] flex justify-center px-4 pb-4"
    >
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={closeAsReject}
          aria-label={t.close}
          className="absolute right-3 top-3 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>

        <h2 id="cookie-banner-heading" className="text-lg font-semibold text-slate-900">
          {t.heading}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{t.body}</p>

        <p className="mt-2 text-xs text-slate-500">
          <Link href="/cookies" className="underline hover:text-slate-700">
            {t.policyLink}
          </Link>
          {' · '}
          <Link href="/privacy" className="underline hover:text-slate-700">
            {t.privacyLink}
          </Link>
        </p>

        {customize && (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            <CategoryRow
              label={t.catNecessary}
              desc={t.catNecessaryDesc}
              checked
              disabled
              onChange={() => toggle('necessary')}
            />
            <CategoryRow
              label={t.catAnalytics}
              desc={t.catAnalyticsDesc}
              checked={choices.analytics}
              onChange={() => toggle('analytics')}
            />
            <CategoryRow
              label={t.catMarketing}
              desc={t.catMarketingDesc}
              checked={choices.marketing}
              onChange={() => toggle('marketing')}
            />
          </div>
        )}

        {/* Tre azioni con peso equivalente (Garante 2021) */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={rejectAll} className="btn-secondary flex-1 sm:flex-none">
            {t.reject}
          </button>
          {!customize ? (
            <button type="button" onClick={() => setCustomize(true)} className="btn-secondary flex-1 sm:flex-none">
              {t.customize}
            </button>
          ) : (
            <button type="button" onClick={saveCurrent} className="btn-secondary flex-1 sm:flex-none">
              {t.save}
            </button>
          )}
          <button type="button" onClick={acceptAll} className="btn-primary flex-1 sm:flex-none">
            {t.accept}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryRow({
  label,
  desc,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600 disabled:opacity-60"
      />
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
    </label>
  );
}

// Convenience export per il footer/consent-manager esterno che vuole azzerare il consenso.
export { clearConsent };
