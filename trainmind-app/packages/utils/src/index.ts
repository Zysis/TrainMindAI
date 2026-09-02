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

/**
 * Calculate ACWR (Acute:Chronic Workload Ratio)
 * Acute = last 7 days avg, Chronic = last 28 days avg
 */
export function calculateACWR(dailyLoads: number[]): number {
  if (dailyLoads.length < 28) return 0;
  const acute = dailyLoads.slice(-7).reduce((a, b) => a + b, 0) / 7;
  const chronic = dailyLoads.slice(-28).reduce((a, b) => a + b, 0) / 28;
  if (chronic === 0) return 0;
  return Math.round((acute / chronic) * 100) / 100;
}

/**
 * Calculate Wellness Score (0-100) from wellness log entries
 */
export function calculateWellnessScore(params: {
  sleepQuality: number; // 1-5
  fatigue: number; // 1-5 (inverted: 5 = high fatigue = bad)
  soreness: number; // 1-5 (inverted)
  stress: number; // 1-5 (inverted)
  mood: number; // 1-5
}): number {
  const { sleepQuality, fatigue, soreness, stress, mood } = params;
  const score =
    ((sleepQuality + (6 - fatigue) + (6 - soreness) + (6 - stress) + mood) / 25) * 100;
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
