'use client';

import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch } from '@/lib/auth/fetch';
import { useAuth } from '@/hooks/use-auth';

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

// La squadra selezionata si salva PER UTENTE, non per browser.
//
// Prima la chiave era una sola (`trainmind_selected_team`) e `localStorage` e'
// dell'intera origine: tutte le schede, e quindi tutti gli account aperti sullo
// stesso browser, leggevano e scrivevano lo stesso valore. Il token invece sta
// in `sessionStorage` ed e' per scheda, quindi due preparatori della stessa
// societa' potevano essere loggati davvero in parallelo — e ritrovarsi il
// filtro squadra dell'altro. Il calendario passa quel valore all'API come
// `&teamId=`, e gli eventi senza squadra (individuali, medici, riunioni)
// sparivano senza che nulla lo spiegasse a schermo.
//
// Fra organizzazioni diverse il caso si chiudeva da solo, perche' `refreshTeams`
// cancella una selezione che non compare fra le squadre dell'utente. Dentro la
// stessa societa' no: la squadra esiste per entrambi e il filtro restava.
const STORAGE_PREFIX = 'trainmind_selected_team:';

// La vecchia chiave globale. Alla prima apertura dopo l'aggiornamento il valore
// viene spostato sull'utente che sta usando la scheda e la chiave condivisa
// sparisce, cosi' chi aveva una squadra selezionata se la ritrova e nessun
// altro account se la porta dietro.
const LEGACY_STORAGE_KEY = 'trainmind_selected_team';

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const storageKey = user ? `${STORAGE_PREFIX}${user.id}` : null;

  // Carica la selezione salvata, ma solo quando si sa chi e' loggato.
  useEffect(() => {
    if (!storageKey) {
      // Logout, o autenticazione ancora in corso: nessun filtro attivo.
      // Il valore su `localStorage` resta, cosi' al rientro l'utente ritrova
      // la sua squadra.
      setSelectedTeamId(null);
      setInitialized(false);
      return;
    }

    try {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        if (!localStorage.getItem(storageKey)) localStorage.setItem(storageKey, legacy);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
      setSelectedTeamId(localStorage.getItem(storageKey));
    } catch {
      // Navigazione privata o storage negato: si resta senza filtro.
      setSelectedTeamId(null);
    }
    setInitialized(true);
  }, [storageKey]);

  const refreshTeams = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch<{ data: Team[]; meta: unknown }>('/teams?limit=50');
      setTeams(res.data || []);

      // If saved team no longer exists, clear selection
      if (selectedTeamId && res.data && !res.data.find((t: Team) => t.id === selectedTeamId)) {
        setSelectedTeamId(null);
        if (storageKey) {
          try {
            localStorage.removeItem(storageKey);
          } catch {
            /* storage non disponibile: la selezione resta comunque azzerata */
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTeamId, storageKey]);

  // Fetch teams on mount
  useEffect(() => {
    if (initialized) {
      refreshTeams();
    }
  }, [initialized, refreshTeams]);

  const selectTeam = useCallback(
    (teamId: string | null) => {
      setSelectedTeamId(teamId);
      if (!storageKey) return;
      try {
        if (teamId) {
          localStorage.setItem(storageKey, teamId);
        } else {
          localStorage.removeItem(storageKey);
        }
      } catch {
        /* storage non disponibile: la selezione vale per questa sessione */
      }
    },
    [storageKey],
  );

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
