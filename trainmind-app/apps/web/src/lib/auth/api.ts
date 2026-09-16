// ============================================
// TrainMind — Auth API Client
// ============================================

import { API_BASE_URL, API_PREFIX } from '../constants';
import { ApiError } from './fetch';

/*
 * Perche' questi helper lanciano ApiError e non Error (16/09/2026).
 *
 * Lanciavano `new Error(data.error?.message)`, cioe' la frase italiana scritta
 * nel backend. `useApiError` traduce **per codice**; senza codice ripiegava sul
 * messaggio del server, e una pagina inglese o spagnola mostrava l'errore in
 * italiano. Si vedeva soprattutto sugli inviti allo staff, dove la pagina e'
 * pubblica e chi la apre non ha ancora scelto una lingua.
 *
 * Il messaggio del server resta dentro l'eccezione: per i codici non ancora
 * tradotti (VALIDATION_ERROR, NOT_FOUND) e' piu' informativo di una frase
 * generica, ed e' esattamente quello che `useApiError` usa come ultima risorsa.
 */

const AUTH_URL = `${API_BASE_URL}${API_PREFIX}/auth`;

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
  avatarUrl?: string;
  /** Lingua UI preferita salvata sul profilo (it | en | es). */
  locale?: string | null;
  organization?: {
    id: string;
    name: string;
    slug: string;
    sport: string;
    tier: string;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResponse {
  success: boolean;
  data: {
    user: AuthUser;
    tokens: AuthTokens;
  };
}

export interface MeResponse {
  success: boolean;
  data: {
    user: AuthUser;
  };
}

// ─── Token Storage (in-memory + sessionStorage) ──────

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function getAccessToken(): string | null {
  if (!accessToken && typeof window !== 'undefined') {
    accessToken = sessionStorage.getItem('tm_access_token');
  }
  return accessToken;
}

export function getRefreshToken(): string | null {
  if (!refreshToken && typeof window !== 'undefined') {
    refreshToken = sessionStorage.getItem('tm_refresh_token');
  }
  return refreshToken;
}

export function setTokens(tokens: AuthTokens): void {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('tm_access_token', tokens.accessToken);
    sessionStorage.setItem('tm_refresh_token', tokens.refreshToken);
  }
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('tm_access_token');
    sessionStorage.removeItem('tm_refresh_token');
  }
}

// ─── API Calls ───────────────────────────────────────

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${AUTH_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(
      data.error?.message || 'Errore di login',
      data.error?.code || 'UNKNOWN',
      res.status,
      data.error?.details,
    );
  }
  setTokens(data.data.tokens);
  return data;
}

/**
 * Provenienza dell'iscrizione. Tutto opzionale: chi digita l'indirizzo a mano
 * non porta nessun parametro, ed e' un caso normale.
 */
export interface SignupAttribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referrer?: string;
  landing?: string;
}

/**
 * Un solo tipo, usato anche dal contesto di autenticazione e dalla pagina.
 * Prima era ricopiato in tre punti: bastava aggiungere un campo per
 * ritrovarsi con tre definizioni che divergevano in silenzio.
 */
export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
  dateOfBirth: string; // YYYY-MM-DD — gate 14+
  plan?: 'starter' | 'professional' | 'ultra'; // piano scelto in registrazione
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  consentHealthData?: boolean; // opt-in art. 9 GDPR
  acceptMarketing?: boolean; // opt-in facoltativo
  uiLanguage?: 'it' | 'en' | 'es'; // proof-of-consent locale
  attribution?: SignupAttribution;
  /**
   * Token che apre il cancello quando le registrazioni pubbliche sono chiuse
   * (fase di test in produzione). Viaggia in un'intestazione e NON nel corpo:
   * cosi' non finisce nei log delle richieste insieme ai dati del modulo.
   * Non fa parte di cio' che viene salvato.
   */
  accessToken?: string;
}

export async function register(input: RegisterInput): Promise<LoginResponse> {
  const { accessToken, ...body } = input;
  const res = await fetch(`${AUTH_URL}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { 'x-registration-token': accessToken } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(
      data.error?.message || 'Errore di registrazione',
      data.error?.code || 'UNKNOWN',
      res.status,
      data.error?.details,
    );
  }
  setTokens(data.data.tokens);
  return data;
}

// ─── Invito allo staff ───────────────────────────────
//
// E' l'UNICO modo di entrare in un'organizzazione gia' esistente: la
// registrazione normale ne crea sempre una nuova. Per questo qui non c'e' ne'
// il nome dell'organizzazione ne' l'email — arrivano dal token, e scrivere il
// nome di una societa' altrui non porta da nessuna parte.

const STAFF_URL = `${API_BASE_URL}${API_PREFIX}/staff`;

export interface StaffInvitePreview {
  email: string;
  role: 'ADMIN' | 'TRAINER' | 'MEDICAL' | 'VIEWER';
  organizationName: string;
  organizationLogo?: string | null;
  expiresAt: string;
}

/** Legge l'invito per mostrare a chi ci si sta per unire. Pubblica. */
export async function fetchStaffInvite(token: string): Promise<StaffInvitePreview> {
  const res = await fetch(`${STAFF_URL}/invite/${encodeURIComponent(token)}`);
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(
      data.error?.message || 'Invito non valido o scaduto',
      data.error?.code || 'UNKNOWN',
      res.status,
      data.error?.details,
    );
  }
  return data.data;
}

export interface StaffRegisterInput {
  token: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  consentHealthData?: boolean;
  acceptMarketing?: boolean;
  uiLanguage?: 'it' | 'en' | 'es';
}

export async function registerStaff(input: StaffRegisterInput): Promise<LoginResponse> {
  const res = await fetch(`${STAFF_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(
      data.error?.message || 'Errore di registrazione',
      data.error?.code || 'UNKNOWN',
      res.status,
      data.error?.details,
    );
  }
  setTokens(data.data.tokens);
  return data;
}

/**
 * Un solo rinnovo alla volta.
 *
 * Quando l'access token scade, una pagina che ha piu' richieste in corso le
 * vede tornare tutte con 401 e ognuna chiedeva un rinnovo per conto suo,
 * con lo STESSO refresh token. Il server ruota il token al primo rinnovo e
 * revoca il vecchio: il secondo, se arrivava dopo, prendeva 401 e la pagina
 * mandava l'utente al login dopo un quarto d'ora di lavoro. Ora le richieste
 * concorrenti aspettano lo stesso rinnovo.
 */
let refreshInFlight: Promise<AuthTokens | null> | null = null;

export function refreshAccessToken(): Promise<AuthTokens | null> {
  if (!refreshInFlight) {
    refreshInFlight = doRefreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefreshAccessToken(): Promise<AuthTokens | null> {
  const token = getRefreshToken();
  if (!token) return null;

  try {
    const res = await fetch(`${AUTH_URL}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
    });
    if (!res.ok) {
      clearTokens();
      return null;
    }
    const data = await res.json();
    setTokens(data.data.tokens);
    return data.data.tokens;
  } catch {
    clearTokens();
    return null;
  }
}

export async function fetchMe(): Promise<AuthUser | null> {
  let res = await authFetch(`${AUTH_URL}/me`);

  // If 401, try refresh
  if (res.status === 401) {
    const newTokens = await refreshAccessToken();
    if (!newTokens) return null;
    res = await authFetch(`${AUTH_URL}/me`);
  }

  if (!res.ok) return null;
  const data: MeResponse = await res.json();
  return data.data.user;
}

// ─── Password management ─────────────────────────────

/** Cambio password da utente autenticato. */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<string> {
  const body = JSON.stringify({ currentPassword, newPassword });

  let res = await authFetch(`${AUTH_URL}/change-password`, { method: 'POST', body });
  let data = await res.json();

  // Se l'access token e' scaduto (UNAUTHORIZED) proviamo un refresh e riproviamo
  // una sola volta. Attenzione a NON confondere questo caso con
  // INVALID_CREDENTIALS, che significa "password attuale sbagliata": li'
  // ritentare sarebbe inutile e mostrerebbe all'utente un errore fuorviante.
  if (res.status === 401 && data.error?.code === 'UNAUTHORIZED') {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await authFetch(`${AUTH_URL}/change-password`, { method: 'POST', body });
      data = await res.json();
    }
  }

  if (!res.ok) {
    throw new ApiError(
      data.error?.message || 'Errore durante il cambio password',
      data.error?.code || 'UNKNOWN',
      res.status,
      data.error?.details,
    );
  }
  // Il server invalida il refresh token: puliamo anche lato client per
  // evitare che un refresh successivo fallisca in modo silenzioso.
  clearTokens();
  return data.data.message as string;
}

/** Richiede il link di reset. Non rivela se l'email esiste. */
export async function requestPasswordReset(email: string): Promise<string> {
  const res = await fetch(`${AUTH_URL}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(
      data.error?.message || 'Errore durante la richiesta',
      data.error?.code || 'UNKNOWN',
      res.status,
      data.error?.details,
    );
  }
  return data.data.message as string;
}

/** Verifica che un token di reset sia ancora valido (per la pagina). */
export async function verifyResetToken(token: string): Promise<{ email: string }> {
  const res = await fetch(`${AUTH_URL}/reset-password/${encodeURIComponent(token)}`);
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(
      data.error?.message || 'Link non valido o scaduto',
      data.error?.code || 'UNKNOWN',
      res.status,
      data.error?.details,
    );
  }
  return data.data;
}

/** Imposta la nuova password consumando il token. */
export async function resetPassword(token: string, password: string): Promise<string> {
  const res = await fetch(`${AUTH_URL}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(
      data.error?.message || 'Errore durante il reset',
      data.error?.code || 'UNKNOWN',
      res.status,
      data.error?.details,
    );
  }
  return data.data.message as string;
}

export async function logout(): Promise<void> {
  try {
    await authFetch(`${AUTH_URL}/logout`, { method: 'POST' });
  } catch {
    // Ignore errors on logout
  } finally {
    clearTokens();
  }
}
