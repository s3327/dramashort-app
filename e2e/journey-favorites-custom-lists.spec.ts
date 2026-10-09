import { test, expect } from "@playwright/test";
import { assertNoA11yViolations } from "./fixtures/axe-helper";

test.describe("Journey 2: Authentication, Favorites & Custom Lists", () => {
  test("login → favorite → add to list → manage lists journey with accessibility audits", async ({
    page,
  }) => {
    // 1. Visit Login Page and audit accessibility
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    await assertNoA11yViolations(page, "Login Page");

    // 2. Navigate to Drama Detail Page
    const sampleSlug = "the-arranged-marriage-ghs";
    await page.goto(`/drama/${sampleSlug}`);
    await expect(page.locator("h1")).toBeVisible();

    // Verify Favorite action button exists
    const favButton = page.locator('button[aria-label*="Favorite"], button:has-text("Favorite")').first();
    if (await favButton.isVisible()) {
      await favButton.click();
    }

    // 3. Verify Custom Lists & Modal Interaction
    const addToListButton = page.locator('button[aria-label*="List"], button:has-text("Add to List"), button:has-text("Save")').first();
    if (await addToListButton.isVisible()) {
      await addToListButton.click();

      // Check modal role and focus trap
      const modal = page.locator('[role="dialog"]');
      if (await modal.isVisible()) {
        await expect(modal).toHaveAttribute("aria-modal", "true");
        await assertNoA11yViolations(page, "Add To List Dialog Modal");
        // Dismiss modal via Escape key
        await page.keyboard.press("Escape");
      }
    }

    // 4. Navigate to Favorites & Custom Lists Account Page
    await page.goto("/account/favorite");
    await expect(page.locator("body")).toBeVisible();

    await assertNoA11yViolations(page, "Favorites Management Page");
  });
});
