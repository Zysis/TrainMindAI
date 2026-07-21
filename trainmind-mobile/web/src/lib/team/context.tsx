'use client';

import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch } from '@/lib/auth/fetch';

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  _count?: {
    athleteTeams: number;
    trainingPlans: number;
    periodizationPlans: number;
  };
}

export interface TeamContextType {
  teams: Team[];
  selectedTeamId: string | null;
  selectedTeam: Team | null;
  isLoading: boolean;
  selectTeam: (teamId: string | null) => void;
  refreshTeams: () => Promise<void>;
}

export const TeamContext = createContext<TeamContextType | null>(null);

const STORAGE_KEY = 'trainmind_selected_team';

export function TeamProvider({ children }: { children: ReactNode }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Load saved selection from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setSelectedTeamId(saved);
    setInitialized(true);
  }, []);

  const refreshTeams = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch<{ data: Team[]; meta: unknown }>('/teams?limit=50');
      setTeams(res.data || []);

      // If saved team no longer exists, clear selection
      if (selectedTeamId && res.data && !res.data.find((t: Team) => t.id === selectedTeamId)) {
        setSelectedTeamId(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTeamId]);

  // Fetch teams on mount
  useEffect(() => {
    if (initialized) {
      refreshTeams();
    }
  }, [initialized, refreshTeams]);

  const selectTeam = useCallback((teamId: string | null) => {
    setSelectedTeamId(teamId);
    if (teamId) {
      localStorage.setItem(STORAGE_KEY, teamId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || null;

  return (
    <TeamContext.Provider
      value={{
        teams,
        selectedTeamId,
        selectedTeam,
        isLoading,
        selectTeam,
        refreshTeams,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}
