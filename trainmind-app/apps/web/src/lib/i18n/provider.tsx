'use client';

import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { useEffect, useState } from 'react';
import { useLocaleStore, DEFAULT_LOCALE, type Locale } from './store';

// Static imports for messages — avoids dynamic import issues with Next.js
import itMessages from '@/messages/it.json';
import enMessages from '@/messages/en.json';
import esMessages from '@/messages/es.json';

// Cast via `unknown` necessario: i file di messaggi contengono array
// (es. moodLabels, sleepLabels) che non rientrano nella signature
// `AbstractIntlMessages = Record<string, string | AbstractIntlMessages>`
// ma sono comunque gestiti correttamente da next-intl a runtime.
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

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update html lang attribute
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // SSR: si parte dalla lingua di default finché non è montato, perché il
  // server non può leggere localStorage. Deve combaciare con il `lang`
  // dell'<html> in layout.tsx, altrimenti l'idratazione segnala un
  // disallineamento.
  const activeLocale = mounted ? locale : DEFAULT_LOCALE;
  const messages = allMessages[activeLocale];

  return (
    <NextIntlClientProvider
      locale={activeLocale}
      messages={messages}
      timeZone={DEFAULT_TIME_ZONE}
    >
      {children}
    </NextIntlClientProvider>
  );
}
