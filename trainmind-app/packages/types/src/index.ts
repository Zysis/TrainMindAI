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
