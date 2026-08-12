'use client';

import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { useEffect, useState } from 'react';
import { useLocaleStore, DEFAULT_LOCALE, type Locale } from './store';

// Import statici: evitano i problemi di dynamic import con Next.js.
import itMessages from '@/messages/it.json';
import enMessages from '@/messages/en.json';
import esMessages from '@/messages/es.json';

const allMessages: Record<Locale, AbstractIntlMessages> = {
  it: itMessages as unknown as AbstractIntlMessages,
  en: enMessages as unknown as AbstractIntlMessages,
  es: esMessages as unknown as AbstractIntlMessages,
};

/**
 * Fuso orario di default.
 *
 * Senza questo, `use-intl` emette ENVIRONMENT_FALLBACK durante il prerender:
 * il server userebbe il fuso della macchina e il browser quello dell'utente,
 * producendo markup diversi sulle date. Fissarlo elimina il disallineamento.
 */
const DEFAULT_TIME_ZONE = 'Europe/Rome';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocaleStore((s) => s.locale);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // In SSR non conosciamo localStorage: partiamo da 'it' e passiamo alla
  // lingua reale al primo mount, evitando errori di idratazione.
  const activeLocale = mounted ? locale : DEFAULT_LOCALE;

  return (
    <NextIntlClientProvider
      locale={activeLocale}
      messages={allMessages[activeLocale]}
      timeZone={DEFAULT_TIME_ZONE}
    >
      {children}
    </NextIntlClientProvider>
  );
}
