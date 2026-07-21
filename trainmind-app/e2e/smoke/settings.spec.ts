import { test, expect } from '../fixtures/auth';

test.describe('Settings - Smoke Tests', () => {
  test('settings page loads', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page).toHaveURL('/dashboard/settings');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('settings page has profile or organization section', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForTimeout(1000);
    const content = await page.locator('main').first().textContent();
    // Should contain some settings-related text
    const hasSettingsContent = /profilo|organizzazione|impostazioni|email|password|notific/i.test(content || '');
    expect(hasSettingsContent).toBe(true);
  });
});
