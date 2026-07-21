import { create } from 'zustand';

export type Locale = 'it' | 'en' | 'es';

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'it';
  const stored = localStorage.getItem('trainmind-locale');
  if (stored === 'it' || stored === 'en' || stored === 'es') return stored;
  return 'it';
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: getInitialLocale(),
  setLocale: (locale) => {
    localStorage.setItem('trainmind-locale', locale);
    set({ locale });
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
