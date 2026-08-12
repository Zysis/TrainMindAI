import { create } from 'zustand';

export type Locale = 'it' | 'en' | 'es';

/** Ordine con cui compaiono nello switcher: prima la lingua di default. */
export const LOCALES: Locale[] = ['en', 'it', 'es'];
export const DEFAULT_LOCALE: Locale = 'en';
const STORAGE_KEY = 'trainmind-locale';
/** Marca una scelta esplicita dell'utente (click sullo switcher), distinta
 *  dal semplice rilevamento automatico della lingua del browser. */
const EXPLICIT_KEY = 'trainmind-locale-explicit';

interface LocaleState {
  locale: Locale;
  /** Cambio lingua avviato dall'utente: persiste in locale e sul profilo. */
  setLocale: (locale: Locale) => void;
  /**
   * Applica la lingua che arriva dal profilo utente (login / bootstrap).
   * Non rimanda nulla al server: eviterebbe un ping-pong inutile.
   */
  applyServerLocale: (locale: string | null | undefined) => void;
}

export function isLocale(value: unknown): value is Locale {
  return value === 'it' || value === 'en' || value === 'es';
}

/**
 * Prima visita: inglese per tutti, indipendentemente dalla lingua del
 * dispositivo. Dalla seconda in poi vince sempre la scelta salvata in
 * localStorage, e per chi ha un account quella salvata sul profilo.
 *
 * Fino all'11/08/2026 qui si leggeva `navigator.languages` per indovinare
 * la lingua: un dispositivo italiano apriva l'app in italiano. È stato
 * tolto di proposito, perché il prodotto si presenta in inglese. Chi vuole
 * l'italiano lo sceglie dallo switcher, e da lì in poi se lo ritrova.
 */
function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (isLocale(stored)) return stored;
  return DEFAULT_LOCALE;
}

/** Lingua corrente leggibile fuori da React (es. al momento del login). */
export function readStoredLocale(): Locale {
  return getInitialLocale();
}

/**
 * true se l'utente ha scelto la lingua a mano (landing o pagine di login).
 * In quel caso la sua scelta ha la precedenza su quella salvata a profilo.
 */
export function hasExplicitLocale(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(EXPLICIT_KEY) === '1';
  } catch {
    return false;
  }
}

function persistLocale(locale: Locale, explicit = false): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
    if (explicit) localStorage.setItem(EXPLICIT_KEY, '1');
  } catch {
    /* storage pieno o disabilitato: la lingua resta valida per la sessione */
  }
}

/**
 * Invia la lingua al profilo utente. Silenzioso di proposito: se l'utente non
 * e' loggato o la rete fallisce, la preferenza resta comunque in localStorage.
 */
export async function pushLocaleToServer(locale: Locale): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const { getAccessToken } = await import('@/lib/auth/api');
    const token = getAccessToken();
    if (!token) return;

    const { API_BASE_URL, API_PREFIX } = await import('@/lib/constants');
    await fetch(`${API_BASE_URL}${API_PREFIX}/auth/locale`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ locale }),
    });
  } catch {
    /* non bloccante */
  }
}

export const useLocaleStore = create<LocaleState>((set, get) => ({
  locale: getInitialLocale(),
  setLocale: (locale) => {
    persistLocale(locale, true);
    set({ locale });
    void pushLocaleToServer(locale);
  },
  applyServerLocale: (locale) => {
    if (!isLocale(locale)) return;
    persistLocale(locale);
    if (get().locale !== locale) set({ locale });
  },
}));

export const localeLabels: Record<Locale, string> = {
  it: 'Italiano',
  en: 'English',
  es: 'Español',
};

export const localeFlags: Record<Locale, string> = {
  it: '🇮🇹',
  en: '🇬🇧',
  es: '🇪🇸',
};

/** Etichetta breve per lo switcher compatto. */
export const localeShortLabels: Record<Locale, string> = {
  it: 'IT',
  en: 'EN',
  es: 'ES',
};
