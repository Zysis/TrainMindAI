import { test, expect } from '../fixtures/auth';

test.describe('Adaptations - Smoke Tests', () => {
  test('adaptations page loads', async ({ page }) => {
    await page.goto('/dashboard/adaptations');
    await expect(page).toHaveURL('/dashboard/adaptations');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('adaptations page shows content or empty state', async ({ page }) => {
    await page.goto('/dashboard/adaptations');
    await page.waitForTimeout(1500);
    const mainContent = page.locator('main').first();
    const text = await mainContent.textContent();
    expect(text!.length).toBeGreaterThan(0);
  });
});
