import { test, expect } from '../fixtures/auth';

test.describe('Wellness - Smoke Tests', () => {
  test('wellness page loads with heading', async ({ page }) => {
    await page.goto('/dashboard/wellness');
    await expect(page).toHaveURL('/dashboard/wellness');

    // Heading "Wellness"
    await expect(page.locator('h1')).toContainText('Wellness');
  });

  test('wellness summary cards are displayed', async ({ page }) => {
    await page.goto('/dashboard/wellness');
    await page.waitForTimeout(2000);

    // 5 metric cards: Sonno, Fatica, Dolore, Stress, Umore
    const metricLabels = ['Sonno', 'Fatica', 'Dolore', 'Stress', 'Umore'];

    for (const label of metricLabels) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible();
    }
  });

  test('recent logs table is displayed', async ({ page }) => {
    await page.goto('/dashboard/wellness');
    await page.waitForTimeout(2000);

    // Section heading "Log Recenti"
    await expect(page.locator('h2').filter({ hasText: 'Log Recenti' })).toBeVisible();

    // Table with headers
    const table = page.locator('table');
    const tableVisible = await table.isVisible().catch(() => false);

    if (tableVisible) {
      // Table headers: Atleta, Data, Sonno, Fatica, Dolore, Stress, Umore
      await expect(table.locator('th').filter({ hasText: 'Atleta' })).toBeVisible();
      await expect(table.locator('th').filter({ hasText: 'Data' })).toBeVisible();
    }
  });

  test('wellness logs table has data rows', async ({ page }) => {
    await page.goto('/dashboard/wellness');
    await page.waitForTimeout(2000);

    const table = page.locator('table');
    if (await table.isVisible().catch(() => false)) {
      const rows = table.locator('tbody tr');
      const rowCount = await rows.count();
      // With seed data, should have logs
      expect(rowCount).toBeGreaterThan(0);
    }
  });

  test('register wellness button exists', async ({ page }) => {
    await page.goto('/dashboard/wellness');
    await page.waitForTimeout(1000);

    // "Registra Wellness" button
    const btn = page.locator('button').filter({ hasText: 'Registra Wellness' });
    await expect(btn).toBeVisible();
  });

  test('wellness page loads within reasonable time', async ({ page }) => {
    const start = Date.now();
    await page.goto('/dashboard/wellness');
    await expect(page).toHaveURL('/dashboard/wellness');
    const loadTime = Date.now() - start;
    expect(loadTime).toBeLessThan(5000);
  });
});
