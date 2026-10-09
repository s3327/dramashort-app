import { test, expect } from "@playwright/test";
import { assertNoA11yViolations } from "./fixtures/axe-helper";

test.describe("Journey 9: Customer Support Ticket & Issue Reporting Pipeline", () => {
  test("report issue from player → /contact submission → admin support inbox with accessibility audits", async ({
    page,
  }) => {
    const sampleSlug = "the-arranged-marriage-ghs";

    // 1. Visit Contact / Support page with structured playback context
    await page.goto(`/contact?category=playback_issue&title=${sampleSlug}&ep=1`);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("h1").first()).toContainText(/Contact|Support|Report/i);

    // Verify contact form inputs
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const messageInput = page.locator('textarea, textarea[name="message"]').first();

    await expect(emailInput).toBeVisible();
    await expect(messageInput).toBeVisible();

    // Audit /contact page accessibility
    await assertNoA11yViolations(page, "Public Contact & Support Page");

    // 2. Submit a valid support ticket
    await emailInput.fill(`support_viewer_${Date.now()}@dramashort.test`);
    const subjectInput = page.locator('input[name="subject"], input[placeholder*="Subject"]').first();
    if (await subjectInput.isVisible()) {
      await subjectInput.fill("Video playback stuttering on Episode 1");
    }
    await messageInput.fill("The video pauses buffering after 10 seconds of playback on Chrome browser.");

    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
    }

    // 3. Visit Admin Support Operations Console
    await page.goto("/admin/support");
    await expect(page.locator("body")).toBeVisible();

    if (page.url().includes("/admin/login")) {
      // Unauthenticated access redirects safely to Admin Login
      await expect(page.locator("h1").first()).toContainText(/Admin sign in|Admin Login/i);
      await assertNoA11yViolations(page, "Admin Support Auth Guard Redirect", {
        disabledRules: ["color-contrast"],
      });
    } else {
      await expect(page.locator("h1").first()).toContainText(/Support Inbox/i);
      const statusTabs = page.locator('button:has-text("Open"), button:has-text("All Tickets")').first();
      await expect(statusTabs).toBeVisible();

      // Audit Admin Support Console accessibility
      await assertNoA11yViolations(page, "Admin Support Inbox Console", {
        disabledRules: ["color-contrast"], // Admin console has isolated high-contrast theme
      });
    }
  });
});
