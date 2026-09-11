/**
 * Daily Report — il foglio di fine giornata dello staff.
 *
 * Endpoints (tutti sotto /api/v1):
 *   GET  /daily-report?teamId=&date=&locale=   report salvato, oppure la bozza precompilata
 *   PUT  /daily-report                          salva (upsert per squadra + giorno)
 *   GET  /daily-report/list?teamId=&from=&to=   elenco storico per la scheda Report
 *   GET  /daily-report/export?...&format=       PDF o DOCX
 *
 * Il documento e' firmato dal preparatore, non dall'app: tutto quello che
 * viene precompilato (attivita', stato 0-5, note) resta modificabile, e una
 * volta salvato il report NON si ricalcola piu' da solo — altrimenti una
 * correzione fatta a mano sparirebbe alla riapertura.
 *
 * Le sezioni derivate (densita' allenamento, carico) fanno eccezione: non
 * sono compilabili, si rileggono ogni volta dai cronometri e dalle sessioni
 * della giornata, cosi' un foglio di campo chiuso tardi entra comunque nel
 * report.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@trainmind/db';
import { computeAcwr } from '@trainmind/utils';
import { acwrLoadPoints } from '../lib/acwr-loads.js';
import { requireMinRole } from '../middleware/rbac.js';
import {
  DailyNextTraining_CODES,
  DailyInjuryType_CODES,
  DailyBodyPart_CODES,
  DailySide_CODES,
  DailyClinicalStatus_CODES,
  DailyTaping_CODES,
  DailyTreatment_CODES,
  DailyTrainingType_CODES,
  DailyForecast_CODES,
} from '@trainmind/types';
import type {
  DailyActivity,
  DailyAthleteLoad,
  DailyClinicalFields,
  DailyDensitySection,
  DailyLoadRow,
  DailyReportData,
  DailyReportEntryData,
  DailyStatus,
} from '@trainmind/types';
import { renderDailyReportPdf } from '../services/daily-report-pdf.js';
import { renderDailyReportDocx } from '../services/daily-report-docx.js';

// ─── Tipi interni ───────────────────────────────────────

/** Come il foglio di campo salva un esercizio (colonna `exercises`, Json). */
interface StoredExercise {
  id?: string;
  name?: string;
  isWarmup?: boolean;
  players?: number;
  courts?: number;
  activityMs?: number;
  pauseMs?: number;
  breakMs?: number;
}

type Locale = 'it' | 'en' | 'es';

// ─── Etichette ──────────────────────────────────────────
// I renderer PDF/DOCX girano lato server e non hanno next-intl: le stringhe
// arrivano gia' tradotte dentro il payload. Sono poche e cambiano di rado,
// tenerle qui costa meno che montare un secondo sistema di traduzioni.

const STATUS_LABELS: Record<Locale, Record<number, string>> = {
  it: { 0: 'Fuori', 1: 'Riabilitazione', 2: 'Senza contatto', 3: 'Carico ridotto', 4: 'Con sostituzioni', 5: 'Allenamento completo' },
  en: { 0: 'Out', 1: 'Rehab', 2: 'No contact', 3: 'Reduced load', 4: 'With substitutions', 5: 'Full training' },
  es: { 0: 'Fuera', 1: 'Rehabilitación', 2: 'Sin contacto', 3: 'Carga reducida', 4: 'Con sustituciones', 5: 'Entrenamiento completo' },
};

const LABELS: Record<Locale, Record<string, string>> = {
  it: {
    reportTitle: 'REPORT GIORNALIERO',
    activities: 'Attività',
    player: 'Giocatore',
    status: 'Stato',
    notes: 'Note',
    teamLines: 'LINEE PER DOMANI',
    density: 'Densità allenamento',
    densityTable: 'Densità',
    activeTime: 'Tempo attivo',
    totalTime: 'Tempo totale',
    pauseTime: 'Pausa',
    duration: 'Durata',
    drill: 'Esercizio',
    perPlayer: 'Tempo effettivo per giocatore',
    workOnly: 'Tempo effettivo (senza pause)',
    total: 'TOTALE',
    bandLow: 'Bassa', bandMedium: 'Media', bandHigh: 'Intensa', bandVeryHigh: 'Molto intensa',
    loadSummary: 'Carico della giornata',
    minutes: 'Minuti',
    rpe: 'RPE',
    load: 'Carico',
    source: 'Origine',
    sourceTraining: 'Allenamento', sourceGame: 'Partita', sourceMixed: 'Misto',
    athletes: 'giocatori',
    noDensity: 'Nessun allenamento cronometrato in questa giornata.',
    noDensityNoSheets: 'Nessun foglio di campo aperto per questa giornata: il dettaglio esercizi arriva dai cronometri del foglio.',
    noDensityNoDrills: 'Fogli di campo presenti, ma senza esercizi cronometrati.',
    noLoad: 'Nessun carico registrato: nasce chiudendo un foglio di campo con l\'RPE dei giocatori, o completando una partita.',
    generatedBy: 'Compilato da',
    nextTraining: 'Prossimo allenamento', injury: 'Infortunio', bodyPart: 'Parte anatomica', side: 'Lato', clinicalStatus: 'Stato clinico', taping: 'Taping / fisio', treatment: 'Check e trattamento', trainingType: 'Tipo allenamento', forecast: 'Previsione', acwr: 'ACWR', clinicalSection: 'Scheda medica',
  },
  en: {
    reportTitle: 'DAILY REPORT',
    activities: 'Activities',
    player: 'Player',
    status: 'Status',
    notes: 'Notes',
    teamLines: 'TEAM LINES FOR TOMORROW',
    density: 'Training density',
    densityTable: 'Density',
    activeTime: 'Active time',
    totalTime: 'Total time',
    pauseTime: 'Pause',
    duration: 'Duration',
    drill: 'Drill',
    perPlayer: 'Effective time per player',
    workOnly: 'Effective time (no pauses)',
    total: 'TOTAL',
    bandLow: 'Low', bandMedium: 'Medium', bandHigh: 'Intense', bandVeryHigh: 'Very intense',
    loadSummary: 'Load of the day',
    minutes: 'Minutes',
    rpe: 'RPE',
    load: 'Load',
    source: 'Source',
    sourceTraining: 'Training', sourceGame: 'Game', sourceMixed: 'Mixed',
    athletes: 'players',
    noDensity: 'No timed training on this day.',
    noDensityNoSheets: 'No field sheet was opened on this day: the drill detail comes from the sheet timers.',
    noDensityNoDrills: 'Field sheets exist, but with no timed drills.',
    noLoad: 'No load recorded: it comes from closing a field sheet with the players\' RPE, or from completing a game.',
    generatedBy: 'Filled in by',
    nextTraining: 'Next training', injury: 'Injury', bodyPart: 'Body part', side: 'Side', clinicalStatus: 'Clinical status', taping: 'Taping / physio', treatment: 'Check and treatment', trainingType: 'Training type', forecast: 'Forecast', acwr: 'ACWR', clinicalSection: 'Medical sheet',
  },
  es: {
    reportTitle: 'INFORME DIARIO',
    activities: 'Actividades',
    player: 'Jugador',
    status: 'Estado',
    notes: 'Notas',
    teamLines: 'LÍNEAS PARA MAÑANA',
    density: 'Densidad del entrenamiento',
    densityTable: 'Densidad',
    activeTime: 'Tiempo activo',
    totalTime: 'Tiempo total',
    pauseTime: 'Pausa',
    duration: 'Duración',
    drill: 'Ejercicio',
    perPlayer: 'Tiempo efectivo por jugador',
    workOnly: 'Tiempo efectivo (sin pausas)',
    total: 'TOTAL',
    bandLow: 'Baja', bandMedium: 'Media', bandHigh: 'Intensa', bandVeryHigh: 'Muy intensa',
    loadSummary: 'Carga del día',
    minutes: 'Minutos',
    rpe: 'RPE',
    load: 'Carga',
    source: 'Origen',
    sourceTraining: 'Entrenamiento', sourceGame: 'Partido', sourceMixed: 'Mixto',
    athletes: 'jugadores',
    noDensity: 'Ningún entrenamiento cronometrado en este día.',
    noDensityNoSheets: 'Ninguna hoja de campo abierta en este día: el detalle de los ejercicios viene de los cronómetros de la hoja.',
    noDensityNoDrills: 'Hay hojas de campo, pero sin ejercicios cronometrados.',
    noLoad: 'Ninguna carga registrada: nace al cerrar una hoja de campo con el RPE de los jugadores, o al completar un partido.',
    generatedBy: 'Rellenado por',
    nextTraining: 'Próximo entrenamiento', injury: 'Lesión', bodyPart: 'Parte anatómica', side: 'Lado', clinicalStatus: 'Estado clínico', taping: 'Vendaje / fisio', treatment: 'Pruebas y tratamiento', trainingType: 'Tipo de entrenamiento', forecast: 'Previsión', acwr: 'ACWR', clinicalSection: 'Ficha médica',
  },
};

/** Tipo evento → etichetta dell'attività, nella lingua richiesta. */
const ACTIVITY_LABELS: Record<Locale, Record<string, string>> = {
  it: { gym: 'Palestra', basket: 'Basket', individual: 'Individuale', shooting: 'Tiro', match: 'Partita', rehab: 'Riabilitazione', meeting: 'Video', medical: 'Medico', session: 'Allenamento', other: 'Altro' },
  en: { gym: 'Strength', basket: 'Basket', individual: 'Individual', shooting: 'Shooting', match: 'Game', rehab: 'Rehab', meeting: 'Video', medical: 'Medical', session: 'Training', other: 'Other' },
  es: { gym: 'Gimnasio', basket: 'Baloncesto', individual: 'Individual', shooting: 'Tiro', match: 'Partido', rehab: 'Rehabilitación', meeting: 'Vídeo', medical: 'Médico', session: 'Entrenamiento', other: 'Otro' },
};

const VOCAB_LABELS: Record<Locale, Record<string, Record<string, string>>> = {
  it: {
    nextTraining: { available: "Disponibile", partial: "Parziale", unavailable: "Non disponibile" },
    injuryType: { inflammation: "Infiammazione", tendinopathy: "Tendinopatia", periostitis: "Periostite", bone_edema: "Edema osseo", contracture: "Contrattura", strain: "Stiramento", tear: "Lesione muscolare", sprain: "Distorsione", contusion: "Contusione", overload: "Sovraccarico", other: "Altro" },
    bodyPart: { plantar_fascia: "Fascia plantare", achilles: "Tendine achilleo", tibia: "Tibia", ankle: "Caviglia", foot: "Piede", calf: "Polpaccio", knee: "Ginocchio", patellar_tendon: "Tendine rotuleo", quadriceps: "Quadricipite", hamstring: "Ischiocrurali", adductor: "Adduttori", hip: "Anca", lumbar: "Zona lombare", dorsal: "Zona dorsale", cervical: "Cervicale", shoulder: "Spalla", arm: "Braccio e avambraccio", elbow: "Gomito", wrist: "Polso", hand: "Mano e dita", other: "Altro" },
    side: { left: "Sinistra", right: "Destra", bilateral: "Bilaterale" },
    clinicalStatus: { mild: "Lieve", stationary: "Stazionario", improving: "In miglioramento", worsening: "In peggioramento", persistent: "Persistente", resolved: "Risolto" },
    taping: { taping: "Taping", kinesio: "Kinesio", brace: "Tutore", bandage: "Bendaggio", insole: "Plantare" },
    treatment: { assessment: "Accertamenti", physio: "Fisioterapia", medical_check: "Visita medica", imaging: "Imaging (RMN, eco, RX)", specialist: "Visita specialistica", rest: "Riposo", therapy: "Terapia farmacologica" },
    trainingType: { full: "Completo", partial: "Parziale", individual: "Individuale", gym_only: "Solo palestra", rehab: "Riabilitazione", rest: "Riposo" },
    forecast: { next_session: "Prossima seduta", days_2_3: "2-3 giorni", week_1: "1 settimana", weeks_2_3: "2-3 settimane", month_plus: "1 mese o più", to_define: "Da definire" },
  },
  en: {
    nextTraining: { available: "Available", partial: "Partial", unavailable: "Unavailable" },
    injuryType: { inflammation: "Inflammation", tendinopathy: "Tendinopathy", periostitis: "Periostitis", bone_edema: "Bone edema", contracture: "Muscle tightness", strain: "Strain", tear: "Muscle tear", sprain: "Sprain", contusion: "Contusion", overload: "Overload", other: "Other" },
    bodyPart: { plantar_fascia: "Plantar fascia", achilles: "Achilles tendon", tibia: "Tibia", ankle: "Ankle", foot: "Foot", calf: "Calf", knee: "Knee", patellar_tendon: "Patellar tendon", quadriceps: "Quadriceps", hamstring: "Hamstrings", adductor: "Adductors", hip: "Hip", lumbar: "Lower back", dorsal: "Upper back", cervical: "Neck", shoulder: "Shoulder", arm: "Arm and forearm", elbow: "Elbow", wrist: "Wrist", hand: "Hand and fingers", other: "Other" },
    side: { left: "Left", right: "Right", bilateral: "Bilateral" },
    clinicalStatus: { mild: "Mild", stationary: "Stationary", improving: "Improving", worsening: "Worsening", persistent: "Persistent", resolved: "Resolved" },
    taping: { taping: "Taping", kinesio: "Kinesio", brace: "Brace", bandage: "Bandage", insole: "Insole" },
    treatment: { assessment: "Assessment", physio: "Physiotherapy", medical_check: "Medical check", imaging: "Imaging (MRI, US, X-ray)", specialist: "Specialist visit", rest: "Rest", therapy: "Drug therapy" },
    trainingType: { full: "Full", partial: "Partial", individual: "Individual", gym_only: "Gym only", rehab: "Rehab", rest: "Rest" },
    forecast: { next_session: "Next session", days_2_3: "2-3 days", week_1: "1 week", weeks_2_3: "2-3 weeks", month_plus: "1 month or more", to_define: "To be defined" },
  },
  es: {
    nextTraining: { available: "Disponible", partial: "Parcial", unavailable: "No disponible" },
    injuryType: { inflammation: "Inflamación", tendinopathy: "Tendinopatía", periostitis: "Periostitis", bone_edema: "Edema óseo", contracture: "Contractura", strain: "Distensión", tear: "Rotura muscular", sprain: "Esguince", contusion: "Contusión", overload: "Sobrecarga", other: "Otro" },
    bodyPart: { plantar_fascia: "Fascia plantar", achilles: "Tendón de Aquiles", tibia: "Tibia", ankle: "Tobillo", foot: "Pie", calf: "Gemelo", knee: "Rodilla", patellar_tendon: "Tendón rotuliano", quadriceps: "Cuádriceps", hamstring: "Isquiotibiales", adductor: "Aductores", hip: "Cadera", lumbar: "Zona lumbar", dorsal: "Zona dorsal", cervical: "Cervical", shoulder: "Hombro", arm: "Brazo y antebrazo", elbow: "Codo", wrist: "Muñeca", hand: "Mano y dedos", other: "Otro" },
    side: { left: "Izquierda", right: "Derecha", bilateral: "Bilateral" },
    clinicalStatus: { mild: "Leve", stationary: "Estacionario", improving: "En mejoría", worsening: "Empeorando", persistent: "Persistente", resolved: "Resuelto" },
    taping: { taping: "Vendaje funcional", kinesio: "Kinesio", brace: "Férula", bandage: "Vendaje", insole: "Plantilla" },
    treatment: { assessment: "Pruebas", physio: "Fisioterapia", medical_check: "Revisión médica", imaging: "Imagen (RMN, eco, RX)", specialist: "Consulta especialista", rest: "Reposo", therapy: "Terapia farmacológica" },
    trainingType: { full: "Completo", partial: "Parcial", individual: "Individual", gym_only: "Solo gimnasio", rehab: "Rehabilitación", rest: "Reposo" },
    forecast: { next_session: "Próxima sesión", days_2_3: "2-3 días", week_1: "1 semana", weeks_2_3: "2-3 semanas", month_plus: "1 mes o más", to_define: "Por definir" },
  },
};

// ─── Helpers ────────────────────────────────────────────

function normalizeLocale(raw: unknown): Locale {
  return raw === 'en' || raw === 'es' ? raw : 'it';
}

/** Inizio e fine del giorno in ora locale del server, come il calendario. */
function dayBounds(dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return {
    start: new Date(y, m - 1, d, 0, 0, 0, 0),
    end: new Date(y, m - 1, d, 23, 59, 59, 999),
  };
}

/** Il giorno "puro" da scrivere in una colonna DATE, senza scivolamenti di fuso. */
function dateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Etichetta relativa alla partita più vicina: GD-2, GD, GD+1.
 * Con partite sia prima sia dopo vince la più vicina; a parità, quella futura,
 * perché è quella verso cui si sta lavorando.
 */
function gameDayLabel(day: Date, matchDays: Date[]): string | null {
  if (matchDays.length === 0) return null;
  const dayMs = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  let best: number | null = null;
  for (const m of matchDays) {
    const mMs = new Date(m.getFullYear(), m.getMonth(), m.getDate()).getTime();
    const diff = Math.round((dayMs - mMs) / 86400000);
    if (best === null || Math.abs(diff) < Math.abs(best) || (Math.abs(diff) === Math.abs(best) && diff < best)) {
      best = diff;
    }
  }
  if (best === null) return null;
  if (best === 0) return 'GD';
  return best > 0 ? `GD +${best}` : `GD ${best}`;
}

/** Soglie del foglio cartaceo: <20 bassa, 20-25 media, 25-30 intensa, >30 molto intensa. */
function densityBand(pct: number): DailyDensitySection['densityBand'] {
  if (pct < 20) return 'LOW';
  if (pct < 25) return 'MEDIUM';
  if (pct <= 30) return 'HIGH';
  return 'VERY_HIGH';
}

/**
 * Stato proposto per un atleta con un infortunio aperto.
 * È solo un punto di partenza: chi compila corregge. Non si propone mai 5,
 * perché "pienamente disponibile" è una decisione dello staff, non un
 * calcolo, e proporla in automatico la farebbe passare senza che nessuno
 * ci pensi.
 */
const RTP_PHASE_STATUS: Record<string, DailyStatus> = {
  PHASE_1: 1, PHASE_2: 1, PHASE_3: 2, PHASE_4: 3, PHASE_5: 4, CLEARED: 4,
};

export async function dailyReportRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate, requireMinRole('TRAINER')] };

  /**
   * Il client Prisma e' generato da `schema.prisma`: finche' non lo si
   * rigenera dopo aver aggiunto i modelli, `app.prisma.dailyReport` e'
   * `undefined` e ogni chiamata muore con un "Cannot read properties of
   * undefined" che non dice a nessuno cosa fare. Qui la diagnosi e' esplicita.
   */
  function prismaReady(): boolean {
    const client = app.prisma as unknown as Record<string, unknown>;
    return Boolean(client.dailyReport && client.dailyReportEntry);
  }

  function notGenerated(reply: FastifyReply) {
    app.log.error(
      'Modelli DailyReport assenti dal client Prisma: eseguire `pnpm db:generate` (e `pnpm db:push` o `prisma migrate deploy`) e riavviare l\'API.',
    );
    return reply.status(503).send({
      success: false,
      error: {
        code: 'PRISMA_CLIENT_OUTDATED',
        message:
          'Il client Prisma non conosce ancora il report giornaliero. Esegui `pnpm db:generate` e `pnpm db:push` dalla radice del progetto, poi riavvia l\'API.',
      },
    });
  }

  // ─── Costruzione del payload ──────────────────────────

  async function buildReport(
    organizationId: string,
    userId: string,
    teamId: string,
    date: string,
    locale: Locale,
  ): Promise<DailyReportData> {
    const { start, end } = dayBounds(date);
    const L = LABELS[locale];

    const team = await app.prisma.team.findFirst({
      where: { id: teamId, organizationId },
      select: { id: true, name: true, logoUrl: true },
    });
    if (!team) throw Object.assign(new Error('Squadra non trovata'), { code: 'TEAM_NOT_FOUND' });

    const [org, user, saved, memberships, events, fieldSessions, matchEvents] = await Promise.all([
      app.prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true, logoUrl: true } }),
      app.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } }),
      app.prisma.dailyReport.findUnique({
        where: { teamId_date: { teamId, date: dateOnly(date) } },
        include: {
          entries: { include: { athlete: { select: { id: true, firstName: true, lastName: true, jerseyNumber: true, photoUrl: true } } } },
          createdBy: { select: { firstName: true, lastName: true } },
        },
      }),
      app.prisma.athleteTeam.findMany({
        where: { teamId, athlete: { organizationId, isActive: true } },
        select: { athlete: { select: { id: true, firstName: true, lastName: true, jerseyNumber: true, photoUrl: true } } },
      }),
      app.prisma.calendarEvent.findMany({
        where: { teamId, startTime: { gte: start, lte: end } },
        select: { id: true, title: true, type: true, startTime: true, endTime: true },
        orderBy: { startTime: 'asc' },
      }),
      // Il foglio appartiene al giorno dell'ALLENAMENTO, non al momento in cui
      // qualcuno lo ha aperto: `startedAt` e' un `now()` di default, quindi
      // compilando oggi il foglio di un allenamento di dieci giorni fa quel
      // foglio finiva nel report di oggi e spariva da quello giusto. La data
      // buona e' quella dell'evento di calendario o della seduta del piano;
      // `startedAt` resta solo per i fogli che non hanno ne' l'uno ne' l'altra.
      app.prisma.fieldTrainingSession.findMany({
        where: {
          teamId,
          organizationId,
          OR: [
            { calendarEvent: { startTime: { gte: start, lte: end } } },
            { trainingSession: { date: { gte: start, lte: end } } },
            {
              calendarEventId: null,
              trainingSessionId: null,
              startedAt: { gte: start, lte: end },
            },
          ],
        },
        select: {
          id: true, exercises: true, availableAthletes: true, startedAt: true, completedAt: true,
          calendarEvent: { select: { title: true, type: true, startTime: true, endTime: true } },
          trainingSession: { select: { title: true, date: true } },
        },
        orderBy: { startedAt: 'asc' },
      }),
      // Finestra larga: serve solo a datare GD±n, non a elencare partite.
      app.prisma.calendarEvent.findMany({
        where: {
          teamId,
          type: 'match',
          startTime: { gte: new Date(start.getTime() - 21 * 86400000), lte: new Date(end.getTime() + 21 * 86400000) },
        },
        select: { startTime: true },
      }),
    ]);

    const roster = memberships
      .map((m) => m.athlete)
      .sort((a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999) || a.lastName.localeCompare(b.lastName));

    // ── Righe giocatore ────────────────────────────────
    let entries: DailyReportEntryData[];
    let activities: DailyActivity[];
    let teamLines: string | null;

    if (saved) {
      // Salvato: si mostra quello che c'è scritto. Un giocatore entrato in
      // rosa dopo il salvataggio si aggiunge in coda come proposta, ma le
      // righe già compilate non si toccano.
      const byAthlete = new Map(saved.entries.map((e) => [e.athleteId, e]));
      // Anche sulle righe gia' salvate serve l'id dell'infortunio aperto: e'
      // quello che alimenta il collegamento "apri infortunio". Lo stato e i
      // campi clinici NON si toccano — quelli restano come li ha scritti chi
      // ha compilato.
      const openInjuries = await suggestStatuses(saved.entries.map((e) => e.athleteId), end);
      const savedRows: DailyReportEntryData[] = saved.entries
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((e) => ({
          athleteId: e.athleteId,
          athleteName: `${e.athlete.lastName} ${e.athlete.firstName}`.trim(),
          jerseyNumber: e.athlete.jerseyNumber,
          photoUrl: e.athlete.photoUrl,
          status: e.status as DailyStatus,
          note: e.note,
          suggestedFrom: null,
          clinical: readClinical(e as unknown as Record<string, unknown>),
          athleteLoad: { rpeToday: null, loadToday: null, acwr: null, acwrZone: null },
          openInjuryId: openInjuries.get(e.athleteId)?.injuryId ?? null,
        }));
      const newcomers = roster.filter((a) => !byAthlete.has(a.id));
      const suggested = await suggestStatuses(newcomers.map((a) => a.id), end);
      entries = [
        ...savedRows,
        ...newcomers.map((a) => ({
          athleteId: a.id,
          athleteName: `${a.lastName} ${a.firstName}`.trim(),
          jerseyNumber: a.jerseyNumber,
          photoUrl: a.photoUrl,
          status: (suggested.get(a.id)?.status ?? 5) as DailyStatus,
          note: suggested.get(a.id)?.note ?? null,
          suggestedFrom: suggested.get(a.id)?.from ?? null,
          clinical: suggested.get(a.id)?.clinical ?? { ...EMPTY_CLINICAL },
          athleteLoad: { rpeToday: null, loadToday: null, acwr: null, acwrZone: null },
          openInjuryId: suggested.get(a.id)?.injuryId ?? null,
        })),
      ];
      activities = Array.isArray(saved.activities) ? (saved.activities as unknown as DailyActivity[]) : [];
      teamLines = saved.teamLines;
    } else {
      const suggested = await suggestStatuses(roster.map((a) => a.id), end);
      entries = roster.map((a) => ({
        athleteId: a.id,
        athleteName: `${a.lastName} ${a.firstName}`.trim(),
        jerseyNumber: a.jerseyNumber,
        photoUrl: a.photoUrl,
        status: (suggested.get(a.id)?.status ?? 5) as DailyStatus,
        note: suggested.get(a.id)?.note ?? null,
        suggestedFrom: suggested.get(a.id)?.from ?? null,
        clinical: suggested.get(a.id)?.clinical ?? { ...EMPTY_CLINICAL },
        athleteLoad: { rpeToday: null, loadToday: null, acwr: null, acwrZone: null },
        openInjuryId: suggested.get(a.id)?.injuryId ?? null,
      }));
      activities = buildActivities(events, locale);
      teamLines = null;
    }

    // ── Densità per allenamento cronometrato ───────────
    const matchDays = matchEvents.map((m) => m.startTime);
    const density: DailyDensitySection[] = [];
    // Serve a distinguere "non c'e' nessun allenamento" da "gli allenamenti
    // ci sono ma nessuno ha esercizi cronometrati": senza, la sezione sparisce
    // e chi guarda non sa se e' un dato mancante o un bug.
    let sheetsWithoutDrills = 0;
    for (const fs of fieldSessions) {
      const raw = Array.isArray(fs.exercises) ? (fs.exercises as unknown as StoredExercise[]) : [];
      if (raw.length === 0) { sheetsWithoutDrills++; continue; }
      const available = fs.availableAthletes ?? 0;

      let totalMs = 0, activeMs = 0;
      const drills = raw.map((ex) => {
        const activity = Math.max(0, ex.activityMs ?? 0);
        const pause = Math.max(0, ex.pauseMs ?? 0);
        const brk = Math.max(0, ex.breakMs ?? 0);
        const drillTotal = activity + pause + brk;
        // Effettivo per giocatore: il lavoro va scalato su quanti erano
        // davvero coinvolti. Senza `players` o senza disponibili non si può
        // calcolare, e stimarlo darebbe una densità inventata.
        const players = ex.players ?? 0;
        const perPlayer = players > 0 && available > 0 ? Math.round(activity * (players / available)) : null;
        totalMs += drillTotal;
        activeMs += perPlayer ?? 0;
        return {
          name: ex.name || '—',
          totalMs: drillTotal,
          perPlayerMs: perPlayer,
          workMs: players > 0 ? activity : null,
        };
      });

      const pct = totalMs > 0 ? (activeMs / totalMs) * 100 : 0;
      density.push({
        sessionId: fs.id,
        title: fs.calendarEvent?.title || fs.trainingSession?.title || ACTIVITY_LABELS[locale].session,
        gameDayLabel: gameDayLabel(fs.startedAt, matchDays),
        timeRange: fs.calendarEvent
          ? `${fmtTime(fs.calendarEvent.startTime)}–${fmtTime(fs.calendarEvent.endTime)}`
          : null,
        athletesAvailable: available,
        totalMs,
        activeMs,
        pauseMs: Math.max(0, totalMs - activeMs),
        densityPct: Math.round(pct),
        densityBand: densityBand(pct),
        drills,
      });
    }

    // ── Carico della giornata ──────────────────────────
    const daySessions = await app.prisma.trainingSession.findMany({
      where: {
        status: 'COMPLETED',
        date: { gte: start, lte: end },
        athlete: { organizationId, athleteTeams: { some: { teamId } } },
      },
      select: {
        athleteId: true, duration: true, rpe: true, title: true,
        athlete: { select: { firstName: true, lastName: true, jerseyNumber: true } },
      },
    });

    const loadByAthlete = new Map<string, DailyLoadRow & { jersey: number | null; rpeSum: number; rpeCount: number }>();
    for (const ts of daySessions) {
      if (!ts.athleteId || !ts.athlete) continue;
      const isGame = /partita|game|partido/i.test(ts.title || '');
      const cur = loadByAthlete.get(ts.athleteId) ?? {
        athleteId: ts.athleteId,
        athleteName: `${ts.athlete.lastName} ${ts.athlete.firstName}`.trim(),
        minutes: 0, rpe: null, load: null,
        source: (isGame ? 'GAME' : 'TRAINING') as DailyLoadRow['source'],
        jersey: ts.athlete.jerseyNumber, rpeSum: 0, rpeCount: 0,
      };
      cur.minutes += ts.duration ?? 0;
      if (ts.rpe) { cur.rpeSum += ts.rpe; cur.rpeCount++; cur.load = (cur.load ?? 0) + ts.rpe * (ts.duration ?? 0); }
      const thisSource: DailyLoadRow['source'] = isGame ? 'GAME' : 'TRAINING';
      if (cur.source !== thisSource) cur.source = 'MIXED';
      loadByAthlete.set(ts.athleteId, cur);
    }
    const load: DailyLoadRow[] = Array.from(loadByAthlete.values())
      .map((r) => ({
        athleteId: r.athleteId,
        athleteName: r.athleteName,
        minutes: r.minutes,
        // Media degli RPE della giornata: un atleta può avere palestra e campo.
        rpe: r.rpeCount > 0 ? Math.round((r.rpeSum / r.rpeCount) * 10) / 10 : null,
        load: r.load,
        source: r.source,
      }))
      .sort((a, b) => (b.load ?? 0) - (a.load ?? 0) || a.athleteName.localeCompare(b.athleteName));

    // ACWR e RPE della giornata finiscono su ogni riga: chi compila ha il dato
    // davanti mentre sceglie lo stato. Non lo determinano — l'ACWR e' un
    // indicatore di rischio, non un verdetto di disponibilita'.
    const acwrMap = await acwrByAthlete(entries.map((e) => e.athleteId), end);
    const loadByAthleteId = new Map(load.map((l) => [l.athleteId, l]));
    for (const e of entries) {
      const a = acwrMap.get(e.athleteId);
      const l = loadByAthleteId.get(e.athleteId);
      e.athleteLoad = {
        rpeToday: l?.rpe ?? null,
        loadToday: l?.load ?? null,
        acwr: a?.acwr ?? null,
        acwrZone: a?.zone ?? null,
      };
    }

    const filledBy = saved?.createdBy
      ? `${saved.createdBy.firstName} ${saved.createdBy.lastName}`
      : user ? `${user.firstName} ${user.lastName}` : '—';

    return {
      kind: 'DAILY',
      metadata: {
        audience: 'STAFF',
        organizationName: org?.name || '—',
        periodFrom: date,
        periodTo: date,
        generatedAt: new Date().toISOString(),
        generatedBy: filledBy,
        logoUrl: team.logoUrl || org?.logoUrl || undefined,
        teamName: team.name,
      },
      date,
      weekdayLabel: new Date(`${date}T12:00:00Z`).toLocaleDateString(
        locale === 'it' ? 'it-IT' : locale === 'es' ? 'es-ES' : 'en-GB',
        { weekday: 'long' },
      ).toUpperCase(),
      teamId,
      activities,
      entries,
      teamLines,
      density,
      densityDiagnostics: {
        sheets: fieldSessions.length,
        withDrills: density.length,
        withoutDrills: sheetsWithoutDrills,
        eventsInDay: events.length,
      },
      load,
      saved: Boolean(saved),
      statusLabels: Object.fromEntries(Object.entries(STATUS_LABELS[locale]).map(([k, v]) => [k, v])),
      // I renderer ricevono una frase sola: qui si sceglie quella giusta, cosi'
      // anche il PDF stampato dice *perche'* la sezione e' vuota.
      labels: {
        ...L,
        noDensity: fieldSessions.length === 0 ? L.noDensityNoSheets : L.noDensityNoDrills,
      },
      vocabLabels: VOCAB_LABELS[locale],
    };
  }

  /**
   * La scheda Infortuni tiene il lato dentro la sede (`ankle_l`), il foglio di
   * fine giornata li vuole in due colonne. Qui si separano. Le sedi che il
   * vocabolario del report non copre restano senza parte anatomica: meglio un
   * campo vuoto che una traduzione approssimativa.
   */
  /**
   * Ponte fra le sedi degli infortuni (InjuryLocation_CODES, sedici voci) e
   * le parti anatomiche della scheda medica (DailyBodyPart_CODES, venti).
   *
   * Mancavano `elbow` e `other`, che un corrispondente ce l'hanno eccome: un
   * infortunio al gomito arrivava al foglio di fine giornata con la parte
   * anatomica vuota, e il preparatore doveva riscrivere a mano una cosa che
   * il sistema gia' sapeva.
   *
   * Resta scoperta `head`: fra le parti anatomiche non c'e' la testa, e
   * aggiungerla vuol dire toccare i codici condivisi e le tre lingue — non
   * si inventa qui una mappatura verso 'other', che direbbe una cosa falsa.
   */
  const LOCATION_TO_BODY_PART: Record<string, string> = {
    ankle: 'ankle', knee: 'knee', hamstring: 'hamstring', quadriceps: 'quadriceps',
    calf: 'calf', groin: 'adductor', hip: 'hip', back_lower: 'lumbar', back_upper: 'dorsal',
    shoulder: 'shoulder', arm: 'arm', elbow: 'elbow', wrist: 'wrist', finger: 'hand',
    foot: 'foot', other: 'other',
  };

  function mapInjuryLocation(location: string | null): { bodyPart: DailyClinicalFields['bodyPart']; side: DailyClinicalFields['side'] } {
    if (!location) return { bodyPart: null, side: null };
    const m = /^(.*?)_(l|r)$/.exec(location);
    const base = m ? m[1] : location;
    const side = m ? (m[2] === 'l' ? 'left' : 'right') : null;
    const mapped = LOCATION_TO_BODY_PART[base];
    return {
      bodyPart: (mapped as DailyClinicalFields['bodyPart']) ?? null,
      side: side as DailyClinicalFields['side'],
    };
  }

  const EMPTY_CLINICAL: DailyClinicalFields = {
    nextTraining: null, injuryType: null, bodyPart: null, side: null,
    clinicalStatus: null, taping: null, treatment: null, trainingType: null, forecast: null,
  };

  /** I campi clinici di una riga salvata, ripuliti dai codici non piu' validi. */
  function readClinical(row: Record<string, unknown>): DailyClinicalFields {
    const pick = <T extends readonly string[]>(v: unknown, codes: T) =>
      typeof v === 'string' && (codes as readonly string[]).includes(v) ? (v as T[number]) : null;
    return {
      nextTraining: pick(row.nextTraining, DailyNextTraining_CODES),
      injuryType: pick(row.injuryType, DailyInjuryType_CODES),
      bodyPart: pick(row.bodyPart, DailyBodyPart_CODES),
      side: pick(row.side, DailySide_CODES),
      clinicalStatus: pick(row.clinicalStatus, DailyClinicalStatus_CODES),
      taping: pick(row.taping, DailyTaping_CODES),
      treatment: pick(row.treatment, DailyTreatment_CODES),
      trainingType: pick(row.trainingType, DailyTrainingType_CODES),
      forecast: pick(row.forecast, DailyForecast_CODES),
    };
  }

  /**
   * ACWR per atleta alla data del report. La formula NON sta piu' qui:
   * acuto = carico degli ultimi 7 giorni, cronico = media settimanale degli
   * ultimi 21. Ricalcolato qui e non letto da Analytics perche' quella rotta
   * lavora su un periodo e restituisce una serie: per un giorno solo servirebbe
   * comunque questa riduzione.
   */
  async function acwrByAthlete(
    athleteIds: string[],
    asOf: Date,
  ): Promise<Map<string, { acwr: number | null; zone: DailyAthleteLoad['acwrZone'] }>> {
    const out = new Map<string, { acwr: number | null; zone: DailyAthleteLoad['acwrZone'] }>();
    if (athleteIds.length === 0) return out;

    // Le sedute di squadra (athleteId nullo) valgono per tutta la rosa: la
    // regola sta in `acwrLoadPoints`, una sola volta per tutto il prodotto.
    const byAthlete = await acwrLoadPoints(app.prisma, athleteIds, asOf);

    for (const id of athleteIds) {
      const r = computeAcwr(byAthlete.get(id) ?? [], asOf);
      out.set(id, { acwr: r.acwr, zone: r.zone });
    }
    return out;
  }

  /**
   * Stato e nota proposti a partire da infortuni aperti e protocolli RTP.
   * Chi non ha nulla di aperto non compare nella mappa e parte a 5.
   */
  async function suggestStatuses(
    athleteIds: string[],
    asOf: Date,
  ): Promise<Map<string, {
    status: DailyStatus; note: string | null; from: 'injury' | 'rtp';
    clinical: DailyClinicalFields; injuryId: string;
  }>> {
    const out = new Map<string, {
      status: DailyStatus; note: string | null; from: 'injury' | 'rtp';
      clinical: DailyClinicalFields; injuryId: string;
    }>();
    if (athleteIds.length === 0) return out;

    const injuries = await app.prisma.injury.findMany({
      where: {
        athleteId: { in: athleteIds },
        status: { in: ['ACTIVE', 'RECOVERING'] },
        dateOccurred: { lte: asOf },
      },
      select: {
        id: true, athleteId: true, status: true, location: true, notes: true, dateOccurred: true,
        rtpProtocols: { select: { currentPhase: true }, orderBy: { updatedAt: 'desc' }, take: 1 },
      },
      orderBy: { dateOccurred: 'desc' },
    });

    for (const inj of injuries) {
      // Un atleta con più infortuni aperti tiene il più limitante.
      const phase = inj.rtpProtocols[0]?.currentPhase;
      const status: DailyStatus = phase
        ? RTP_PHASE_STATUS[phase] ?? 1
        : inj.status === 'ACTIVE' ? 0 : 2;
      const note = inj.notes?.trim() || inj.location || null;
      const prev = out.get(inj.athleteId);
      if (!prev || status < prev.status) {
        const mapped = mapInjuryLocation(inj.location);
        out.set(inj.athleteId, {
          status,
          note,
          from: phase ? 'rtp' : 'injury',
          injuryId: inj.id,
          // Solo cio' che si puo' dedurre senza inventare: parte anatomica e
          // lato dalla sede dell'infortunio, e il "prossimo allenamento"
          // dallo stato. Tipo, taping, trattamento e previsione restano vuoti:
          // sono giudizi del fisio, non deduzioni.
          clinical: {
            ...EMPTY_CLINICAL,
            bodyPart: mapped.bodyPart,
            side: mapped.side,
            nextTraining: status === 0 ? 'unavailable' : status <= 3 ? 'partial' : 'available',
          },
        });
      }
    }
    return out;
  }

  /** Attività della giornata dagli eventi di calendario, accorpate per tipo. */
  function buildActivities(
    events: Array<{ type: string; startTime: Date; endTime: Date }>,
    locale: Locale,
  ): DailyActivity[] {
    const byType = new Map<string, number>();
    for (const ev of events) {
      const minutes = Math.max(0, Math.round((ev.endTime.getTime() - ev.startTime.getTime()) / 60000));
      if (minutes === 0) continue;
      byType.set(ev.type, (byType.get(ev.type) ?? 0) + minutes);
    }
    return Array.from(byType.entries()).map(([type, minutes]) => ({
      label: ACTIVITY_LABELS[locale][type] || ACTIVITY_LABELS[locale].other,
      minutes,
    }));
  }

  function fmtTime(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // ─── GET /daily-report ────────────────────────────────
  app.get('/daily-report', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      teamId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      locale: z.string().optional(),
    });
    const parsed = schema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Servono teamId e date (YYYY-MM-DD)', details: parsed.error.flatten().fieldErrors },
      });
    }
    if (!prismaReady()) return notGenerated(reply);
    const { organizationId, userId } = request.user;
    try {
      const report = await buildReport(organizationId, userId, parsed.data.teamId, parsed.data.date, normalizeLocale(parsed.data.locale));
      return reply.send({ success: true, data: { report } });
    } catch (err) {
      if ((err as { code?: string }).code === 'TEAM_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Squadra non trovata' } });
      }
      throw err;
    }
  });

  // ─── PUT /daily-report ────────────────────────────────
  app.put('/daily-report', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      teamId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      activities: z.array(z.object({
        label: z.string().min(1).max(60),
        minutes: z.number().int().min(0).max(600),
      })).max(20),
      teamLines: z.string().max(4000).nullable().optional(),
      entries: z.array(z.object({
        athleteId: z.string().min(1),
        status: z.number().int().min(0).max(5),
        note: z.string().max(1000).nullable().optional(),
        // I codici si validano qui e non nel database: le liste del fisio
        // cambieranno, e con un enum Postgres ogni voce nuova sarebbe una
        // migrazione. `nullish` perche' svuotare un menu deve poter cancellare.
        nextTraining: z.enum(DailyNextTraining_CODES).nullish(),
        injuryType: z.enum(DailyInjuryType_CODES).nullish(),
        bodyPart: z.enum(DailyBodyPart_CODES).nullish(),
        side: z.enum(DailySide_CODES).nullish(),
        clinicalStatus: z.enum(DailyClinicalStatus_CODES).nullish(),
        taping: z.enum(DailyTaping_CODES).nullish(),
        treatment: z.enum(DailyTreatment_CODES).nullish(),
        trainingType: z.enum(DailyTrainingType_CODES).nullish(),
        forecast: z.enum(DailyForecast_CODES).nullish(),
      })).max(60),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dati non validi', details: parsed.error.flatten().fieldErrors },
      });
    }
    if (!prismaReady()) return notGenerated(reply);
    const { organizationId, userId } = request.user;
    const { teamId, date, activities, teamLines, entries } = parsed.data;

    const team = await app.prisma.team.findFirst({ where: { id: teamId, organizationId }, select: { id: true } });
    if (!team) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Squadra non trovata' } });
    }

    // Nessun atleta di un'altra organizzazione può finire nel report.
    const athleteIds = entries.map((e) => e.athleteId);
    if (athleteIds.length > 0) {
      const valid = await app.prisma.athlete.count({ where: { id: { in: athleteIds }, organizationId } });
      if (valid !== new Set(athleteIds).size) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Uno o più atleti non appartengono a questa organizzazione' },
        });
      }
    }

    const day = dateOnly(date);

    await app.prisma.$transaction(async (tx) => {
      const report = await tx.dailyReport.upsert({
        where: { teamId_date: { teamId, date: day } },
        update: {
          activities: activities as unknown as Prisma.InputJsonValue,
          teamLines: teamLines ?? null,
          createdById: userId,
        },
        create: {
          organizationId,
          teamId,
          date: day,
          activities: activities as unknown as Prisma.InputJsonValue,
          teamLines: teamLines ?? null,
          createdById: userId,
        },
      });

      // Le righe si riscrivono per intero: un giocatore tolto dal report
      // deve sparire, e riconciliare riga per riga costerebbe di più senza
      // dare niente in cambio (sono al massimo qualche decina).
      await tx.dailyReportEntry.deleteMany({ where: { dailyReportId: report.id } });
      if (entries.length > 0) {
        await tx.dailyReportEntry.createMany({
          data: entries.map((e, i) => ({
            dailyReportId: report.id,
            athleteId: e.athleteId,
            date: day,
            status: e.status,
            note: e.note?.trim() ? e.note.trim() : null,
            orderIndex: i,
            nextTraining: e.nextTraining ?? null,
            injuryType: e.injuryType ?? null,
            bodyPart: e.bodyPart ?? null,
            side: e.side ?? null,
            clinicalStatus: e.clinicalStatus ?? null,
            taping: e.taping ?? null,
            treatment: e.treatment ?? null,
            trainingType: e.trainingType ?? null,
            forecast: e.forecast ?? null,
          })),
        });
      }
    });

    const report = await buildReport(organizationId, userId, teamId, date, normalizeLocale((request.query as { locale?: string })?.locale));
    return reply.send({ success: true, data: { report } });
  });

  // ─── GET /daily-report/list ───────────────────────────
  app.get('/daily-report/list', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      teamId: z.string().optional(),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(60),
    });
    const parsed = schema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Parametri non validi' } });
    }
    if (!prismaReady()) return notGenerated(reply);
    const { teamId, from, to, limit } = parsed.data;
    const rows = await app.prisma.dailyReport.findMany({
      where: {
        organizationId: request.user.organizationId,
        ...(teamId ? { teamId } : {}),
        ...(from || to ? { date: { ...(from ? { gte: dateOnly(from) } : {}), ...(to ? { lte: dateOnly(to) } : {}) } } : {}),
      },
      select: {
        id: true, date: true, teamId: true, updatedAt: true,
        team: { select: { name: true, color: true } },
        createdBy: { select: { firstName: true, lastName: true } },
        _count: { select: { entries: true } },
      },
      orderBy: { date: 'desc' },
      take: limit,
    });
    return reply.send({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        date: toDateString(r.date),
        teamId: r.teamId,
        teamName: r.team.name,
        teamColor: r.team.color,
        players: r._count.entries,
        updatedAt: r.updatedAt.toISOString(),
        filledBy: r.createdBy ? `${r.createdBy.firstName} ${r.createdBy.lastName}` : null,
      })),
    });
  });

  // ─── GET /daily-report/export ─────────────────────────
  app.get('/daily-report/export', auth, async (request: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      teamId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      format: z.enum(['PDF', 'DOCX']),
      locale: z.string().optional(),
    });
    const parsed = schema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Parametri non validi' } });
    }
    if (!prismaReady()) return notGenerated(reply);
    const { organizationId, userId } = request.user;
    const { teamId, date, format } = parsed.data;
    const locale = normalizeLocale(parsed.data.locale);

    let report: DailyReportData;
    try {
      report = await buildReport(organizationId, userId, teamId, date, locale);
    } catch (err) {
      if ((err as { code?: string }).code === 'TEAM_NOT_FOUND') {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Squadra non trovata' } });
      }
      throw err;
    }

    const slug = `${(report.metadata.teamName || 'team').toLowerCase().replace(/\s+/g, '_')}`;
    const filename = `report-giornaliero-${slug}-${date}.${format.toLowerCase()}`;

    try {
      const buffer = format === 'PDF'
        ? await renderDailyReportPdf(report)
        : await renderDailyReportDocx(report);
      reply.header('Content-Type', format === 'PDF'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      return reply.send(buffer);
    } catch (err) {
      request.log.error({ err }, 'Daily report render failed');
      return reply.status(500).send({
        success: false,
        error: { code: 'REPORT_FAILED', message: err instanceof Error ? err.message : 'Errore nella generazione del report' },
      });
    }
  });
}
