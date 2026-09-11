/**
 * Le date vanno formattate nella lingua scelta dall'utente, non in quella
 * della macchina: prima del 09/09/2026 ogni pagina passava 'it-IT' a
 * `toLocaleDateString`, così un atleta con l'app in inglese o spagnolo
 * leggeva comunque "mercoledì 9 settembre".
 */
const BCP47: Record<string, string> = {
  it: 'it-IT',
  en: 'en-GB',
  es: 'es-ES',
};

export function dateLocale(locale: string): string {
  return BCP47[locale] ?? BCP47.en;
}
