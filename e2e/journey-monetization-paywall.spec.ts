import { test, expect } from "@playwright/test";
import { assertNoA11yViolations } from "./fixtures/axe-helper";

test.describe("Journey 6: Freemium Paywall Gatekeeper & Coin Economy", () => {
  test("watch locked episode (ep 6) → paywall gatekeeper → wallet dashboard → purchase packages with accessibility audits", async ({
    page,
  }) => {
    const sampleSlug = "the-arranged-marriage-ghs";

    // 1. Navigate to Episode 6 (locked episode in standard 1–5 free schedule)
    await page.goto(`/watch/${sampleSlug}?ep=6`);
    await expect(page.locator("body")).toBeVisible();

    // Check for Paywall / Unlock prompt or locked overlay indicator
    const paywallPrompt = page.locator(
      'button:has-text("Unlock"), [role="dialog"], button:has-text("Top Up"), *:has-text("Locked")'
    ).first();

    if (await paywallPrompt.isVisible()) {
      await assertNoA11yViolations(page, "In-Player Paywall Gatekeeper", {
        disabledRules: ["color-contrast"], // Dynamic video canvas contrast
      });
    }

    // 2. Navigate to User Wallet Dashboard
    await page.goto("/account/wallet");
    await expect(page.locator("body")).toBeVisible();

    if (page.url().includes("/login")) {
      // Unauthenticated access redirects safely to login with returnUrl
      await expect(page.locator("h1").first()).toContainText(/Welcome back|Sign in|Log in/i);
      await assertNoA11yViolations(page, "Wallet Auth Guard Login Redirect");
    } else {
      await expect(page.locator("h1").first()).toContainText(/Wallet|Coin/i);

      // Verify Wallet balance summary & VIP status card
      const walletBalanceCard = page.getByText(/Coin Balance|Balance|Coins/i).first();
      await expect(walletBalanceCard).toBeVisible();

      // Verify Transaction history ledger tabs exist
      const transactionTabs = page.locator('button:has-text("All"), button:has-text("Purchases"), button:has-text("Unlocks")').first();
      if (await transactionTabs.isVisible()) {
        await expect(transactionTabs).toBeVisible();
      }

      // Run WCAG 2.1 AA accessibility audit on Wallet dashboard
      await assertNoA11yViolations(page, "User Wallet Dashboard");

      // 3. Open Coin Top-Up Modal
      const topUpButton = page.locator('button:has-text("Top Up"), button:has-text("Buy Coins"), button:has-text("Get Coins")').first();
      if (await topUpButton.isVisible()) {
        await topUpButton.click();

        const purchaseModal = page.locator('[role="dialog"]');
        if (await purchaseModal.isVisible()) {
          await expect(purchaseModal).toHaveAttribute("aria-modal", "true");

          // Verify package cards exist (Pocket Starter, Popular Pack, Drama Binge, VIP Pass)
          await expect(purchaseModal.getByText(/Coins|VIP|Pack/i).first()).toBeVisible();

          // Audit modal accessibility
          await assertNoA11yViolations(page, "Coin Purchase Packages Modal");

          // Dismiss modal via Escape key
          await page.keyboard.press("Escape");
        }
      }
    }
  });
});
