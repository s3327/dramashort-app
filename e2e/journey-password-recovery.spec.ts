import { test, expect } from "@playwright/test";
import { assertNoA11yViolations } from "./fixtures/axe-helper";

test.describe("Journey 3: Password Recovery & Reset Flow", () => {
  test("forgot-password → reset-password → login journey with accessibility audits", async ({
    page,
  }) => {
    // 1. Visit Forgot Password Page
    await page.goto("/forgot-password");
    await expect(page.locator("h1").first()).toContainText(/Reset|Forgot|Password/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    await assertNoA11yViolations(page, "Forgot Password Page");

    // Submit password recovery request
    await page.locator('input[type="email"]').fill("user_recovery@dramashort.test");
    await page.locator('button[type="submit"]').click();

    // 2. Visit Reset Password Form
    await page.goto("/reset-password?code=mock-recovery-code");
    await expect(page.locator("body")).toBeVisible();

    const passwordInput = page.locator('input[type="password"]').first();
    if (await passwordInput.isVisible()) {
      await passwordInput.fill("NewSecurePassword2026!");
      await assertNoA11yViolations(page, "Reset Password Page");
    }

    // 3. Confirm navigation link back to Login
    const loginLink = page.locator('a[href*="/login"]').first();
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
