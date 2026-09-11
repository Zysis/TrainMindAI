/** Formattazioni condivise. Tutto in italiano: la console la legge una persona sola. */

const DATE = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
const DATETIME = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const MONTH = new Intl.DateTimeFormat('it-IT', { month: 'short', year: '2-digit' });
const NUM = new Intl.NumberFormat('it-IT');

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? '—' : DATE.format(date);
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? '—' : DATETIME.format(date);
}

export function fmtMonth(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : MONTH.format(date);
}

export function fmtNum(v: number | null | undefined): string {
  return NUM.format(v ?? 0);
}

export function fmtPct(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${v.toFixed(digits).replace('.', ',')}%`;
}

export function fmtUsd(v: number | null | undefined): string {
  const value = v ?? 0;
  // Sotto il centesimo un "$0.00" sembrerebbe zero speso: mostro piu' decimali.
  const digits = value > 0 && value < 0.01 ? 4 : 2;
  return `$${value.toFixed(digits).replace('.', ',')}`;
}

/** "3 giorni fa", per la colonna ultima attivita'. */
export function fmtAgo(d: Date | string | null | undefined): string {
  if (!d) return 'mai';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return 'mai';
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'oggi';
  if (days === 1) return 'ieri';
  if (days < 30) return `${days} giorni fa`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mes${months === 1 ? 'e' : 'i'} fa`;
  const years = Math.floor(months / 12);
  return `${years} ann${years === 1 ? 'o' : 'i'} fa`;
}

const TIER_LABEL: Record<string, string> = {
  STARTER: 'Starter',
  PROFESSIONAL: 'Professional',
  ULTRA: 'Ultra',
};

export function fmtTier(tier: string | null | undefined): string {
  if (!tier) return '—';
  return TIER_LABEL[tier] ?? tier;
}

const LOCALE_LABEL: Record<string, string> = { it: 'Italiano', en: 'Inglese', es: 'Spagnolo' };

export function fmtLocale(locale: string | null | undefined): string {
  if (!locale) return 'Non indicata';
  return LOCALE_LABEL[locale] ?? locale;
}
