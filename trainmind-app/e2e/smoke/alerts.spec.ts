import { test, expect } from '../fixtures/auth';

test.describe('Alerts - Smoke Tests', () => {
  test('alerts page loads', async ({ page }) => {
    await page.goto('/dashboard/alerts');
    await expect(page).toHaveURL('/dashboard/alerts');
    await expect(page.locator('main').first()).toBeVisible();
  });
});
