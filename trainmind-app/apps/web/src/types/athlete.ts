// ============================================
// TrainMind AI — Athlete Types
// ============================================

export interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  jerseyNumber: number | null;
  height: number | null;
  weight: number | null;
  email: string | null;
  isActive: boolean;
  dateOfBirth: string;
}

export interface AthleteDetail {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  jerseyNumber: number | null;
  height: number | null;
  weight: number | null;
  team: string | null;
  dateOfBirth: string;
  isActive: boolean;
  email: string | null;
  photoUrl: string | null;
  createdAt: string;
  wellnessLogs: Array<{
    id: string;
    date: string;
    sleepHours: number;
    sleepQuality: number;
    fatigue: number;
    soreness: number;
    stress: number;
    mood: number;
  }>;
  injuries: Array<{
    id: string;
    type: string;
    location: string;
    severity: number;
    status: string;
  }>;
  _count: {
    trainingSessions: number;
    wellnessLogs: number;
    injuries: number;
  };
}

export interface AthleteListResponse {
  success: boolean;
  data: Athlete[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface AthleteSummary {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  jerseyNumber: number | null;
  photoUrl: string | null;
  isActive: boolean;
  dateOfBirth: string;
}
