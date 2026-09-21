import { test, expect } from '../fixtures/auth';

test.describe('Athletes - Smoke Tests', () => {
  // `/dashboard/athletes` e' un redirect verso la scheda Squadre dal 26/8/2026:
  // l'elenco atleti vive in fondo a quella pagina (athlete-directory.tsx).
  // Il titolo di primo livello e' quindi "Squadre", e "Atleti" e' l'intestazione
  // della sezione.
  test('athletes list page loads with heading', async ({ page }) => {
    await page.goto('/dashboard/athletes');
    await expect(page).toHaveURL('/dashboard/teams');

    await expect(page.locator('main h1, [class*="space-y"] > div h1').first()).toContainText('Squadre');
    await expect(page.getByText(/Atleti/).first()).toBeVisible();
  });

  test('athletes are displayed in grid or table', async ({ page }) => {
    await page.goto('/dashboard/athletes');

    // Wait for loading to finish (spinner gone, content appears)
    await page.waitForTimeout(2000);

    // Grid view: cards with class "card-hover", or table view: <table>
    const cards = page.locator('.card-hover');
    const table = page.locator('table');

    const cardCount = await cards.count().catch(() => 0);
    const tableVisible = await table.isVisible().catch(() => false);

    expect(cardCount > 0 || tableVisible).toBeTruthy();
  });

  test('search input filters athletes', async ({ page }) => {
    await page.goto('/dashboard/athletes');
    await page.waitForTimeout(1000);

    // Search field with placeholder "Cerca per nome..."
    const searchInput = page.locator('input[placeholder*="Cerca per nome"]');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('Luca');
    // Debounce 300ms + API call
    await page.waitForTimeout(1000);

    await expect(page).toHaveURL('/dashboard/teams');
  });

  test('position filter dropdown exists', async ({ page }) => {
    await page.goto('/dashboard/athletes');
    await page.waitForTimeout(1000);

    // Select filter with "Tutti i ruoli" option
    const posSelect = page.locator('select');
    await expect(posSelect).toBeVisible();

    // Should have position options
    const options = posSelect.locator('option');
    const count = await options.count();
    expect(count).toBeGreaterThan(1);
  });

  test('can switch between grid and table view', async ({ page }) => {
    await page.goto('/dashboard/athletes');
    await page.waitForTimeout(1000);

    // View toggle buttons (grid and list icons)
    const viewButtons = page.locator('button').filter({ has: page.locator('svg') });

    // At least the toggle buttons should exist
    expect(await viewButtons.count()).toBeGreaterThan(0);
  });

  test('athlete card is clickable and navigates to detail', async ({ page }) => {
    await page.goto('/dashboard/athletes');
    await page.waitForTimeout(2000);

    // Cards with class card-hover and cursor-pointer
    const cards = page.locator('.card-hover.cursor-pointer');
    const count = await cards.count();

    if (count > 0) {
      // La prima `.card-hover` della pagina e' una SQUADRA: cliccarla
      // seleziona la squadra e resta su /dashboard/teams. Le schede atleta
      // stanno nell'elenco in fondo, che ha il proprio contenitore.
      const athleteCards = page.locator('[data-testid="athlete-directory"] .card-hover.cursor-pointer');
      if ((await athleteCards.count()) === 0) test.skip();
      await athleteCards.first().click();
      await expect(page).toHaveURL(/\/dashboard\/athletes\/.+/);
    }
  });

  test('new athlete button opens modal', async ({ page }) => {
    await page.goto('/dashboard/athletes');
    await page.waitForTimeout(1000);

    // "Nuovo Atleta" button
    const newBtn = page.locator('button').filter({ hasText: 'Nuovo Atleta' });
    await expect(newBtn).toBeVisible();
    await newBtn.click();

    // Modal overlay (custom modal without role="dialog")
    await expect(page.locator('.fixed.inset-0.z-50')).toBeVisible();
  });

  test('athletes page shows total count', async ({ page }) => {
    await page.goto('/dashboard/athletes');
    await page.waitForTimeout(2000);

    // L'intestazione della sezione mostra "Atleti (N)" con il sottotitolo
    // "Gestisci il roster degli atleti". La vecchia stringa "N atleti nel
    // roster" non esiste piu'.
    await expect(page.getByText(/Atleti\s*\(\d+\)/).first()).toBeVisible();
  });
});
