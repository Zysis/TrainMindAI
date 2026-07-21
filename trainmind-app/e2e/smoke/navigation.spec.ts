import { test, expect } from '../fixtures/auth';

test.describe('Navigation - Smoke Tests', () => {
  test('login page loads correctly', async ({ page }) => {
    // Clear session to test unauthenticated state
    await page.evaluate(() => sessionStorage.clear());
    await page.goto('/login');

    // The login page has a form with email + password + submit
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Heading says "Accedi"
    await expect(page.locator('h2')).toContainText('Accedi');
  });

  test('dashboard loads after auth', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');

    // Sidebar should be visible (aside element)
    await expect(page.locator('aside').first()).toBeVisible();

    // Main content area
    const mainContent = page.locator('main').first();
    await expect(mainContent).toBeVisible();
  });

  // Sidebar nav items from sidebar.tsx:
  // Dashboard, Atleti, Allenamenti, Esercizi, Calendario, Wellness, Chat AI, Report
  // Bottom: Impostazioni

  const sidebarPages = [
    { label: 'Atleti', url: '/dashboard/athletes' },
    { label: 'Allenamenti', url: '/dashboard/training' },
    { label: 'Esercizi', url: '/dashboard/exercises' },
    { label: 'Calendario', url: '/dashboard/calendar' },
    { label: 'Wellness', url: '/dashboard/wellness' },
    { label: 'Chat AI', url: '/dashboard/chat' },
    { label: 'Report', url: '/dashboard/reports' },
    { label: 'Impostazioni', url: '/dashboard/settings' },
  ];

  for (const { label, url } of sidebarPages) {
    test(`navigate to ${label} page from sidebar`, async ({ page }) => {
      await page.goto('/dashboard');

      // Find sidebar link by exact text
      const link = page.locator('aside a').filter({ hasText: label }).first();
      await link.click();

      await expect(page).toHaveURL(url);
      await expect(page.locator('main').first()).toBeVisible();
    });
  }

  test('each dashboard page loads with content', async ({ page }) => {
    const pages = [
      '/dashboard',
      '/dashboard/athletes',
      '/dashboard/exercises',
      '/dashboard/training',
      '/dashboard/wellness',
      '/dashboard/calendar',
      '/dashboard/chat',
      '/dashboard/reports',
      '/dashboard/settings',
    ];

    for (const pagePath of pages) {
      await page.goto(pagePath);
      await expect(page).toHaveURL(pagePath);
      await expect(page.locator('main').first()).toBeVisible({ timeout: 5000 });
    }
  });
});
