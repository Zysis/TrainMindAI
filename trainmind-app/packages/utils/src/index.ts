// ============================================
// TrainMind — Shared Utilities
// ============================================

/**
 * Format a date to locale string (Italian default)
 */
export function formatDate(date: Date | string, locale = 'it-IT'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format a date to ISO date string (YYYY-MM-DD)
 */
export function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth: Date | string): number {
  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/**
 * Calculate sRPE (session Rating of Perceived Exertion)
 * sRPE = RPE * duration (minutes)
 */
export function calculateSRPE(rpe: number, durationMinutes: number): number {
  return rpe * durationMinutes;
}

// ─── ACWR ───────────────────────────────────────────────────────────────
//
// L'unica definizione di ACWR del prodotto. Prima ce n'erano quattro, una per
// rotta (analytics, daily-report, dashboard, game-report) piu' una quinta qui
// dentro che non usava nessuno — e non concordavano. Il 2/9/2026 si e' visto
// a schermo cosa significa: la dashboard diceva "0 atleti valutabili, 38 non
// valutabili" mentre il report giornaliero, sugli stessi atleti e nello stesso
// istante, mostrava ACWR 2,44 in rosso e l'intera rosa Under 14 a 3,00.
//
// Le scelte, tutte discutibili ma da qui in avanti discutibili UNA volta sola:
//
// * Acuto = somma sRPE degli ultimi 7 giorni. Cronico = somma degli ultimi 21
//   riportata a settimana, cioe' divisa per 3. Finestre accoppiate: i 7 giorni
//   acuti stanno dentro i 21 cronici.
// * Il divisore e' SEMPRE 3, perche' il cronico significa "quanto sei abituato
//   a lavorare". Normalizzare sulle settimane davvero coperte darebbe circa
//   1,0 — cioe' "va tutto bene" — a un atleta di cui non si sa niente.
// * Ma proprio per questo, sotto i 14 giorni di storico non si risponde: con
//   tutto il carico nell'ultima settimana il rapporto verrebbe esattamente
//   3,00 per chiunque, e l'intera rosa finirebbe in rosso il giorno dopo aver
//   iniziato a registrare gli RPE. La risposta onesta e' che non si puo' dire.

/** Zone del rapporto acuto/cronico, sulle soglie usate in tutto il prodotto. */
export type AcwrZone = 'low' | 'optimal' | 'high' | 'danger';

/** Una seduta svolta: quando, e quanto e' pesata (sRPE = RPE x minuti). */
export interface AcwrLoadPoint {
  date: Date;
  load: number;
}

export interface AcwrResult {
  /** null quando non si puo' dire: il motivo sta in `notAssessable`. */
  acwr: number | null;
  zone: AcwrZone | null;
  /** Somma sRPE degli ultimi 7 giorni. */
  acuteLoad: number;
  /** Cronico riportato a settimana: somma su 21 giorni divisa 3. */
  chronicLoad: number;
  /** Somma della settimana precedente a quella acuta, per il confronto. */
  previousWeekLoad: number;
  /** `no-load` = nessun carico nelle tre settimane; `short-history` = storico troppo corto. */
  notAssessable: null | 'no-load' | 'short-history';
}

export const ACWR_ACUTE_DAYS = 7;
export const ACWR_CHRONIC_DAYS = 21;
export const ACWR_MIN_HISTORY_DAYS = 14;

const ACWR_DAY_MS = 86_400_000;

/** Le soglie delle zone, in un posto solo. */
export function acwrZone(value: number): AcwrZone {
  if (value < 0.8) return 'low';
  if (value <= 1.3) return 'optimal';
  if (value <= 1.5) return 'high';
  return 'danger';
}

/**
 * ACWR di un atleta a una certa data.
 *
 * Le sedute possono arrivare non filtrate: la funzione si ritaglia da sola le
 * finestre attorno a `asOf`, cosi' chi chiama puo' passare un intervallo piu'
 * largo (serve ad analytics, che fa scorrere `asOf` lungo una serie).
 */
export function computeAcwr(points: AcwrLoadPoint[], asOf: Date = new Date()): AcwrResult {
  const now = asOf.getTime();
  const chronicStart = now - ACWR_CHRONIC_DAYS * ACWR_DAY_MS;
  const acuteStart = now - ACWR_ACUTE_DAYS * ACWR_DAY_MS;
  const previousWeekStart = now - 2 * ACWR_ACUTE_DAYS * ACWR_DAY_MS;

  let acute = 0;
  let chronic = 0;
  let previousWeek = 0;
  let firstSeen: number | null = null;

  for (const point of points) {
    const t = point.date.getTime();
    if (t < chronicStart || t > now) continue;
    chronic += point.load;
    if (firstSeen === null || t < firstSeen) firstSeen = t;
    if (t >= acuteStart) acute += point.load;
    else if (t >= previousWeekStart) previousWeek += point.load;
  }

  const chronicWeekly = chronic / (ACWR_CHRONIC_DAYS / 7);

  if (chronic <= 0 || firstSeen === null) {
    return {
      acwr: null, zone: null, acuteLoad: 0, chronicLoad: 0,
      previousWeekLoad: 0, notAssessable: 'no-load',
    };
  }

  const base = {
    acuteLoad: Math.round(acute),
    chronicLoad: Math.round(chronicWeekly),
    previousWeekLoad: Math.round(previousWeek),
  };

  if ((now - firstSeen) / ACWR_DAY_MS < ACWR_MIN_HISTORY_DAYS) {
    return { ...base, acwr: null, zone: null, notAssessable: 'short-history' };
  }

  const value = Math.round((acute / chronicWeekly) * 100) / 100;
  return { ...base, acwr: value, zone: acwrZone(value), notAssessable: null };
}

/**
 * Punteggio wellness (0-100) a partire dalle cinque voci giornaliere.
 *
 * Su tutte e cinque **5 è la condizione migliore** (Fatica 5 = per niente
 * affaticato), quindi il punteggio è la somma normalizzata: alto = buono.
 * Fino alla migrazione `20260824120000_wellness_scale_flip` Fatica, Dolore e
 * Stress andavano nel verso opposto e qui si ribaltavano con `(6 - x)`:
 * quella riga era rimasta, e su dati odierni ribaltava una seconda volta.
 *
 * Questa è la definizione unica: la usano tutte le rotte dell'API, così lo
 * stesso giorno non può valere 100 per il preparatore e 52 per l'atleta.
 */
export function calculateWellnessScore(params: {
  sleepQuality: number; // 1-5 (5 = ottimo)
  fatigue: number; // 1-5 (5 = per niente affaticato)
  soreness: number; // 1-5 (5 = nessun dolore)
  stress: number; // 1-5 (5 = nessuno stress)
  mood: number; // 1-5 (5 = ottimo)
}): number {
  const { sleepQuality, fatigue, soreness, stress, mood } = params;
  const score = ((sleepQuality + fatigue + soreness + stress + mood) / 25) * 100;
  return Math.round(score);
}

/**
 * Slug generator
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate a random color from a consistent palette
 */
export function getAvatarColor(name: string): string {
  const colors = [
    '#0D9488', '#0F766E', '#14B8A6', '#2DD4BF',
    '#475569', '#64748B', '#94A3B8', '#334155',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Get initials from name
 */
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Sleep/delay utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Giorni di allenamento di un mesociclo
// ============================================
//
// Numerazione ISO: 1 = lunedi', 7 = domenica. La stessa che sta nella colonna
// `training_plans.trainingDays` e nel WeekdayPicker.
//
// Questa regola serve in due posti — l'API che data le sessioni generate
// dall'AI e la pagina del mesociclo che disegna gli slot dei giorni — e vive
// qui perche' due copie finirebbero per divergere.

/** Lunedi' della settimana 1 del piano. */
export function planAnchorMonday(startDate: Date, trainingDays: number[] = []): Date {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const isoDay = start.getDay() === 0 ? 7 : start.getDay();
  const monday = new Date(start);
  monday.setDate(monday.getDate() - (isoDay - 1));

  // Se il primo giorno scelto cadrebbe prima della data di inizio, il piano
  // parte dalla settimana dopo: nessuna sessione datata nel passato.
  const days = normalizeTrainingDays(trainingDays);
  if (days.length > 0 && days[0] < isoDay) {
    monday.setDate(monday.getDate() + 7);
  }
  return monday;
}

/** Ripulisce da valori fuori scala e duplicati, e ordina. */
export function normalizeTrainingDays(days: number[] | null | undefined): number[] {
  if (!days) return [];
  return Array.from(
    new Set(days.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)),
  ).sort((a, b) => a - b);
}

/** Data del giorno `dayIso` nella settimana `weekNumber` (1-based). */
export function trainingDayDate(
  startDate: Date,
  trainingDays: number[],
  weekNumber: number,
  dayIso: number,
): Date {
  const d = planAnchorMonday(startDate, trainingDays);
  d.setDate(d.getDate() + (weekNumber - 1) * 7 + (dayIso - 1));
  return d;
}

/** Tutti i giorni di allenamento di una settimana, in ordine. */
export function weekTrainingDates(
  startDate: Date,
  trainingDays: number[],
  weekNumber: number,
): Array<{ iso: number; date: Date }> {
  return normalizeTrainingDays(trainingDays).map((iso) => ({
    iso,
    date: trainingDayDate(startDate, trainingDays, weekNumber, iso),
  }));
}

/**
 * Data della sessione numero `sessionIndex` (0-based) della settimana.
 *
 * Con i giorni dichiarati la sessione i-esima cade sull'i-esimo giorno scelto;
 * se ce ne sono piu' dei giorni (l'AI ne ha scritte in eccesso) le successive
 * proseguono nei giorni seguenti. Senza giorni dichiarati restano in giorni
 * consecutivi a partire dalla data di inizio, com'era prima.
 */
export function sessionDateInWeek(
  startDate: Date,
  trainingDays: number[],
  weekNumber: number,
  sessionIndex: number,
): Date {
  const days = normalizeTrainingDays(trainingDays);
  if (days.length === 0) {
    const d = new Date(startDate);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + (weekNumber - 1) * 7 + sessionIndex);
    return d;
  }

  const offset =
    sessionIndex < days.length
      ? days[sessionIndex] - 1
      : days[days.length - 1] - 1 + (sessionIndex - days.length + 1);

  const d = planAnchorMonday(startDate, days);
  d.setDate(d.getDate() + (weekNumber - 1) * 7 + offset);
  return d;
}

/**
 * Data in formato YYYY-MM-DD leggendo i componenti **locali**.
 *
 * `toISODate` passa da `toISOString()`, che converte in UTC: una data locale a
 * mezzanotte in Italia (UTC+2) diventa le 22:00 del giorno prima, e la stringa
 * esce sbagliata di un giorno. Per i giorni di allenamento serve il giorno di
 * calendario che l'utente vede, non quello di Greenwich.
 */
export function toISODateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Prima data utile del piano: il primo giorno di allenamento della settimana 1. */
export function planFirstTrainingDate(startDate: Date, trainingDays: number[]): Date {
  const days = normalizeTrainingDays(trainingDays);
  if (days.length === 0) {
    const d = new Date(startDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return trainingDayDate(startDate, days, 1, days[0]);
}

// ─── Scelta del protocollo RTP ───────────────────────────
//
// I template dichiarano a cosa si applicano (zona, macro-regione, tipo,
// intervallo di severita'); i campi lasciati vuoti valgono "qualsiasi".
// Vince il template compatibile piu' specifico, cosi' il ginocchio ha i suoi
// criteri e una zona senza protocollo dedicato eredita quello di regione e,
// in ultimo, il generico.
//
// Il tipo e' dichiarato qui in forma strutturale invece di importare
// @trainmind/types: questo package non ha dipendenze e va tenuto cosi'.

export interface RtpTemplateMatchable {
  bodyZone?: string | null;
  bodyRegion?: string | null;
  injuryType?: string | null;
  severityMin?: number | null;
  severityMax?: number | null;
  /** null = template di sistema. A parita' di punteggio vince quello dell'organizzazione. */
  organizationId?: string | null;
}

export interface RtpMatchInput {
  /** Zona gia' normalizzata senza lato (rtpBaseZone). */
  zone: string;
  region: string;
  injuryType: string;
  severity: number;
}

/**
 * Punteggio di specificita', oppure null se il template non e' applicabile.
 *
 * I pesi sono scelti in modo che la zona batta qualunque combinazione di
 * criteri piu' deboli: 8 > 4 + 2 + 1. Un protocollo dedicato al ginocchio
 * vince quindi su uno "arto inferiore, muscolare, severita' 3-5" anche
 * quando quest'ultimo combacia su tutto il resto.
 */
export function rtpTemplateScore(t: RtpTemplateMatchable, ctx: RtpMatchInput): number | null {
  let score = 0;

  if (t.bodyZone) {
    if (t.bodyZone !== ctx.zone) return null;
    score += 8;
  }
  if (t.bodyRegion) {
    if (t.bodyRegion !== ctx.region) return null;
    score += 4;
  }
  if (t.injuryType) {
    if (t.injuryType !== ctx.injuryType) return null;
    score += 2;
  }
  if (t.severityMin != null || t.severityMax != null) {
    if (t.severityMin != null && ctx.severity < t.severityMin) return null;
    if (t.severityMax != null && ctx.severity > t.severityMax) return null;
    score += 1;
  }
  if (t.organizationId) score += 0.5;

  return score;
}

/** Il template applicabile piu' specifico, o null se non ce n'e' nessuno. */
export function pickRtpTemplate<T extends RtpTemplateMatchable>(
  templates: readonly T[],
  ctx: RtpMatchInput,
): T | null {
  let best: T | null = null;
  let bestScore = -1;
  for (const t of templates) {
    const s = rtpTemplateScore(t, ctx);
    if (s == null || s <= bestScore) continue;
    best = t;
    bestScore = s;
  }
  return best;
}

/**
 * Data di rientro stimata sommando i giorni tipici delle fasi.
 *
 * Le fasi senza `typicalDays` non spostano la stima: un template compilato a
 * meta' produce una data ottimistica, ed e' meglio di una data inventata.
 */
export function rtpEstimatedReturn(
  startDate: Date,
  phases: ReadonlyArray<{ typicalDays?: number | null }>,
): Date | null {
  let days = 0;
  let any = false;
  for (const p of phases) {
    if (p.typicalDays != null && p.typicalDays > 0) {
      days += p.typicalDays;
      any = true;
    }
  }
  if (!any) return null;
  const out = new Date(startDate);
  out.setDate(out.getDate() + days);
  return out;
}
