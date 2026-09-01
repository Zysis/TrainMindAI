// ============================================
// TrainMind — Authenticated Fetch Utility
// ============================================

import { API_BASE_URL, API_PREFIX } from '../constants';
import { getAccessToken, refreshAccessToken, clearTokens } from './api';

/**
 * Errore di una chiamata API, con il codice e i dettagli del server.
 *
 * Prima si lanciava un `Error` col solo messaggio: il `code` andava perso e
 * l'unica cosa mostrabile era il testo italiano scritto nel backend. Con il
 * codice a disposizione il client puo' tradurre (vedi `lib/i18n/api-error.ts`)
 * e ripiegare sul messaggio del server solo per i casi non previsti.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}


const BASE = `${API_BASE_URL}${API_PREFIX}`;

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // Il Content-Type JSON si dichiara SOLO se c'e' davvero un corpo: Fastify
  // rifiuta con 400 (FST_ERR_CTP_EMPTY_JSON_BODY) una richiesta che dice
  // "application/json" ma arriva vuota, ed e' cosi' che POST senza body
  // fallivano con un errore generico.
  const hasBody = options.body !== undefined && options.body !== null;
  const headers: Record<string, string> = {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
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
      throw new ApiError('Sessione scaduta', 'SESSION_EXPIRED', 401);
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      data.error?.message || 'Errore API',
      data.error?.code || 'UNKNOWN',
      res.status,
      data.error?.details,
    );
  }
  return data;
}
