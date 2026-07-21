// ============================================
// TrainMind AI — Auth API Client
// ============================================

import { API_BASE_URL, API_PREFIX } from '../constants';

const AUTH_URL = `${API_BASE_URL}${API_PREFIX}/auth`;

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
  avatarUrl?: string;
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
  if (!res.ok) throw new Error(data.error?.message || 'Errore di login');
  setTokens(data.data.tokens);
  return data;
}

export async function register(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
}): Promise<LoginResponse> {
  const res = await fetch(`${AUTH_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Errore di registrazione');
  setTokens(data.data.tokens);
  return data;
}

export async function refreshAccessToken(): Promise<AuthTokens | null> {
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

export async function logout(): Promise<void> {
  try {
    await authFetch(`${AUTH_URL}/logout`, { method: 'POST' });
  } catch {
    // Ignore errors on logout
  } finally {
    clearTokens();
  }
}
