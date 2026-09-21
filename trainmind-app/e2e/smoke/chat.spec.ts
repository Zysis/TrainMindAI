import { test, expect } from '../fixtures/auth';

test.describe('AI Chat - Smoke Tests', () => {
  test('chat page loads', async ({ page }) => {
    await page.goto('/dashboard/chat');
    await expect(page).toHaveURL('/dashboard/chat');
    // Si aspetta il contenuto della chat, non il `main` del layout: quello e'
    // gia' verificato da navigation.spec, e alla prima compilazione della rotta
    // in `pnpm dev` puo' arrivare tardi.
    await expect(page.getByRole('textbox').first()).toBeVisible();
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
    // Il pulsante e' di sola icona e ora ha un nome accessibile
    // ("Invia messaggio (Enter)"): lo si cerca per ruolo e nome, non per
    // `type="submit"` — non sta dentro un form.
    const sendBtn = page.getByRole('button', { name: /invia/i }).first();
    await expect(sendBtn).toBeVisible();
  });
});
