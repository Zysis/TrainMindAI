import { Page, expect } from '@playwright/test';

/**
 * Common helper functions for E2E tests
 */

/**
 * Navigate to dashboard page and wait for it to fully load
 */
export async function navigateToDashboard(page: Page) {
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('main, [role="main"]')).toBeVisible();
}

/**
 * Navigate to a specific dashboard page
 */
export async function navigateToPage(page: Page, path: string) {
  const fullPath = `/dashboard${path}`;
  await page.goto(fullPath);
  await expect(page).toHaveURL(fullPath);
  await expect(page.locator('main, [role="main"]')).toBeVisible();
}

/**
 * Click on a sidebar navigation item by partial text match
 * Supports both Italian and English labels
 */
export async function clickSidebarItem(page: Page, label: string | RegExp) {
  const link = page.locator('a, button').filter({ hasText: label }).first();
  await expect(link).toBeVisible();
  await link.click();
}

/**
 * Wait for page to load and main content to be visible
 */
export async function waitForPageLoad(page: Page) {
  const mainContent = page.locator('main, [role="main"]');
  await expect(mainContent).toBeVisible({ timeout: 5000 });
}

/**
 * Search or filter using a search input
 */
export async function searchFor(page: Page, query: string) {
  const searchInput = page.locator(
    'input[placeholder*="search" i], input[aria-label*="search" i], [data-testid="search-input"]'
  ).first();

  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill(query);
    // Wait for debounce and results update
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

/**
 * Get text from element safely
 */
export async function getElementText(page: Page, selector: string): Promise<string | null> {
  try {
    return await page.locator(selector).first().textContent();
  } catch {
    return null;
  }
}

/**
 * Check if element is visible without throwing
 */
export async function isElementVisible(page: Page, selector: string): Promise<boolean> {
  try {
    return await page.locator(selector).isVisible();
  } catch {
    return false;
  }
}

/**
 * Fill form field by label
 */
export async function fillFormField(page: Page, labelText: string, value: string) {
  const label = page.locator(`label:has-text("${labelText}")`);
  const input = label.locator('~ input, ~ textarea, ~ select').first();

  if (await input.isVisible().catch(() => false)) {
    await input.fill(value);
    return true;
  }
  return false;
}

/**
 * Click button by text
 */
export async function clickButton(page: Page, buttonText: string | RegExp) {
  const button = page.locator('button').filter({ hasText: buttonText }).first();
  await expect(button).toBeVisible();
  await button.click();
}

/**
 * Fill login form
 */
export async function fillLoginForm(page: Page, email: string, password: string) {
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');

  await emailInput.fill(email);
  await passwordInput.fill(password);
}

/**
 * Submit form by submit button
 */
export async function submitForm(page: Page) {
  const submitButton = page.locator('button[type="submit"]');
  await expect(submitButton).toBeVisible();
  await submitButton.click();
}

/**
 * Check for modal/dialog visibility
 */
export async function isModalOpen(page: Page): Promise<boolean> {
  try {
    return await page.locator('[role="dialog"]').isVisible();
  } catch {
    return false;
  }
}

/**
 * Close modal/dialog if open
 */
export async function closeModal(page: Page) {
  const closeButton = page.locator(
    'button[aria-label*="close" i], button[aria-label*="dismiss" i]'
  ).first();

  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
    // Wait for modal to close
    await page.waitForTimeout(300);
  }
}

/**
 * Get all text items from a list
 */
export async function getListItems(page: Page, selector: string = 'li, tr'): Promise<string[]> {
  const items = await page.locator(selector).allTextContents();
  return items.map((text) => text.trim()).filter((text) => text.length > 0);
}

/**
 * Scroll to element into view
 */
export async function scrollToElement(page: Page, selector: string) {
  const element = page.locator(selector).first();
  if (await element.isVisible().catch(() => false)) {
    await element.scrollIntoViewIfNeeded();
  }
}

/**
 * Take screenshot for debugging
 */
export async function takeDebugScreenshot(page: Page, filename: string) {
  await page.screenshot({
    path: `./test-results/${filename}`,
    fullPage: true,
  });
}

/**
 * Check if page is in mobile viewport
 */
export async function isMobileViewport(page: Page): Promise<boolean> {
  const viewportSize = page.viewportSize();
  return viewportSize ? viewportSize.width < 768 : false;
}

/**
 * Wait for element to appear with custom timeout
 */
export async function waitForElement(page: Page, selector: string, timeout = 5000) {
  const element = page.locator(selector);
  await expect(element).toBeVisible({ timeout });
  return element;
}

/**
 * Check table has data
 */
export async function tableHasData(page: Page, selector = 'table'): Promise<boolean> {
  const table = page.locator(selector).first();
  const rows = table.locator('tr, [role="row"]');
  const count = await rows.count().catch(() => 0);
  return count > 1; // More than header row
}

/**
 * Get table cell value
 */
export async function getTableCell(
  page: Page,
  rowIndex: number,
  cellIndex: number,
  tableSelector = 'table'
): Promise<string | null> {
  try {
    const table = page.locator(tableSelector).first();
    const row = table.locator('tr, [role="row"]').nth(rowIndex);
    const cell = row.locator('td, th, [role="cell"]').nth(cellIndex);
    return await cell.textContent();
  } catch {
    return null;
  }
}
