import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('should load and display hero section', async ({ page }) => {
    await page.goto('/');

    // Check for hero title
    await expect(page.locator('h1')).toContainText('Lunara');

    // Check for navigation
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
  });

  test('should navigate to sign in page', async ({ page }) => {
    await page.goto('/');

    // Click Sign In
    await page.getByRole('link', { name: /sign in/i }).first().click();

    // Should be on signin page
    await expect(page).toHaveURL(/signin/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
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

    // Scroll to features
    await page.locator('text=Features').scrollIntoViewIfNeeded();

    // Check for feature cards
    const featureCards = page.locator('[class*="feature"]').or(page.locator('h3'));
    await expect(featureCards.first()).toBeVisible();
  });

  test('should display pricing section', async ({ page }) => {
    await page.goto('/');

    // Scroll to pricing
    await page.locator('text=Pricing').scrollIntoViewIfNeeded();

    // Check for pricing cards
    await expect(page.locator('text=Free').or(page.locator('text=Starter'))).toBeVisible();
  });
});
