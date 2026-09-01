// ============================================
// TrainMind — Shared Type Definitions
// ============================================

// === Enums ===

export const UserRole = {
  ADMIN: 'ADMIN',
  TRAINER: 'TRAINER',
  MEDICAL: 'MEDICAL',
  VIEWER: 'VIEWER',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const SessionStatus = {
  PLANNED: 'PLANNED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export const InjuryStatus = {
  ACTIVE: 'ACTIVE',
  RECOVERING: 'RECOVERING',
  RESOLVED: 'RESOLVED',
} as const;

export type InjuryStatus = (typeof InjuryStatus)[keyof typeof InjuryStatus];

export const RTPPhase = {
  PHASE_1: 'PHASE_1',
  PHASE_2: 'PHASE_2',
  PHASE_3: 'PHASE_3',
  PHASE_4: 'PHASE_4',
  PHASE_5: 'PHASE_5',
  CLEARED: 'CLEARED',
} as const;

export type RTPPhase = (typeof RTPPhase)[keyof typeof RTPPhase];

// === Base Entity Types ===

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User extends BaseEntity {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organizationId: string;
  avatarUrl?: string;
  isActive: boolean;
}

export interface Organization extends BaseEntity {
  name: string;
  slug: string;
  sport: string;
  tier: 'STARTER' | 'PROFESSIONAL' | 'ULTRA';
}

export interface Athlete extends BaseEntity {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  position: string;
  jerseyNumber?: number;
  height?: number;
  weight?: number;
  organizationId: string;
  isActive: boolean;
  photoUrl?: string;
}

export interface TrainingPlan extends BaseEntity {
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  athleteId?: string;
  organizationId: string;
  createdById: string;
}

export interface TrainingSession extends BaseEntity {
  title: string;
  date: Date;
  duration: number;
  status: SessionStatus;
  notes?: string;
  weekId: string;
  rpe?: number;
  athleteId?: string;
}

export interface Exercise extends BaseEntity {
  name: string;
  category: string;
  description?: string;
  muscleGroups: string[];
  equipment?: string[];
  videoUrl?: string;
  organizationId: string;
}

export interface WellnessLog extends BaseEntity {
  athleteId: string;
  date: Date;
  sleepHours: number;
  sleepQuality: number;
  fatigue: number;
  soreness: number;
  stress: number;
  mood: number;
  notes?: string;
}

export interface Injury extends BaseEntity {
  athleteId: string;
  type: string;
  location: string;
  severity: number;
  status: InjuryStatus;
  dateOccurred: Date;
  dateResolved?: Date;
  notes?: string;
}

// === API Types ===

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
}

// ============================================
// === Reports (Sprint 4.1) ===
// ============================================

export const ReportAudience = {
  STAFF: 'STAFF',           // Technical staff — team readiness, ACWR distribution
  MEDICAL: 'MEDICAL',       // Medical — injured athletes, RTP progress, recovery
  TRAINER: 'TRAINER',       // Preparatore — plan adherence, performance trends
} as const;
export type ReportAudience = (typeof ReportAudience)[keyof typeof ReportAudience];

export const ReportFormat = {
  PDF: 'PDF',
  DOCX: 'DOCX',
  JSON: 'JSON',             // Preview in-browser
} as const;
export type ReportFormat = (typeof ReportFormat)[keyof typeof ReportFormat];

/** KPI card rendered in report header */
export interface ReportKPI {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'flat';
  delta?: string;           // e.g. "+12% vs prev period"
  severity?: 'info' | 'success' | 'warning' | 'danger';
}

/** Generic table section for the report */
export interface ReportTable {
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  footnote?: string;
}

/** Chart data passed to the renderer (rendered server-side into PNG) */
export interface ReportChart {
  title: string;
  type: 'line' | 'bar' | 'pie' | 'area';
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    color?: string;
  }>;
  yAxisLabel?: string;
  xAxisLabel?: string;
}

/** Common metadata present in every report */
export interface ReportMetadata {
  audience: ReportAudience;
  organizationName: string;
  periodFrom: string;       // ISO date
  periodTo: string;         // ISO date
  generatedAt: string;      // ISO datetime
  generatedBy: string;      // User name
  logoUrl?: string;
  teamName?: string;        // When report is filtered by team
  athleteName?: string;     // When report is filtered by a single athlete
}

// ─── Audience-specific payloads ──────────────────────────

/** Staff report — team overview for technical staff */
export interface StaffReportData {
  audience: 'STAFF';
  metadata: ReportMetadata;
  summary: string;                   // AI-generated narrative
  kpis: ReportKPI[];                 // readiness, completion %, active alerts, injured count
  acwrDistribution: {
    low: number;                     // athletes in ACWR < 0.8
    optimal: number;                 // 0.8-1.3
    high: number;                    // 1.3-1.5
    danger: number;                  // > 1.5
  };
  sessionsCompleted: {
    planned: number;
    completed: number;
    cancelled: number;
    completionRate: number;
  };
  activeAlerts: ReportTable;         // severity × athlete × metric × value
  wellnessTrend: ReportChart;        // team avg wellness over period
  loadTrend: ReportChart;            // team acute/chronic load
}

/** Medical report — injury and RTP focus */
export interface MedicalReportData {
  audience: 'MEDICAL';
  metadata: ReportMetadata;
  summary: string;
  kpis: ReportKPI[];                 // active injuries, RTP in progress, cleared, avg recovery days
  injuredAthletes: ReportTable;      // athlete × injury × phase × days_since × expected_return
  rtpProgress: ReportChart | null;   // phase distribution (null if no data)
  recoveryMetrics: ReportTable;      // sleep, soreness, fatigue averages per injured athlete
  wellnessFlags: ReportTable;        // athletes with poor wellness trends
  injuryHistoryByType?: ReportChart; // injury distribution by type
  injuryHistoryByZone?: ReportChart; // injury distribution by body zone
  injuredWellnessTrend?: ReportChart;// wellness trend for injured athletes
  loadVsInjuries?: ReportChart;      // load vs injuries correlation
}

/** Trainer report — plan adherence and performance */
export interface TrainerReportData {
  audience: 'TRAINER';
  metadata: ReportMetadata;
  summary: string;
  kpis: ReportKPI[];                 // adherence %, avg RPE deviation, adaptations applied, PRs
  adherenceByAthlete: ReportTable;   // athlete × planned × completed × adherence%
  performanceTrends: ReportChart;    // avg volume/intensity over period
  plannedVsActual: ReportChart;      // planned load vs actual load
  adaptations: ReportTable;          // recent PlanAdaptation history
  topMovers: ReportTable;            // athletes with biggest volume/intensity deltas
}

export type ReportData = StaffReportData | MedicalReportData | TrainerReportData;

// ============================================
// === Daily report (foglio di fine giornata) ===
// ============================================
//
// Volutamente FUORI da ReportAudience e da ReportData: quell'unione alimenta
// i report schedulati e la rotta /ai/report, che ragionano per periodo e per
// destinatario. Il report giornaliero e' un'altra cosa — un documento di una
// giornata sola, compilato a mano e salvato — e infilarlo li' avrebbe
// costretto ogni switch esistente a gestire un caso che non gli appartiene.

/** Scala di disponibilita' 0-5. I numeri sono quelli scritti sul foglio. */
export const DailyStatus = {
  OUT: 0,
  REHAB: 1,
  NO_CONTACT: 2,
  REDUCED_LOAD: 3,
  WITH_SUBSTITUTIONS: 4,
  FULL_TRAINING: 5,
} as const;
export type DailyStatus = (typeof DailyStatus)[keyof typeof DailyStatus];

/** Attivita' della giornata: "Basket 60'". */
export interface DailyActivity {
  label: string;
  minutes: number;
}

/** Riga giocatore del report. */
export interface DailyReportEntryData {
  athleteId: string;
  athleteName: string;
  jerseyNumber: number | null;
  photoUrl: string | null;
  status: DailyStatus;
  note: string | null;
  /** Da dove viene lo stato proposto, quando la riga e' ancora una bozza. */
  suggestedFrom?: 'injury' | 'rtp' | null;
  /** Colonne cliniche del foglio di fine giornata. */
  clinical: DailyClinicalFields;
  /** RPE e ACWR recenti: informano la decisione, non la prendono. */
  athleteLoad: DailyAthleteLoad;
  /** Id dell'infortunio aperto da cui nasce la proposta, per il collegamento
   *  alla scheda. Null quando non ce n'e' nessuno. */
  openInjuryId: string | null;
}

/** Una sezione di densita', una per allenamento cronometrato della giornata. */
export interface DailyDensitySection {
  sessionId: string;
  title: string;
  /** Etichetta relativa alla partita piu' vicina: GD-2, GD, GD+1. */
  gameDayLabel: string | null;
  timeRange: string | null;
  athletesAvailable: number;
  totalMs: number;
  /** Somma dei tempi effettivi per giocatore: il numeratore della densita'. */
  activeMs: number;
  pauseMs: number;
  densityPct: number;
  densityBand: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  drills: Array<{
    name: string;
    totalMs: number;
    /** activityMs x (giocatori coinvolti / disponibili) */
    perPlayerMs: number | null;
    /** Solo attivita', senza pause ne' break. */
    workMs: number | null;
  }>;
}

/** Riga del riepilogo carico della giornata. */
export interface DailyLoadRow {
  athleteId: string;
  athleteName: string;
  minutes: number;
  rpe: number | null;
  load: number | null;
  source: 'TRAINING' | 'GAME' | 'MIXED';
}

// ============================================
// === Report post-partita ====================
// ============================================
//
// Come il report giornaliero, fuori da `ReportData`: quell'unione alimenta i
// report per periodo e per destinatario, questo e' il foglio di UNA partita.

/** Un turno in campo, cosi' come va mostrato nel report. */
export interface GameReportStint {
  quarter: number;
  /** Etichetta del periodo gia' composta: Q1..Qn, OT1..OTn. */
  periodLabel: string;
  /** Ms di quarto trascorso in cui il giocatore e' entrato e uscito. */
  inMs: number;
  outMs: number;
  /** Tempo netto in campo: il cronometro e' fermo durante le interruzioni. */
  durationMs: number;
  /** Quante volte il gioco si e' fermato mentre era in campo. */
  breaks: number;
}

export interface GameReportPlayer {
  athleteId: string;
  athleteName: string;
  jerseyNumber: number | null;
  photoUrl: string | null;

  /** Minuti giocati in questa partita, arrotondati come il carico. */
  minutes: number;
  totalPlayingMs: number;
  /** Ms giocati in ciascun periodo, indicizzati da 1. */
  msByPeriod: Record<string, number>;
  stints: GameReportStint[];
  stintCount: number;
  breakCount: number;

  rpe: number | null;
  /** sRPE = RPE x minuti. Null senza RPE. */
  load: number | null;

  /** Media minuti nelle partite precedenti completate, e scarto da questa. */
  seasonAvgMinutes: number | null;
  minutesDelta: number | null;

  /** ACWR ricalcolato includendo questa partita. */
  acwr: number | null;
  acwrZone: 'low' | 'optimal' | 'high' | 'danger' | null;

  /** Aspettativa di allenamento per la seduta successiva, 0-5. */
  readiness: number | null;
  readinessNote: string | null;
}

export interface GameReportTeamSummary {
  playersUsed: number;
  playersDressed: number;
  totalMinutes: number;
  /** Minuti-uomo teorici: periodi x durata x 5 in campo. */
  expectedMinutes: number;
  avgRpe: number | null;
  totalLoad: number;
  avgStintsPerPlayer: number | null;
  totalBreaks: number;
}

export interface GameReportData {
  kind: 'GAME';
  metadata: ReportMetadata;
  gameSessionId: string;

  /** Nome delle due squadre nell'ordine del tabellone: casa prima. */
  homeTeamName: string;
  awayTeamName: string;
  /** true quando la squadra dell'organizzazione gioca in casa. */
  isHome: boolean | null;
  homeScore: number | null;
  awayScore: number | null;
  competition: string | null;
  venue: string | null;
  /** ISO datetime di inizio partita. */
  playedAt: string;
  dateLabel: string;
  timeLabel: string;

  quarters: number;
  overtimes: number;
  quarterDurationMs: number;
  periodLabels: string[];

  players: GameReportPlayer[];
  summary: GameReportTeamSummary;

  /** Etichette 0-5 gia' tradotte, per i renderer che non hanno i18n. */
  statusLabels: Record<string, string>;
  labels: Record<string, string>;
}

/** Una partita completata, per l'elenco da cui si sceglie il report. */
export interface GameReportListItem {
  gameSessionId: string;
  calendarEventId: string;
  title: string;
  playedAt: string;
  teamId: string | null;
  teamName: string | null;
  opponent: string | null;
  isHome: boolean | null;
  homeScore: number | null;
  awayScore: number | null;
  competition: string | null;
  playersUsed: number;
}

// ── Vocabolario clinico del report giornaliero ──────────
//
// Elenchi VOLUTAMENTE separati da quelli della scheda Infortuni: il foglio di
// fine giornata parla la lingua del fisioterapista a bordo campo
// ("infiammazione alla fascia plantare"), la scheda Infortuni quella della
// cartella clinica. Sono due vocabolari, e vanno tenuti d'occhio: se un
// giorno divergono al punto da confondere, la strada e' unificarli, non
// aggiungerne un terzo.
//
// I codici stanno qui, in un posto solo, cosi' API e web non possono
// divergere; le etichette vivono negli i18n dei due lati.
export const DailyNextTraining_CODES = ['available', 'partial', 'unavailable'] as const;
export type DailyNextTraining = (typeof DailyNextTraining_CODES)[number];
export const DailyInjuryType_CODES = ['inflammation', 'tendinopathy', 'periostitis', 'bone_edema', 'contracture', 'strain', 'tear', 'sprain', 'contusion', 'overload', 'other'] as const;
export type DailyInjuryType = (typeof DailyInjuryType_CODES)[number];
export const DailyBodyPart_CODES = ['plantar_fascia', 'achilles', 'tibia', 'ankle', 'foot', 'calf', 'knee', 'patellar_tendon', 'quadriceps', 'hamstring', 'adductor', 'hip', 'lumbar', 'dorsal', 'cervical', 'shoulder', 'elbow', 'wrist', 'hand', 'other'] as const;
export type DailyBodyPart = (typeof DailyBodyPart_CODES)[number];
export const DailySide_CODES = ['left', 'right', 'bilateral'] as const;
export type DailySide = (typeof DailySide_CODES)[number];
export const DailyClinicalStatus_CODES = ['mild', 'stationary', 'improving', 'worsening', 'persistent', 'resolved'] as const;
export type DailyClinicalStatus = (typeof DailyClinicalStatus_CODES)[number];
export const DailyTaping_CODES = ['taping', 'kinesio', 'brace', 'bandage', 'insole'] as const;
export type DailyTaping = (typeof DailyTaping_CODES)[number];
export const DailyTreatment_CODES = ['assessment', 'physio', 'medical_check', 'imaging', 'specialist', 'rest', 'therapy'] as const;
export type DailyTreatment = (typeof DailyTreatment_CODES)[number];
export const DailyTrainingType_CODES = ['full', 'partial', 'individual', 'gym_only', 'rehab', 'rest'] as const;
export type DailyTrainingType = (typeof DailyTrainingType_CODES)[number];
export const DailyForecast_CODES = ['next_session', 'days_2_3', 'week_1', 'weeks_2_3', 'month_plus', 'to_define'] as const;
export type DailyForecast = (typeof DailyForecast_CODES)[number];

/** I campi clinici di una riga giocatore. Tutti facoltativi: il foglio si
 *  compila per eccezione, la maggior parte delle righe resta vuota. */
export interface DailyClinicalFields {
  nextTraining: DailyNextTraining | null;
  injuryType: DailyInjuryType | null;
  bodyPart: DailyBodyPart | null;
  side: DailySide | null;
  clinicalStatus: DailyClinicalStatus | null;
  taping: DailyTaping | null;
  treatment: DailyTreatment | null;
  trainingType: DailyTrainingType | null;
  forecast: DailyForecast | null;
}

/** Carico recente dell'atleta, mostrato accanto allo stato come supporto alla
 *  decisione. Non lo determina: l'ACWR e' un indicatore di rischio, non un
 *  verdetto di disponibilita'. */
export interface DailyAthleteLoad {
  /** RPE medio della giornata, null se non registrato. */
  rpeToday: number | null;
  /** Carico sRPE della giornata. */
  loadToday: number | null;
  /** Acuto 7 giorni / cronico 21 giorni diviso 3. null se non calcolabile. */
  acwr: number | null;
  acwrZone: 'low' | 'optimal' | 'high' | 'danger' | null;
}

export interface DailyReportData {
  kind: 'DAILY';
  metadata: ReportMetadata;
  /** Data del report, YYYY-MM-DD. */
  date: string;
  /** Nome del giorno gia' tradotto nella lingua richiesta. */
  weekdayLabel: string;
  teamId: string;
  activities: DailyActivity[];
  entries: DailyReportEntryData[];
  teamLines: string | null;
  density: DailyDensitySection[];
  /** Perche' la sezione densita' e' vuota, quando lo e'. */
  densityDiagnostics: {
    /** Fogli di campo trovati per la giornata. */
    sheets: number;
    /** Quelli con almeno un esercizio cronometrato: le sezioni prodotte. */
    withDrills: number;
    withoutDrills: number;
    /** Eventi di calendario del giorno, fogli o no. */
    eventsInDay: number;
  };
  load: DailyLoadRow[];
  /** false = non e' ancora stato salvato: quello che vedi e' una proposta. */
  saved: boolean;
  /** Etichette 0-5 gia' tradotte, per i renderer che non hanno i18n. */
  statusLabels: Record<string, string>;
  /** Intestazioni di colonna e titoli di sezione gia' tradotti. */
  labels: Record<string, string>;
  /** Etichette del vocabolario clinico, per lista e per codice, gia' tradotte:
   *  i renderer PDF/DOCX girano lato server e non hanno i18n. */
  vocabLabels: Record<string, Record<string, string>>;
}

/** Input the frontend sends to /ai/report */
export interface GenerateReportRequest {
  audience: ReportAudience;
  periodFrom: string;                // YYYY-MM-DD
  periodTo: string;                  // YYYY-MM-DD
  format: ReportFormat;
  includeAISummary?: boolean;        // default true
  teamId?: string;                   // filter by team
}

/** Response envelope from /ai/report (JSON format) */
export interface GenerateReportResponse {
  report: ReportData;
  downloadUrl?: string;              // present for PDF/DOCX, absent for JSON
}
