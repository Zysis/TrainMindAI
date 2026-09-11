'use client';

import { useEffect, useState } from 'react';
import type { SignupAttribution } from '@/lib/auth/api';

/**
 * Da dove arriva chi si sta registrando.
 *
 * Due sorgenti, in ordine di attendibilita':
 *
 *  1. i parametri `utm_*` nell'indirizzo, che il sito vetrina riattacca ai
 *     propri link verso la registrazione;
 *  2. il referrer, cioe' la pagina da cui si e' arrivati.
 *
 * Sul referrer c'e' una sottigliezza che vale la pena scrivere: quando
 * l'utente passa dal sito vetrina, `document.referrer` qui vale
 * trainmind-app.com, che non dice niente. La sorgente vera l'ha vista il sito
 * vetrina, e la inoltra nel parametro `ref`. Per questo `ref` ha la
 * precedenza, e il referrer del browser si usa solo se e' di un altro sito —
 * il caso di chi atterra sulla registrazione direttamente da Google.
 */
export function readAttribution(params: URLSearchParams): SignupAttribution | undefined {
  const clean = (value: string | null, max: number): string | undefined => {
    if (!value) return undefined;
    const trimmed = value.trim().slice(0, max);
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const referrerFromSite = clean(params.get('ref'), 500);

  let referrerFromBrowser: string | undefined;
  if (typeof document !== 'undefined' && document.referrer) {
    try {
      const from = new URL(document.referrer);
      // Una navigazione interna non e' una provenienza.
      if (from.hostname !== window.location.hostname) {
        referrerFromBrowser = document.referrer.slice(0, 500);
      }
    } catch {
      // referrer malformato: semplicemente non lo consideriamo.
    }
  }

  const attribution: SignupAttribution = {
    utmSource: clean(params.get('utm_source'), 120),
    utmMedium: clean(params.get('utm_medium'), 120),
    utmCampaign: clean(params.get('utm_campaign'), 200),
    utmTerm: clean(params.get('utm_term'), 200),
    utmContent: clean(params.get('utm_content'), 200),
    referrer: referrerFromSite ?? referrerFromBrowser,
    landing: clean(params.get('landing'), 500),
  };

  // Se non abbiamo osservato nulla non mandiamo un oggetto di campi vuoti:
  // meglio un dato assente che un dato finto.
  const hasSomething = Object.values(attribution).some((v) => v !== undefined);
  return hasSomething ? attribution : undefined;
}

/**
 * Parametri che vanno tramandati di pagina in pagina fino alla registrazione.
 *
 * Serve perche' il percorso reale non e' diretto: dal sito vetrina si arriva
 * alla landing dell'app, e solo da li' alla registrazione. Senza questo, i
 * parametri della campagna morirebbero al primo clic e ogni iscritto
 * risulterebbe arrivato "da nessuna parte".
 *
 * `k` viaggia insieme agli altri: e' il token che apre il cancello quando le
 * registrazioni pubbliche sono chiuse, e deve sopravvivere allo stesso
 * percorso.
 */
const FORWARD_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',
  'landing',
  'k',
] as const;

/**
 * Legge i parametri da tramandare dall'indirizzo corrente.
 *
 * Usa `window.location` dentro un effetto invece di `useSearchParams` di
 * proposito: quest'ultimo obbligherebbe a un confine di Suspense in ogni
 * pagina che lo chiama, e la landing e' prerenderizzata. Al primo render il
 * risultato e' una stringa vuota, poi si popola: per un link va benissimo.
 */
export function useForwardedParams(): string {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const from = new URLSearchParams(window.location.search);
    const kept = new URLSearchParams();
    for (const key of FORWARD_KEYS) {
      const value = from.get(key);
      if (value) kept.set(key, value.slice(0, 500));
    }
    setQuery(kept.toString());
  }, []);

  return query;
}

/** Attacca i parametri tramandati a un indirizzo che potrebbe gia' averne. */
export function withForwarded(href: string, forwarded: string): string {
  if (!forwarded) return href;
  return href.includes('?') ? `${href}&${forwarded}` : `${href}?${forwarded}`;
}
