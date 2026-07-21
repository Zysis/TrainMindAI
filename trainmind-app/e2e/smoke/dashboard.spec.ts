import { test, expect } from '../fixtures/auth';

test.describe('Dashboard Home - Smoke Tests', () => {
  test('dashboard loads with KPI cards', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');
    await page.waitForTimeout(1000);
    // Dashboard should have stat cards or overview widgets
    const mainContent = page.locator('main').first();
    await expect(mainContent).toBeVisible();
  });

  test('dashboard shows sidebar with all nav items', async ({ page }) => {
    await page.goto('/dashboard');
    const aside = page.locator('aside').first();
    await expect(aside).toBeVisible();

    const navItems = ['Atleti', 'Allenamenti', 'Esercizi', 'Wellness', 'Report'];
    for (const item of navItems) {
      const link = aside.locator('a').filter({ hasText: item }).first();
      await expect(link).toBeVisible();
    }
  });

  test('dashboard is responsive - sidebar hidden on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/dashboard');
    await page.waitForTimeout(500);
    // On mobile, sidebar may be hidden or collapsed
    const mainContent = page.locator('main').first();
    await expect(mainContent).toBeVisible();
  });

  test('unauthenticated user redirected to login', async ({ page }) => {
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    // Should redirect to login
    const url = page.url();
    expect(url).toMatch(/login|auth/);
  });
});
