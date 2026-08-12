// ============================================
// TrainMind — Authenticated Fetch Utility
// ============================================

import { API_BASE_URL, API_PREFIX } from '../constants';
import { getAccessToken, refreshAccessToken, clearTokens } from './api';

const BASE = `${API_BASE_URL}${API_PREFIX}`;

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res = await fetch(`${BASE}${path}`, { ...options, headers });

  // Auto-refresh on 401
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${refreshed.accessToken}`;
      res = await fetch(`${BASE}${path}`, { ...options, headers });
    } else {
      clearTokens();
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new Error('Sessione scaduta');
    }
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Errore API');
  return data;
}
