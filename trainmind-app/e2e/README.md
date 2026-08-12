# Playwright E2E Tests for TrainMind

This directory contains end-to-end tests for the TrainMind application using Playwright.

## Setup

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0

### Installation

The Playwright dependencies are already included in the root `package.json`. Install them with:

```bash
pnpm install
```

To install browser binaries:

```bash
pnpm exec playwright install
```

## Configuration

The Playwright configuration is defined in `playwright.config.ts` at the root level.

### Key Settings

- **baseURL**: `http://localhost:3000`
- **testDir**: `./e2e`
- **Workers**: 1 (sequential execution for auth state consistency)
- **Retries**: 1 on CI, 0 locally
- **Projects**: Chromium, Firefox, WebKit, and Mobile Safari
- **Screenshots**: Captured on failure
- **Videos**: Retained on test failure
- **Traces**: Recorded on first retry

## Running Tests

### Start Development Servers

Before running tests, ensure both the frontend and API are running:

```bash
pnpm dev
```

This starts:
- Frontend on `http://localhost:3000`
- API on `http://localhost:3001`

### Run All Tests

```bash
pnpm test:e2e
```

### Run Tests in UI Mode (Recommended for Development)

```bash
pnpm test:e2e:ui
```

This opens an interactive test runner where you can:
- Run tests individually
- Pause and step through test execution
- View traces and screenshots
- Debug failures

### Run Tests in Headed Mode

```bash
pnpm test:e2e:headed
```

This runs tests with visible browser windows, useful for observing test execution.

### Run Specific Test File

```bash
pnpm exec playwright test e2e/smoke/navigation.spec.ts
```

### Run Tests Matching a Pattern

```bash
pnpm exec playwright test --grep "athletes"
```

### Run Tests in a Specific Project (Browser)

```bash
pnpm exec playwright test --project chromium
```

## Test Structure

### Authentication Setup

Before running feature tests, the authentication flow is handled:

1. **`e2e/auth.setup.ts`** - Global setup that:
   - Navigates to `/login`
   - Logs in with demo credentials (`trainer@trainmind.demo` / `TrainMind2024!`)
   - Saves authentication state to `.auth/user.json`

2. **`e2e/fixtures/auth.ts`** - Custom fixture that:
   - Provides pre-authenticated test context
   - Automatically applies stored auth state to all tests
   - Eliminates need to log in for each test

### Test Files

#### Smoke Tests

Smoke tests verify that pages load and key features are accessible:

- **`e2e/smoke/navigation.spec.ts`** - Navigation between pages, sidebar behavior, mobile responsiveness
- **`e2e/smoke/athletes.spec.ts`** - Athletes list, filtering, detail page
- **`e2e/smoke/exercises.spec.ts`** - Exercise listing, filtering, detail modal/page
- **`e2e/smoke/wellness.spec.ts`** - Wellness logging, history, form validation

## Test Features

### Italian UI Support

Tests use both Italian and English text selectors to handle the bilingual interface:

```typescript
// Matches both "atleti" and "athletes"
page.locator('a, button').filter({ hasText: /atleti|athletes/i })
```

### Resilient Selectors

Tests use multiple selector strategies:
- `data-testid` attributes (when available)
- Text-based selectors for user-visible elements
- ARIA roles for accessibility
- CSS class selectors as fallback

### Mobile Testing

Tests include mobile viewport checks:

```typescript
const mobileContext = await context.browser()?.newContext({
  viewport: { width: 375, height: 667 }, // iPhone size
});
```

## Authentication

Demo credentials are configured:
- **Email**: `trainer@trainmind.demo`
- **Password**: `TrainMind2024!`

The auth state is saved to `.auth/user.json` (which is gitignored). This file is automatically used by subsequent tests.

## Debugging

### View Test Traces

After running tests, view detailed traces:

```bash
pnpm exec playwright show-trace .playwright/trace/trace.zip
```

### View HTML Reports

```bash
pnpm exec playwright show-report
```

### Debug Single Test

```bash
pnpm exec playwright test e2e/smoke/navigation.spec.ts --debug
```

## Best Practices

1. **Use the auth fixture** - Import from `../fixtures/auth` for authenticated tests
2. **Expect page navigation** - Always verify you're on the expected page with `expect(page).toHaveURL(...)`
3. **Wait for content** - Use `expect().toBeVisible()` or explicit waits for dynamic content
4. **Handle optional elements** - Use `.catch(() => false)` for elements that might not exist
5. **Test in all browsers** - Run tests against Chromium, Firefox, and WebKit
6. **Review failures** - Check screenshots and videos in the test report

## CI/CD Integration

For continuous integration, tests run with:
- 1 retry on failure
- Sequential execution (1 worker)
- Failure artifacts collected
- Full traces and videos recorded

Example GitHub Actions setup:

```yaml
- name: Run E2E Tests
  run: pnpm test:e2e

- name: Upload Report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Troubleshooting

### Tests Can't Connect to Servers

Ensure both servers are running:

```bash
pnpm dev
```

If servers are already running, clear ports:

```bash
lsof -ti:3000,3001 | xargs kill -9
pnpm dev
```

### Auth Setup Fails

1. Clear auth state: `rm -rf .auth/`
2. Verify credentials work manually by logging in
3. Check that login page loads: `curl http://localhost:3000/login`

### Tests Time Out

- Check network connectivity to `localhost:3000` and `localhost:3001`
- Increase timeouts in `playwright.config.ts` if servers are slow
- Verify database is seeded with test data

### Mobile Tests Fail

Some features might not be available on mobile. Check page layout and adjust assertions:

```typescript
if (isMobile) {
  // Use mobile-specific selectors
} else {
  // Use desktop-specific selectors
}
```

## Next Steps

Consider adding:
- API mocking for deterministic tests
- Data factory fixtures for creating test data
- Visual regression tests
- Performance benchmarks
- Load testing scenarios

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Test Fixtures](https://playwright.dev/docs/test-fixtures)
- [Best Practices](https://playwright.dev/docs/best-practices)
