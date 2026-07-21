'use client';

import { NextIntlClientProvider } from 'next-intl';
import { useEffect, useState } from 'react';
import { useLocaleStore, type Locale } from './store';

// Static imports for messages — avoids dynamic import issues with Next.js
import itMessages from '@/messages/it.json';
import enMessages from '@/messages/en.json';
import esMessages from '@/messages/es.json';

const allMessages: Record<Locale, Record<string, unknown>> = {
  it: itMessages,
  en: enMessages,
  es: esMessages,
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
  const messages = allMessages[activeLocale] as Record<string, unknown>;

  return (
    <NextIntlClientProvider locale={activeLocale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
