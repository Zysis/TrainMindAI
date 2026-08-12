/**
 * Cookie-consent store — conforme alle Linee guida Garante 10 giugno 2021.
 *
 * Regole recepite:
 *  - Nessun cookie non tecnico prima del consenso.
 *  - Tre azioni equivalenti nel banner: "Accetta", "Rifiuta", "Personalizza".
 *  - La chiusura del banner con "X" equivale al rifiuto (mantenimento dei soli tecnici).
 *  - La scelta è memorizzata per 6 mesi e non si ripropone il banner in quel periodo,
 *    salvo cambi sostanziali di condizioni (bump di CONSENT_VERSION) o cancellazione locale.
 *  - Ogni scelta è opzionale (revocabile) e distinta per categoria.
 */

export const CONSENT_STORAGE_KEY = 'trainmind-cookie-consent';
export const CONSENT_VERSION = '2026-07-21-v2.0';
export const CONSENT_RESHOW_MONTHS = 6;

export type CookieCategory = 'necessary' | 'analytics' | 'marketing';

export interface CookieConsent {
  version: string;
  categories: Record<CookieCategory, boolean>;
  decidedAt: string; // ISO timestamp
  language: 'it' | 'en' | 'es';
  userAgent: string;
}

export const DEFAULT_CONSENT: Record<CookieCategory, boolean> = {
  necessary: true, // sempre attivi (tecnici)
  analytics: false,
  marketing: false,
};

export function loadConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsent;
    if (parsed.version !== CONSENT_VERSION) return null; // condizioni cambiate — riproporre
    const decided = new Date(parsed.decidedAt);
    const now = new Date();
    const monthsElapsed =
      (now.getFullYear() - decided.getFullYear()) * 12 +
      (now.getMonth() - decided.getMonth());
    if (monthsElapsed >= CONSENT_RESHOW_MONTHS) return null; // 6 mesi — riproporre
    return parsed;
  } catch {
    return null;
  }
}

export function saveConsent(categories: Record<CookieCategory, boolean>, language: 'it' | 'en' | 'es') {
  if (typeof window === 'undefined') return;
  const consent: CookieConsent = {
    version: CONSENT_VERSION,
    categories: { ...categories, necessary: true },
    decidedAt: new Date().toISOString(),
    language,
    userAgent: navigator.userAgent,
  };
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
  // Emit event so listeners (analytics loaders) can react.
  window.dispatchEvent(new CustomEvent('trainmind:cookie-consent-updated', { detail: consent }));
}

export function clearConsent() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CONSENT_STORAGE_KEY);
}

/**
 * Restituisce le stringhe UI localizzate. Semplice e statico (evita dipendenze
 * dal sistema i18n al primo caricamento).
 */
export const COPY = {
  it: {
    heading: 'Rispettiamo la tua privacy',
    body: 'Usiamo cookie tecnici indispensabili per farti usare TrainMind. Con il tuo consenso usiamo anche cookie analitici e di marketing per migliorare il prodotto. Puoi accettare, rifiutare o scegliere solo alcune categorie. Puoi cambiare idea in qualunque momento dal link "Preferenze cookie" nel footer.',
    accept: 'Accetta tutto',
    reject: 'Rifiuta tutto',
    customize: 'Personalizza',
    save: 'Salva preferenze',
    close: 'Chiudi',
    catNecessary: 'Necessari (sempre attivi)',
    catAnalytics: 'Analitici',
    catMarketing: 'Marketing',
    catNecessaryDesc: 'Autenticazione, sicurezza, preferenze essenziali. Senza di essi il Servizio non funziona.',
    catAnalyticsDesc: 'Statistiche aggregate per migliorare il prodotto (es. Google Analytics 4).',
    catMarketingDesc: 'Pubblicità personalizzata e retargeting (es. Meta Pixel).',
    policyLink: 'Cookie Policy',
    privacyLink: 'Informativa Privacy',
  },
  en: {
    heading: 'We respect your privacy',
    body: 'We use strictly necessary cookies so you can use TrainMind. With your consent we also use analytics and marketing cookies to improve the product. You can accept, reject, or pick only some categories. You can change your mind any time via "Cookie preferences" in the footer.',
    accept: 'Accept all',
    reject: 'Reject all',
    customize: 'Customize',
    save: 'Save preferences',
    close: 'Close',
    catNecessary: 'Necessary (always on)',
    catAnalytics: 'Analytics',
    catMarketing: 'Marketing',
    catNecessaryDesc: 'Authentication, security, essential preferences. Without these the Service does not work.',
    catAnalyticsDesc: 'Aggregate stats to improve the product (e.g. Google Analytics 4).',
    catMarketingDesc: 'Personalised ads and retargeting (e.g. Meta Pixel).',
    policyLink: 'Cookie Policy',
    privacyLink: 'Privacy Policy',
  },
  es: {
    heading: 'Respetamos tu privacidad',
    body: 'Usamos cookies estrictamente necesarias para que puedas usar TrainMind. Con tu consentimiento también usamos cookies analíticas y de marketing para mejorar el producto. Puedes aceptar, rechazar o elegir solo algunas categorías. Puedes cambiar de opinión en cualquier momento desde "Preferencias de cookies" en el pie de página.',
    accept: 'Aceptar todo',
    reject: 'Rechazar todo',
    customize: 'Personalizar',
    save: 'Guardar preferencias',
    close: 'Cerrar',
    catNecessary: 'Necesarias (siempre activas)',
    catAnalytics: 'Analíticas',
    catMarketing: 'Marketing',
    catNecessaryDesc: 'Autenticación, seguridad, preferencias esenciales. Sin ellas el Servicio no funciona.',
    catAnalyticsDesc: 'Estadísticas agregadas para mejorar el producto (p. ej. Google Analytics 4).',
    catMarketingDesc: 'Publicidad personalizada y retargeting (p. ej. Meta Pixel).',
    policyLink: 'Política de Cookies',
    privacyLink: 'Política de Privacidad',
  },
} as const;
