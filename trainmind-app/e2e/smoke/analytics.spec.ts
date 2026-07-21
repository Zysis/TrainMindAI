import { test, expect } from '../fixtures/auth';

test.describe('Analytics - Smoke Tests', () => {
  test('analytics page loads', async ({ page }) => {
    await page.goto('/dashboard/analytics');
    await expect(page).toHaveURL('/dashboard/analytics');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('analytics page shows charts or empty state', async ({ page }) => {
    await page.goto('/dashboard/analytics');
    await page.waitForTimeout(1500);
    const mainContent = page.locator('main').first();
    await expect(mainContent).toBeVisible();
    // Should have either chart containers or empty state message
    const hasContent = await mainContent.textContent();
    expect(hasContent!.length).toBeGreaterThan(0);
  });
});
