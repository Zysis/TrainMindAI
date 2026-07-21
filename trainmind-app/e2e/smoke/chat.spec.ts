import { test, expect } from '../fixtures/auth';

test.describe('AI Chat - Smoke Tests', () => {
  test('chat page loads', async ({ page }) => {
    await page.goto('/dashboard/chat');
    await expect(page).toHaveURL('/dashboard/chat');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('chat has input field for messages', async ({ page }) => {
    await page.goto('/dashboard/chat');
    await page.waitForTimeout(1000);
    const input = page.locator('input, textarea').filter({ hasText: '' }).first();
    await expect(input).toBeVisible();
  });

  test('chat has send button', async ({ page }) => {
    await page.goto('/dashboard/chat');
    await page.waitForTimeout(1000);
    const sendBtn = page.locator('button[type="submit"], button[aria-label*="send" i]').first();
    await expect(sendBtn).toBeVisible();
  });
});
