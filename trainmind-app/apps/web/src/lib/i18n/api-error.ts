'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/auth/fetch';

/**
 * Traduce l'errore di una chiamata API.
 *
 * I messaggi del backend sono scritti in italiano dentro il codice: mostrarli
 * cosi' com'e' significa avere un'app inglese che a ogni errore parla italiano.
 * Qui si traduce per **codice**, che e' stabile e non dipende dalla lingua del
 * server; il messaggio del server resta come ultima risorsa per i codici non
 * previsti — meglio una frase in italiano che nessuna spiegazione.
 *
 * L'elenco e' esplicito e non si interroga `t.has`: cosi' non dipende dalla
 * versione di next-intl, e si vede a colpo d'occhio cosa e' tradotto.
 *
 * I codici generici `NOT_FOUND` e `VALIDATION_ERROR` sono volutamente **fuori**:
 * lato server dicono cose molto diverse fra loro ("Piano non trovato",
 * "Atleta non trovato", "Formato data: YYYY-MM-DD") e una traduzione unica
 * perderebbe proprio l'informazione utile. Per quelli passa il messaggio del
 * server, che e' specifico.
 */
const TRANSLATED_CODES = new Set([
  'SESSION_EXPIRED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'INVALID_CREDENTIALS',
  'RATE_LIMIT_EXCEEDED',
  'CONFLICT',
  'INTERNAL',
  'UNKNOWN',
  // cancellazioni bloccate
  'PLAN_IN_PERIODIZATION',
  'SESSION_IN_PLAN',
  'SESSION_NOT_IN_PLAN',
  'EVENT_ALREADY_COMPLETED',
  'SESSION_ALREADY_COMPLETED',
  // configurazione: il client Prisma non e' stato rigenerato dopo una migrazione
  'PRISMA_CLIENT_OUTDATED',
  'EXERCISE_IN_USE',
  // inviti allo staff: la pagina e' pubblica e chi la apre non ha ancora
  // scelto una lingua, quindi il messaggio del server non basta mai
  'INVITE_NOT_FOUND',
  'INVITE_REVOKED',
  'INVITE_ACCEPTED',
  'INVITE_EXPIRED',
  'INVALID_INVITE',
  'NO_SEAT_AVAILABLE',
  'EMAIL_ALREADY_REGISTERED',
  // AI
  'AI_SERVICE_DOWN',
  'AI_SERVICE_TIMEOUT',
  'AI_SERVICE_UNAVAILABLE',
  'AI_SERVICE_ERROR',
  'AI_FALLBACK_ERROR',
  'AI_RESPONSE_TRUNCATED',
  'EMPTY_PLAN',
]);

/**
 * La funzione e' memoizzata su `t` (che next-intl gia' memoizza): restituirne
 * una nuova a ogni render la rendeva inutilizzabile nelle dipendenze di
 * `useCallback`/`useEffect`. Chi la metteva fra le dipendenze si ritrovava un
 * ciclo di fetch infinito, perche' l'effetto rivedeva una funzione diversa a
 * ogni giro. E' successo nella libreria dei protocolli RTP.
 */
export function useApiError() {
  const t = useTranslations('apiErrors');

  /**
   * @param fallback testo gia' tradotto da usare se l'errore non dice nulla di
   *                 utile. E' quello che i chiamanti mostravano prima.
   */
  return useCallback((err: unknown, fallback?: string): string => {
    if (err instanceof ApiError) {
      if (TRANSLATED_CODES.has(err.code)) {
        const details = (err.details ?? {}) as Record<string, string | number>;
        return t(err.code, details);
      }
      if (err.message) return err.message;
    }
    if (err instanceof Error && err.message) return err.message;
    return fallback ?? t('generic');
  }, [t]);
}
