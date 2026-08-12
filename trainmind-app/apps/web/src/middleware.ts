import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Content-Security-Policy con nonce per richiesta.
 *
 * Perche' qui e non in next.config.mjs: il nonce deve cambiare a ogni
 * richiesta, mentre gli header di `next.config.mjs` sono statici. Questo e'
 * anche il motivo per cui il middleware esiste — non per l'autenticazione:
 * i token stanno in `sessionStorage`, che il server non puo' leggere, e le
 * pagine sono gusci renderizzati lato client senza dati dentro. Il controllo
 * di accesso che conta e' nell'API (`apps/api/src/plugins/auth.ts`).
 *
 * Contro cosa protegge: i token di sessione sono leggibili da qualunque
 * JavaScript in esecuzione sulla pagina. Un XSS potrebbe esfiltrarli, e la CSP
 * e' la difesa principale contro l'XSS.
 *
 * ─── FASE DI ATTIVAZIONE ─────────────────────────────────────────────────
 * `CSP_REPORT_ONLY = true` invia l'header in modalita' sola-segnalazione: il
 * browser registra in console cio' che verrebbe bloccato ma non blocca nulla.
 * Serve a scoprire risorse legittime dimenticate senza rompere l'app.
 *
 * Per attivare la protezione: naviga tutte le sezioni, controlla che la
 * console non riporti violazioni, poi metti la costante a `false`.
 */
const CSP_REPORT_ONLY = false;

/** Origine dell'API, da consentire in connect-src. */
const API_ORIGIN = (() => {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  try {
    return new URL(raw).origin;
  } catch {
    return raw;
  }
})();

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV !== 'production';

  const csp = [
    `default-src 'self'`,
    // 'strict-dynamic' fa sì che gli script caricati da uno script con nonce
    // valido siano a loro volta consentiti: e' cio' che permette a Next.js di
    // caricare i propri chunk senza elencarli. In dev serve 'unsafe-eval',
    // che il refresh rapido di Next richiede.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // Tailwind e Next iniettano stili inline: senza 'unsafe-inline' l'app
    // apparirebbe senza formattazione. E' un compromesso accettabile perche'
    // il vettore pericoloso sono gli script, non i fogli di stile.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' ${API_ORIGIN}${isDev ? ' ws: http://localhost:*' : ''}`,
    // I video degli esercizi sono incorporati da YouTube e Vimeo
    // (video-player-modal.tsx e dashboard/sessions/[id]). Senza questa
    // direttiva ricadrebbero su default-src 'self' e resterebbero neri.
    `frame-src https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://player.vimeo.com`,
    // Fallback dello stesso componente: se l'URL non e' YouTube ne' Vimeo
    // viene usato un tag <video src> con un indirizzo arbitrario.
    `media-src 'self' blob: https:`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ');

  // Next.js legge il nonce dall'header di RICHIESTA Content-Security-Policy e
  // lo applica ai propri script inline. Questo header resta interno al server:
  // al browser arriva solo quello impostato sulla risposta piu' sotto.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set(
    CSP_REPORT_ONLY ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy',
    csp,
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Tutte le pagine tranne le risorse statiche, che non eseguono script e
     * non hanno bisogno di un nonce. Escluderle evita di far girare il
     * middleware su ogni immagine e file di build.
     */
    {
      // Nota: i percorsi qui sono relativi al basePath — se l'app è servita
      // sotto /app, Next confronta il matcher con la parte dopo il prefisso.
      source:
        '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|offline.html).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
