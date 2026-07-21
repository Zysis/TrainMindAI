import { test, expect } from '../fixtures/auth';

test.describe('Injuries & RTP - Smoke Tests', () => {
  test('injuries page loads with correct title', async ({ page }) => {
    await page.goto('/dashboard/injuries');
    await expect(page).toHaveURL('/dashboard/injuries');
    await expect(page.locator('h1')).toContainText('Infortuni');
  });

  test('new injury button visible', async ({ page }) => {
    await page.goto('/dashboard/injuries');
    await expect(page.locator('button').filter({ hasText: 'Nuovo infortunio' })).toBeVisible();
  });

  test('create injury modal opens and has form fields', async ({ page }) => {
    await page.goto('/dashboard/injuries');
    await page.locator('button').filter({ hasText: 'Nuovo infortunio' }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    // Should have athlete selector, type, location fields
    await expect(page.locator('select').first()).toBeVisible();
  });

  test('RTP protocol card shows progress bar and phase', async ({ page }) => {
    await page.goto('/dashboard/injuries');
    await page.waitForTimeout(1000);
    const protocolCard = page.locator('.card-hover, [class*="cursor-pointer"]').first();
    if (await protocolCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Progress bar gradient exists
      const progressBar = protocolCard.locator('[class*="gradient"]').first();
      await expect(progressBar).toBeVisible();
      // Phase badge exists
      const phaseBadge = protocolCard.locator('[class*="rounded-full"]').first();
      await expect(phaseBadge).toBeVisible();
    }
  });

  test('RTP detail shows AI Suggest button', async ({ page }) => {
    await page.goto('/dashboard/injuries');
    await page.waitForTimeout(1000);
    const protocolCard = page.locator('.card-hover, [class*="cursor-pointer"]').first();
    if (await protocolCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await protocolCard.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('button').filter({ hasText: 'AI Suggest' })).toBeVisible();
    }
  });

  test('RTP detail shows clearance criteria checkboxes', async ({ page }) => {
    await page.goto('/dashboard/injuries');
    await page.waitForTimeout(1000);
    const protocolCard = page.locator('.card-hover, [class*="cursor-pointer"]').first();
    if (await protocolCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await protocolCard.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('text=Criteri di clearance')).toBeVisible();
    }
  });
});
