import { test as base, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const authFile = path.join(__dirname, '../../.auth/user.json');

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
