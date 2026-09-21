import { test as base, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const authFile = path.join(__dirname, '../../.auth/user.json');

// Le chiavi del consenso cookie si leggono dalla sorgente invece di copiarle:
// al prossimo bump di CONSENT_VERSION il banner tornerebbe a comparire e
// nessuno collegherebbe la cosa ai test.
const consentStore = fs.readFileSync(
  path.join(__dirname, '../../apps/web/src/lib/cookie-consent/store.ts'),
  'utf-8',
);
const CONSENT_STORAGE_KEY =
  /CONSENT_STORAGE_KEY = '([^']+)'/.exec(consentStore)?.[1] ?? 'trainmind-cookie-consent';
const CONSENT_VERSION = /CONSENT_VERSION = '([^']+)'/.exec(consentStore)?.[1] ?? '';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Custom test fixture that injects auth tokens into sessionStorage
 * before each test. sessionStorage is not preserved by Playwright's
 * storageState, so we inject tokens manually.
 */
export const test = base.extend({
  page: async ({ browser }, use) => {
    // Read stored tokens
    let tokens: AuthTokens | null = null;
    if (fs.existsSync(authFile)) {
      tokens = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
    }

    const context = await browser.newContext();

    // Tour di benvenuto e banner cookie vivono in localStorage, che Playwright
    // azzera a ogni esecuzione: ricomparivano sempre e coprivano la pagina con
    // un overlay a tutto schermo (`#tour-mask`) e con un `role="dialog"`, che
    // intercettavano i click e confondevano i selettori dei modali.
    // Si dichiarano gia' visti, una volta per contesto.
    await context.addInitScript(
      ({ consentKey, consentVersion }) => {
        try {
          localStorage.setItem('tm_onboarding_complete', 'true');
          // La lingua non viene da Accept-Language ma da questo store: senza,
          // le pagine pre-autenticazione escono in inglese.
          localStorage.setItem('trainmind-locale', 'it');
          localStorage.setItem('trainmind-locale-explicit', '1');
          localStorage.setItem(
            consentKey,
            JSON.stringify({
              version: consentVersion,
              categories: { necessary: true, analytics: false, marketing: false },
              decidedAt: new Date().toISOString(),
              language: 'it',
              userAgent: 'playwright',
            }),
          );
        } catch {
          /* storage non disponibile: pazienza, il test fallira' per altro */
        }
      },
      { consentKey: CONSENT_STORAGE_KEY, consentVersion: CONSENT_VERSION },
    );

    const page = await context.newPage();

    if (tokens) {
      // Navigate to app first (needed to set sessionStorage on the right origin)
      await page.goto('/login', { waitUntil: 'domcontentloaded' });

      // Inject tokens into sessionStorage
      await page.evaluate((tkns) => {
        sessionStorage.setItem('tm_access_token', tkns.accessToken);
        sessionStorage.setItem('tm_refresh_token', tkns.refreshToken);
      }, tokens);
    }

    await use(page);
    await context.close();
  },
});

export { expect };
