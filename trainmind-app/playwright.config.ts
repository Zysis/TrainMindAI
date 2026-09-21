import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://localhost:3000';
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: [
    ['html'],
    ['list'],
  ],
  use: {
    baseURL,
    // L'app segue la lingua del browser sulle pagine pre-autenticazione: senza
    // questo, il login esce in inglese e i test che cercano "Accedi" falliscono.
    locale: 'it-IT',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Auth setup (runs first)
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Default: solo Chromium per test rapidi in locale
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    // Abilita gli altri browser solo su CI o con --project
    ...(isCI
      ? [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
            dependencies: ['setup'],
          },
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
            dependencies: ['setup'],
          },
          {
            name: 'Mobile Safari',
            use: { ...devices['iPhone 12'] },
            dependencies: ['setup'],
          },
        ]
      : []),
  ],

  /* I server devono essere gia avviati in locale con `pnpm dev`.
     Su CI, Playwright li avvia automaticamente.
     Se vuoi che Playwright li avvii anche in locale,
     usa: pnpm test:e2e:ci */
  webServer: isCI
    ? [
        {
          command: 'pnpm --filter @trainmind/web dev',
          url: 'http://localhost:3000',
          reuseExistingServer: false,
          timeout: 180000,
        },
        {
          command: 'pnpm --filter @trainmind/api dev',
          url: 'http://localhost:3001/api/v1/health',
          reuseExistingServer: false,
          timeout: 180000,
        },
      ]
    : [
        {
          command: 'echo "Servers should already be running (pnpm dev)"',
          url: 'http://localhost:3000',
          reuseExistingServer: true,
          timeout: 5000,
        },
      ],

  // In locale la suite gira contro `pnpm dev`, che compila la rotta alla prima
  // richiesta: la prima navigazione verso una pagina mai visitata puo' superare
  // i 10 secondi. Erano sette test falliti per questo, tutti primi del loro file.
  timeout: 60000,
  expect: { timeout: 20000 },
});
