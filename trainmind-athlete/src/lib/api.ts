// ─── API client for trainmind-athlete ───────────────────
// All requests go through the local Next.js proxy at /api/v1/*
// which forwards to the backend at API_INTERNAL_URL (default :3001)

const BASE = '/api/v1';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('athlete_token');
}

export function setToken(token: string) {
  localStorage.setItem('athlete_token', token);
}

export function setRefreshToken(token: string) {
  localStorage.setItem('athlete_refresh_token', token);
}

export function clearTokens() {
  localStorage.removeItem('athlete_token');
  localStorage.removeItem('athlete_refresh_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  // Handle 401 — try refresh
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers.Authorization = `Bearer ${getToken()}`;
      const retry = await fetch(`${BASE}${path}`, { ...options, headers });
      return retry.json();
    }
    // Refresh failed — clear tokens, redirect to login
    clearTokens();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Session expired');
  }

  return res.json();
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem('athlete_refresh_token');
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.success && data.data?.tokens) {
      setToken(data.data.tokens.accessToken);
      setRefreshToken(data.data.tokens.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ─── Auth ────────────────────────────────────────────────

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  validateInvite: (token: string) =>
    request(`/athlete/invite/${token}`),

  register: (
    token: string,
    password: string,
    consents: { acceptTerms: boolean; acceptHealthData: boolean; ageConfirmed: boolean },
  ) =>
    request('/athlete/register', { method: 'POST', body: JSON.stringify({ token, password, ...consents }) }),

  // Profile
  getProfile: () => request('/athlete/profile'),

  // Sessions
  getSessions: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/athlete/sessions${qs}`);
  },

  getSession: (id: string) => request(`/athlete/sessions/${id}`),

  submitSessionLog: (data: {
    trainingSessionId: string;
    actualRpe?: number;
    notes?: string;
    exerciseChecks?: Record<string, boolean>;
  }) => request('/athlete/session-log', { method: 'POST', body: JSON.stringify(data) }),

  // Wellness
  submitWellness: (data: {
    date: string;
    sleepHours: number;
    sleepQuality: number;
    fatigue: number;
    soreness: number;
    stress: number;
    mood: number;
    notes?: string;
    mediaUrls?: string[];
  }) => request('/athlete/wellness', { method: 'POST', body: JSON.stringify(data) }),

  getWellnessHistory: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/athlete/wellness${qs}`);
  },

  // Notifications
  getNotifications: () => request('/athlete/notifications'),

  markNotificationsRead: (ids: string[]) =>
    request('/athlete/notifications/read', { method: 'POST', body: JSON.stringify({ ids }) }),

  // Push subscription
  savePushSubscription: (sub: PushSubscriptionJSON) =>
    request('/athlete/push-subscription', { method: 'POST', body: JSON.stringify(sub) }),
};
