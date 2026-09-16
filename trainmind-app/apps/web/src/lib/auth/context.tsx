'use client';

import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  login as apiLogin,
  register as apiRegister,
  registerStaff as apiRegisterStaff,
  type RegisterInput,
  type StaffRegisterInput,
  logout as apiLogout,
  fetchMe,
  clearTokens,
  getAccessToken,
  type AuthUser,
} from './api';
import {
  hasExplicitLocale,
  isLocale,
  pushLocaleToServer,
  useLocaleStore,
} from '@/lib/i18n/store';

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  /** Registrazione da invito: entra in un'organizzazione gia' esistente. */
  registerStaff: (input: StaffRegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Allinea lingua UI e profilo utente subito dopo l'autenticazione.
   *
   * Regola: se l'utente ha scelto la lingua a mano (switcher su landing o
   * login) quella scelta vince e diventa la lingua di default dell'account.
   * Altrimenti adottiamo la lingua salvata a profilo, cosi l'account "porta
   * con se" la sua lingua anche su un dispositivo nuovo.
   */
  const syncLocaleWithUser = useCallback((account: AuthUser | null) => {
    if (!account) return;
    const { locale: currentLocale, applyServerLocale } = useLocaleStore.getState();

    if (hasExplicitLocale() || !isLocale(account.locale)) {
      if (account.locale !== currentLocale) void pushLocaleToServer(currentLocale);
      return;
    }
    applyServerLocale(account.locale);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await fetchMe();
      setUser(me);
      syncLocaleWithUser(me);
    } catch {
      setUser(null);
      clearTokens();
    }
  }, [syncLocaleWithUser]);

  // Check auth state on mount
  useEffect(() => {
    const init = async () => {
      const token = getAccessToken();
      if (token) {
        await refreshUser();
      }
      setIsLoading(false);
    };
    init();
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiLogin(email, password);
      setUser(response.data.user);
      // La lingua con cui si e' fatto il login diventa quella dell'app.
      syncLocaleWithUser(response.data.user);
    },
    [syncLocaleWithUser],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const response = await apiRegister(input);
      setUser(response.data.user);
      syncLocaleWithUser(response.data.user);
    },
    [syncLocaleWithUser],
  );

  const registerStaff = useCallback(
    async (input: StaffRegisterInput) => {
      const response = await apiRegisterStaff(input);
      setUser(response.data.user);
      syncLocaleWithUser(response.data.user);
    },
    [syncLocaleWithUser],
  );

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        registerStaff,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
