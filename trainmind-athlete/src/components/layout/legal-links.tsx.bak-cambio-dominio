'use client';

/**
 * Link ai documenti legali, nella lingua scelta dall'atleta.
 *
 * Attenzione alla differenza di ruoli, che spiega perché i link non puntano
 * tutti allo stesso posto:
 *  - l'**informativa privacy per gli atleti** vive in questa app, perché il
 *    Titolare del trattamento è la società sportiva e TrainMind è il
 *    Responsabile ex art. 28 GDPR;
 *  - **Termini** e **Cookie** sono quelli della piattaforma e stanno sul
 *    dominio principale.
 */

import { useTranslations } from 'next-intl';

/** Dominio della web app: sovrascrivibile con NEXT_PUBLIC_APP_WEB_URL. */
const APP_WEB_URL =
  process.env.NEXT_PUBLIC_APP_WEB_URL || 'https://app.trainmind-app.com';

export function LegalLinks({ className = '' }: { className?: string }) {
  const t = useTranslations('legal');

  return (
    <nav
      aria-label={t('title')}
      className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-400 dark:text-slate-500 ${className}`}
    >
      <a href="/privacy" className="underline-offset-2 hover:text-teal-600 hover:underline">
        {t('privacy')}
      </a>
      <a
        href={`${APP_WEB_URL}/terms`}
        target="_blank"
        rel="noreferrer"
        className="underline-offset-2 hover:text-teal-600 hover:underline"
      >
        {t('terms')}
      </a>
      <a
        href={`${APP_WEB_URL}/cookies`}
        target="_blank"
        rel="noreferrer"
        className="underline-offset-2 hover:text-teal-600 hover:underline"
      >
        {t('cookies')}
      </a>
    </nav>
  );
}
