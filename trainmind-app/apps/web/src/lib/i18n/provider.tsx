'use client';

import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { useEffect, useState } from 'react';
import { useLocaleStore, type Locale } from './store';

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

  // SSR: default to 'it' until mounted
  const activeLocale = mounted ? locale : 'it';
  const messages = allMessages[activeLocale];

  return (
    <NextIntlClientProvider locale={activeLocale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
