import { create } from 'zustand';
import { api, setToken, setRefreshToken, clearTokens, isAuthenticated } from '@/lib/api';
import {
  hasExplicitLocale,
  isLocale,
  pushLocaleToServer,
  useLocaleStore,
} from '@/lib/i18n/store';

/**
 * Allinea lingua UI e profilo utente subito dopo il login.
 *
 * Se l'atleta ha scelto la lingua a mano nella schermata di accesso, quella
 * scelta vince e diventa la lingua di default dell'account. Altrimenti
 * adottiamo la lingua gia' salvata a profilo, cosi l'account la "porta con
 * se" anche su un dispositivo nuovo.
 */
function syncLocaleWithUser(serverLocale: string | null | undefined) {
  const { locale: currentLocale, applyServerLocale } = useLocaleStore.getState();

  if (hasExplicitLocale() || !isLocale(serverLocale)) {
    if (serverLocale !== currentLocale) void pushLocaleToServer(currentLocale);
    return;
  }
  applyServerLocale(serverLocale);
}

interface AthleteProfile {
  id: string;
  email: string;
  /** Lingua UI preferita salvata sul profilo (it | en | es). */
  locale?: string | null;
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
      const res = await api.login(email, password) as { success: boolean; data?: { user: { role: string; locale?: string | null }; tokens: { accessToken: string; refreshToken: string } }; error?: { message: string } };
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

      // Il token c'e': ora possiamo allineare la lingua col profilo.
      syncLocaleWithUser(res.data.user.locale);

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
        // Riapertura dell'app con sessione attiva: ripristina la lingua
        // dell'account se l'utente non ne ha scelta una a mano.
        syncLocaleWithUser(res.data.locale);
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
