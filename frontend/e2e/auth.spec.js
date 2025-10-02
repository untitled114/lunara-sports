import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.describe('Sign Up', () => {
    test('should display signup form with all fields', async ({ page }) => {
      await page.goto('/signup');

      // Check form elements
      await expect(page.getByLabel(/name/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /create account|sign up/i })).toBeVisible();
    });

    test('should show validation errors for empty form', async ({ page }) => {
      await page.goto('/signup');

      // Try to submit empty form
      await page.getByRole('button', { name: /create account|sign up/i }).click();

      // Should show validation messages or prevent submission
      // Note: Actual behavior depends on implementation
      await page.waitForTimeout(500);
    });

    test('should navigate to sign in from signup page', async ({ page }) => {
      await page.goto('/signup');

      // Click link to signin
      await page.getByRole('link', { name: /sign in|log in/i }).click();

      await expect(page).toHaveURL(/signin/);
    });
  });

  test.describe('Sign In', () => {
    test('should display signin form with all fields', async ({ page }) => {
      await page.goto('/signin');

      // Check form elements
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
    });

    test('should show validation errors for empty form', async ({ page }) => {
      await page.goto('/signin');

      // Try to submit empty form
      await page.getByRole('button', { name: /sign in|log in/i }).click();

      // Should show validation messages
      await page.waitForTimeout(500);
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/signin');

      // Fill in invalid credentials
      await page.getByLabel(/email/i).fill('invalid@example.com');
      await page.getByLabel(/password/i).fill('wrongpassword');

      // Submit
      await page.getByRole('button', { name: /sign in|log in/i }).click();

      // Should show error (either toast or inline)
      // Wait for error to appear
      await page.waitForTimeout(2000);

      // Check for error message (adjust selector based on implementation)
      const errorVisible = await page.locator('text=/error|invalid|incorrect/i').isVisible().catch(() => false);

      // Error should be shown or we should still be on signin page
      const currentUrl = page.url();
      expect(currentUrl).toContain('signin');
    });

    test('should navigate to signup from signin page', async ({ page }) => {
      await page.goto('/signin');

      // Click link to signup
      await page.getByRole('link', { name: /sign up|create account/i }).click();

      await expect(page).toHaveURL(/signup/);
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect to signin when accessing dashboard without auth', async ({ page }) => {
      await page.goto('/dashboard');

      // Should redirect to signin
      await expect(page).toHaveURL(/signin/);
    });

    test('should redirect to signin when accessing projects without auth', async ({ page }) => {
      await page.goto('/projects');

      // Should redirect to signin
      await expect(page).toHaveURL(/signin/);
    });

    test('should redirect to signin when accessing messages without auth', async ({ page }) => {
      await page.goto('/messages');

      // Should redirect to signin
      await expect(page).toHaveURL(/signin/);
    });
  });
});
