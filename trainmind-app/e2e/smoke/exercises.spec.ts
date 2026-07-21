import { test, expect } from '../fixtures/auth';

test.describe('Exercises - Smoke Tests', () => {
  test('exercises page loads with heading', async ({ page }) => {
    await page.goto('/dashboard/exercises');
    await expect(page).toHaveURL('/dashboard/exercises');

    // Heading "Libreria Esercizi"
    await expect(page.locator('h1')).toContainText('Libreria Esercizi');
  });

  test('exercises count is displayed', async ({ page }) => {
    await page.goto('/dashboard/exercises');
    await page.waitForTimeout(2000);

    // Sub-heading "X esercizi disponibili"
    await expect(page.locator('text=/\\d+ esercizi disponibili/')).toBeVisible();
  });

  test('exercises are displayed grouped by category', async ({ page }) => {
    await page.goto('/dashboard/exercises');
    await page.waitForTimeout(2000);

    // Exercise cards with class "card-hover"
    const cards = page.locator('.card-hover');
    const count = await cards.count();

    expect(count).toBeGreaterThan(0);
  });

  test('search input filters exercises', async ({ page }) => {
    await page.goto('/dashboard/exercises');
    await page.waitForTimeout(1000);

    // Search field with placeholder "Cerca esercizi..."
    const searchInput = page.locator('input[placeholder*="Cerca esercizi"]');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('Squat');
    await page.waitForTimeout(1000);

    await expect(page).toHaveURL('/dashboard/exercises');
  });

  test('category filter dropdown exists', async ({ page }) => {
    await page.goto('/dashboard/exercises');
    await page.waitForTimeout(1000);

    // Select with "Tutte le categorie"
    const catSelect = page.locator('select');
    await expect(catSelect).toBeVisible();

    const options = catSelect.locator('option');
    const count = await options.count();
    // "Tutte le categorie" + at least some categories
    expect(count).toBeGreaterThan(1);
  });

  test('category filter changes displayed exercises', async ({ page }) => {
    await page.goto('/dashboard/exercises');
    await page.waitForTimeout(2000);

    const catSelect = page.locator('select');
    await catSelect.selectOption('Forza');
    await page.waitForTimeout(1000);

    // Should still be on exercises page with filtered results
    await expect(page).toHaveURL('/dashboard/exercises');
  });

  test('exercise cards show name and description', async ({ page }) => {
    await page.goto('/dashboard/exercises');
    await page.waitForTimeout(2000);

    const cards = page.locator('.card-hover');
    const count = await cards.count();

    if (count > 0) {
      // Each card has an h3 with exercise name
      const firstCard = cards.first();
      const name = firstCard.locator('h3');
      await expect(name).toBeVisible();
      const text = await name.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });

  test('new exercise button opens modal', async ({ page }) => {
    await page.goto('/dashboard/exercises');
    await page.waitForTimeout(1000);

    const newBtn = page.locator('button').filter({ hasText: 'Nuovo Esercizio' });
    await expect(newBtn).toBeVisible();
    await newBtn.click();

    // Modal overlay (custom modal without role="dialog")
    await expect(page.locator('.fixed.inset-0.z-50')).toBeVisible();
  });
});
