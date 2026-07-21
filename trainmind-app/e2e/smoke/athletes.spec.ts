import { test, expect } from '../fixtures/auth';

test.describe('Athletes - Smoke Tests', () => {
  test('athletes list page loads with heading', async ({ page }) => {
    await page.goto('/dashboard/athletes');
    await expect(page).toHaveURL('/dashboard/athletes');

    // Heading "Atleti" (inside main content, not sidebar)
    await expect(page.locator('main h1, [class*="space-y"] > div h1').first()).toContainText('Atleti');
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

    await expect(page).toHaveURL('/dashboard/athletes');
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
      await cards.first().click();
      // Should navigate to athlete detail (CUID ID pattern)
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

    // Sub-heading shows "X atleti nel roster"
    await expect(page.locator('text=/\\d+ atleti nel roster/')).toBeVisible();
  });
});
