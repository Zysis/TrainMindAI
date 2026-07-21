import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const authDir = path.join(__dirname, '../.auth');
const authFile = path.join(authDir, 'user.json');

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const CREDENTIALS = {
  email: 'trainer@trainmind.demo',
  password: 'TrainMind2024!',
};

test('authenticate and save session', async ({ browser }) => {
  // Create .auth directory
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Login via API to get tokens
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CREDENTIALS),
  });

  if (!response.ok) {
    throw new Error(`Login API failed: ${response.status} ${response.statusText}`);
  }

  const loginData = await response.json();
  const tokens = loginData.data.tokens;

  // Save tokens to file for reuse in fixtures
  fs.writeFileSync(
    authFile,
    JSON.stringify({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    }),
  );

  // Verify tokens work: open browser, inject tokens, check dashboard loads
  const context = await browser.newContext();
  const page = await context.newPage();

  // Go to app and inject tokens into sessionStorage
  await page.goto('/login');
  await page.evaluate((tkns) => {
    sessionStorage.setItem('tm_access_token', tkns.accessToken);
    sessionStorage.setItem('tm_refresh_token', tkns.refreshToken);
  }, tokens);

  // Navigate to dashboard — should work with injected tokens
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/dashboard');

  await context.close();
  console.log('Auth tokens saved to', authFile);
});
