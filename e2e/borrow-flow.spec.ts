import { test, expect, type Page } from '@playwright/test';

/**
 * E2E tests for the borrow book flow.
 *
 * Prerequisites to run the full suite:
 *   1. npm run dev  (starts auth:3001, books:3002, admin:3003, frontend:5173)
 *   2. node scripts/seed.mjs  (populates DynamoDB dev table)
 *   3. E2E_MEMBER_JWT=$(node scripts/generate-e2e-token.mjs)  (pre-signed JWT)
 *
 * The non-skipped tests only need the frontend running and a valid JWT.
 * The skipped tests need a fully seeded backend + real borrow flow.
 */

async function injectAuth(page: Page) {
  const jwt = process.env.E2E_MEMBER_JWT;
  if (!jwt) {
    throw new Error(
      'E2E_MEMBER_JWT is not set. Run: E2E_MEMBER_JWT=$(node scripts/generate-e2e-token.mjs) npx playwright test',
    );
  }
  // Navigate first so localStorage is scoped to the right origin
  await page.goto('/');
  await page.evaluate((token) => {
    localStorage.setItem('auth_token', token);
  }, jwt);
}

test.describe('Borrow Book flow', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
  });

  test('authenticated user sees the home page with at least one book card', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Library/i);
    // Book cards are rendered as <Link> elements wrapping each card
    const cards = page.locator('a[href^="/books/"]');
    await expect(cards.first()).toBeVisible({ timeout: 8000 });
  });

  test('clicking a book card navigates to the book detail page', async ({ page }) => {
    await page.goto('/');
    const firstCard = page.locator('a[href^="/books/"]').first();
    await firstCard.waitFor({ state: 'visible', timeout: 8000 });
    await firstCard.click();
    await expect(page).toHaveURL(/\/books\//);
  });

  test('unauthenticated user visiting /my-loans is redirected to login', async ({ page, context }) => {
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto('/my-loans');
    await expect(page).toHaveURL(/\/login/);
  });

  test.skip('member can add a book to cart and borrow it', async ({ page }) => {
    // Requires: seeded book with availableCopies > 0, backend running
    await page.goto('/');
    await page.locator('button', { hasText: '+ Cart' }).first().click();
    await page.goto('/cart');
    await page.locator('button', { hasText: 'Borrow' }).click();
    await expect(page.locator('text=Loan confirmed')).toBeVisible({ timeout: 10000 });
  });

  test.skip('borrowed book appears in My Loans with active status', async ({ page }) => {
    // Requires: an active loan already seeded for this user
    await page.goto('/my-loans');
    await expect(page.locator('text=Active')).toBeVisible();
    await expect(page.locator('[data-testid="loan-item"]').first()).toBeVisible();
  });
});

test.describe('My Loans page', () => {
  test('authenticated user can reach My Loans page', async ({ page }) => {
    await injectAuth(page);
    await page.goto('/my-loans');
    // Page renders with either a loan list or the empty state — both are valid
    const loanList = page.locator('[data-testid="loan-item"]');
    const emptyMsg = page.getByText(/No active loans/i);
    const heading = page.getByRole('heading', { name: /My Loans/i });
    await expect(heading.or(loanList.first()).or(emptyMsg)).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Admin-only routes', () => {
  test('member cannot reach the admin dashboard (redirected or 403)', async ({ page }) => {
    await injectAuth(page); // member JWT
    await page.goto('/admin');
    // Should either redirect away from /admin or show an access-denied message
    const url = page.url();
    const denied = page.getByText(/access denied|forbidden|not authorized/i);
    const isRedirected = !url.includes('/admin');
    const hasDeniedMsg = await denied.isVisible().catch(() => false);
    expect(isRedirected || hasDeniedMsg).toBe(true);
  });
});
