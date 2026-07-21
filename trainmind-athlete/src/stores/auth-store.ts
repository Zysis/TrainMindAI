import { create } from 'zustand';
import { api, setToken, setRefreshToken, clearTokens, isAuthenticated } from '@/lib/api';

interface AthleteProfile {
  id: string;
  email: string;
  athlete: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    position: string;
    jerseyNumber?: number;
    height?: number;
    weight?: number;
    photoUrl?: string;
    teams: { id: string; name: string; color?: string }[];
  };
  organization: { id: string; name: string; logoUrl?: string; sport: string };
}

interface AuthState {
  user: AthleteProfile | null;
  isLoading: boolean;
  isLoggedIn: boolean;

  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  loadProfile: () => Promise<void>;
  checkAuth: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isLoggedIn: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await api.login(email, password) as { success: boolean; data?: { user: { role: string }; tokens: { accessToken: string; refreshToken: string } }; error?: { message: string } };
      if (!res.success || !res.data) {
        set({ isLoading: false });
        return { success: false, error: res.error?.message || 'Login fallito' };
      }

      // Ensure user is ATHLETE
      if (res.data.user.role !== 'ATHLETE') {
        set({ isLoading: false });
        return { success: false, error: 'Questa app è riservata agli atleti. Usa l\'app preparatore per accedere.' };
      }

      setToken(res.data.tokens.accessToken);
      setRefreshToken(res.data.tokens.refreshToken);
      set({ isLoggedIn: true, isLoading: false });

      // Load profile after login
      await get().loadProfile();
      return { success: true };
    } catch {
      set({ isLoading: false });
      return { success: false, error: 'Errore di connessione' };
    }
  },

  logout: () => {
    clearTokens();
    set({ user: null, isLoggedIn: false });
  },

  loadProfile: async () => {
    try {
      const res = await api.getProfile() as { success: boolean; data?: AthleteProfile };
      if (res.success && res.data) {
        set({ user: res.data, isLoggedIn: true });
      }
    } catch {
      // silent fail
    }
  },

  checkAuth: () => {
    const authed = isAuthenticated();
    if (authed && !get().isLoggedIn) {
      set({ isLoggedIn: true });
      get().loadProfile();
    }
    return authed;
  },
}));
