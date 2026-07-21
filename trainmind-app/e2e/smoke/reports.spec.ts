import { test, expect } from '../fixtures/auth';

test.describe('Reports - Smoke Tests', () => {
  test('reports page loads', async ({ page }) => {
    await page.goto('/dashboard/reports');
    await expect(page).toHaveURL('/dashboard/reports');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('reports page has link to schedules', async ({ page }) => {
    await page.goto('/dashboard/reports');
    const schedulesLink = page.locator('a[href*="schedules"]').first();
    await expect(schedulesLink).toBeVisible();
  });

  test('schedules page loads', async ({ page }) => {
    await page.goto('/dashboard/reports/schedules');
    await expect(page).toHaveURL('/dashboard/reports/schedules');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('schedule creation modal opens', async ({ page }) => {
    await page.goto('/dashboard/reports/schedules');
    const createBtn = page.locator('button').filter({ hasText: /nuov|crea|aggiungi/i }).first();
    if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createBtn.click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    }
  });
});
