
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
