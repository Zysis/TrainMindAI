import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const authDir = path.join(__dirname, '../.auth');
const authFile = path.join(authDir, 'user.json');

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// Amministratore di "TrainMind Demo", la societa' popolata da
// packages/db/prisma/seed-guida.ts: squadre, atleti, wellness, infortuni e i
// 108 esercizi di default. Serve una societa' con dei dati, altrimenti meta'
// dei test verifica elenchi vuoti.
//
// Prima qui c'era `trainer@trainmind.demo`, del vecchio seed, rimosso dal
// database locale il 17/09/2026: da quel giorno la suite non e' piu' partita.
const CREDENTIALS = {
  email: 'coach@example.com',
  password: 'Admin123!',
};

test('authenticate and save session', async ({ browser }) => {
  // Il riscaldamento delle rotte (in fondo) compila mezza applicazione: con i
  // 60 secondi del profilo comune questo passo morirebbe a meta'.
  test.setTimeout(300_000);

  // Create .auth directory
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Login via API to get tokens
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CREDENTIALS),
  });

  if (!response.ok) {
    throw new Error(`Login API failed: ${response.status} ${response.statusText}`);
  }

  const loginData = await response.json();
  const tokens = loginData.data.tokens;

  // Save tokens to file for reuse in fixtures
  fs.writeFileSync(
    authFile,
    JSON.stringify({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    }),
  );

  // Verify tokens work: open browser, inject tokens, check dashboard loads
  const context = await browser.newContext();
  const page = await context.newPage();

  // Go to app and inject tokens into sessionStorage
  await page.goto('/login');
  await page.evaluate((tkns) => {
    sessionStorage.setItem('tm_access_token', tkns.accessToken);
    sessionStorage.setItem('tm_refresh_token', tkns.refreshToken);
  }, tokens);

  // Navigate to dashboard — should work with injected tokens
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/dashboard');

  // ─── Riscaldamento delle rotte ────────────────────────────
  //
  // In locale la suite gira contro `pnpm dev`, che compila ogni rotta alla
  // prima richiesta: la prima visita a una pagina mai aperta puo' superare i
  // 20 secondi, e faceva fallire il primo test di ogni file — sempre uno
  // diverso, a seconda di cosa il server aveva gia' compilato. Non era mai un
  // difetto dell'applicazione, ma costava un giro a capirlo ogni volta.
  //
  // Qui le rotte si visitano una volta, prima che i test comincino. Il primo
  // giro paga la compilazione, tutti gli altri partono a freddo zero.
  const routes = [
    '/dashboard',
    '/dashboard/calendar',
    '/dashboard/teams',
    '/dashboard/training',
    '/dashboard/exercises',
    '/dashboard/periodization',
    '/dashboard/wellness',
    '/dashboard/injuries',
    '/dashboard/analytics',
    '/dashboard/reports',
    '/dashboard/alerts',
    '/dashboard/chat',
    '/dashboard/adaptations',
    '/dashboard/settings',
  ];

  for (const route of routes) {
    try {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    } catch {
      // Una rotta che non risponde la segnalera' il suo test, con il suo
      // messaggio: qui interessa solo che sia stata compilata.
    }
  }

  await context.close();
  console.log('Auth tokens saved to', authFile);
  console.log(`Rotte precompilate: ${routes.length}`);
});
