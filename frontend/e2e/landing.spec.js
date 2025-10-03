import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('should load and display hero section', async ({ page }) => {
    await page.goto('/');

    // Check for hero title
    await expect(page.locator('h1')).toContainText('Your Projects');

    // Check for Lunara branding (use first() to handle multiple matches)
    await expect(page.locator('text=Lunara').first()).toBeVisible();

    // Check for navigation
    await expect(page.getByRole('link', { name: /sign in/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /sign up/i }).first()).toBeVisible();
  });

  test('should navigate to sign in page', async ({ page }) => {
    await page.goto('/');

    // Click Sign In
    await page.getByRole('link', { name: /sign in/i }).first().click();

    // Should be on signin page
    await expect(page).toHaveURL(/signin/);
    // Check for sign in form elements instead of specific heading text
    await expect(page.getByLabel('Email Address')).toBeVisible();
  });

  test('should navigate to sign up page', async ({ page }) => {
    await page.goto('/');

    // Click Sign Up
    await page.getByRole('link', { name: /sign up/i }).first().click();

    // Should be on signup page
    await expect(page).toHaveURL(/signup/);
    await expect(page.getByRole('heading', { name: /create.*account/i })).toBeVisible();
  });

  test('should display features section', async ({ page }) => {
    await page.goto('/');

    // Check for features section - it should auto-load on the page
    // Look for feature-related headings
    const featureHeadings = page.locator('h2, h3');
    await expect(featureHeadings.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display pricing section', async ({ page }) => {
    await page.goto('/');

    // Scroll to pricing section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Check for pricing-related content
    const pricingContent = page.locator('text=/free|starter|professional|enterprise/i');
    await expect(pricingContent.first()).toBeVisible({ timeout: 10000 });
  });
});
