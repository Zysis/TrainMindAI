// ─── Versioni correnti dei documenti legali ───────────────
// Quando un documento cambia in modo sostanziale, aggiorna QUI la versione
// (e il contenuto delle pagine /privacy e /terms nel web e nell'app atleti).
// Ogni accettazione viene salvata in ConsentRecord con la versione corrente.

export const LEGAL_VERSIONS = {
  TERMS: '2026-07-21-v2.0',
  PRIVACY: '2026-07-21-v2.0',
  PRIVACY_ATHLETE: '2026-07-21-v2.0',
  HEALTH_DATA: '2026-07-21-v2.0',
  COOKIES: '2026-07-21-v2.0',
  MARKETING: '2026-07-21-v2.0',
} as const;

export type ConsentDocType =
  | 'TERMS'
  | 'PRIVACY_ACK'
  | 'PRIVACY_ATHLETE_ACK'
  | 'HEALTH_DATA'
  | 'AGE_DECLARATION'
  | 'MARKETING'
  | 'COOKIES';

// Documenti la cui accettazione (o presa visione) è OBBLIGATORIA per la registrazione.
// I documenti "facoltativi" (es. MARKETING) sono opt-in separati.
export const REQUIRED_CONSENTS_ON_REGISTER: ConsentDocType[] = [
  'TERMS',
  'PRIVACY_ACK',
  'HEALTH_DATA',
  'AGE_DECLARATION',
];
