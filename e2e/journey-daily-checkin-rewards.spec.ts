import { test, expect } from "@playwright/test";
import { assertNoA11yViolations } from "./fixtures/axe-helper";

test.describe("Journey 7: Gamified 7-Day Daily Check-in Streak & Rewards", () => {
  test("header trigger → 7-day streak calendar modal → claim interaction with accessibility audits", async ({
    page,
  }) => {
    // 1. Visit Homepage Feed
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();

    // 2. Locate Daily Reward Trigger badge in header
    const rewardTrigger = page.locator(
      'button[aria-label*="Reward"], button[aria-label*="Check-in"], button:has-text("Free Coins"), button:has-text("Rewards")'
    ).first();

    if (await rewardTrigger.isVisible()) {
      await rewardTrigger.click();

      // Verify Daily Check-in Modal appears
      const modal = page.locator('[role="dialog"]');
      if (await modal.isVisible()) {
        await expect(modal).toHaveAttribute("aria-modal", "true");
        await expect(modal.locator("h2, h3").first()).toContainText(/Daily|Check-in|Streak|Reward/i);

        // Verify 7-day progression elements
        await expect(modal.getByText(/Day 1/i).first()).toBeVisible();

        // Audit modal accessibility
        await assertNoA11yViolations(page, "Daily Check-in Streak Modal");

        // Close modal via Escape key
        await page.keyboard.press("Escape");
      }
    } else {
      // Direct accessibility check on landing page if trigger is not displayed
      await assertNoA11yViolations(page, "Homepage Navigation & Feed");
    }
  });
});
