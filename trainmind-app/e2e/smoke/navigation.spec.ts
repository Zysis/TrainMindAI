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
    await expect(page.locator('h2').first()).toContainText('Accedi');
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

  // Solo le voci di PRIMO livello della barra laterale (components/layout/sidebar.tsx).
  //
  // La lista precedente era ferma a un'interfaccia che non esiste piu': "Atleti"
  // e' diventata "Squadre" (la scheda atleti e' un redirect dal 26/8/2026),
  // mentre "Esercizi", "Report" e "Chat AI" sono sotto-voci di gruppi
  // richiudibili — non sono nel DOM finche' il gruppo non viene aperto, e i test
  // aspettavano un link che non poteva comparire. "Impostazioni" non sta nella
  // barra laterale ma nel menu utente. Anche "Allenamenti" e' fuori: ha delle
  // sotto-voci, quindi e' un <button> che apre il gruppo, non un <a>.
  //
  // Quelle pagine restano coperte dal test "each dashboard page loads with
  // content", che ci arriva per URL.
  const sidebarPages = [
    { label: 'Calendario', url: '/dashboard/calendar' },
    { label: 'Squadre', url: '/dashboard/teams' },
    { label: 'Wellness', url: '/dashboard/wellness' },
    { label: 'Infortuni & RTP', url: '/dashboard/injuries' },
    { label: 'Alert', url: '/dashboard/alerts' },
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
