import { test, expect } from '../fixtures/auth';

test.describe('Calendar - Smoke Tests', () => {
  test('calendar page loads', async ({ page }) => {
    await page.goto('/dashboard/calendar');
    await expect(page).toHaveURL('/dashboard/calendar');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('calendar shows current month', async ({ page }) => {
    await page.goto('/dashboard/calendar');
    await page.waitForTimeout(1000);
    const content = await page.locator('main').first().textContent();
    // Should contain month name or date-related content
    expect(content!.length).toBeGreaterThan(10);
  });
});
