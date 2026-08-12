// ============================================
// TrainMind — Team Types
// ============================================

import type { AthleteSummary } from './athlete';

export interface Team {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  _count: {
    athleteTeams: number;
    trainingPlans: number;
    periodizationPlans: number;
  };
}

export interface TeamDetail extends Omit<Team, '_count'> {
  athletes: AthleteSummary[];
  _count: {
    athleteTeams: number;
    trainingPlans: number;
    periodizationPlans: number;
    calendarEvents: number;
  };
}
