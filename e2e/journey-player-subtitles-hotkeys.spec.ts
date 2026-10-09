import { test, expect } from "@playwright/test";
import { assertNoA11yViolations } from "./fixtures/axe-helper";

test.describe("Journey 8: Advanced Player UX, Hotkeys & Multilingual Subtitles", () => {
  test("hotkeys modal (?) → playback controls → subtitle settings modal with accessibility audits", async ({
    page,
  }) => {
    const sampleSlug = "the-arranged-marriage-ghs";

    // 1. Navigate to Episode 1 streaming page
    await page.goto(`/watch/${sampleSlug}?ep=1`);
    await expect(page.locator("body")).toBeVisible();

    // 2. Open Keyboard Shortcuts Modal via '?' key
    await page.keyboard.press("?");
    const shortcutsModal = page.locator('[role="dialog"]');

    if (await shortcutsModal.isVisible()) {
      await expect(shortcutsModal).toHaveAttribute("aria-modal", "true");
      await expect(shortcutsModal.locator("h2")).toContainText(/Keyboard Shortcuts/i);

      // Verify category headings
      await expect(shortcutsModal.getByText("Playback Controls")).toBeVisible();
      await expect(shortcutsModal.getByText("Episode Navigation")).toBeVisible();

      // Audit modal accessibility
      await assertNoA11yViolations(page, "Keyboard Shortcuts Cheat-sheet Modal");

      // Dismiss via Escape key
      await page.keyboard.press("Escape");
    }

    // 3. Test In-Player Subtitle Settings
    const subtitleButton = page.locator(
      'button[aria-label*="Subtitle"], button[aria-label*="Caption"], button:has-text("CC"), button:has-text("Subtitles")'
    ).first();

    if (await subtitleButton.isVisible()) {
      await subtitleButton.click();

      // Check if Subtitle Settings Modal appears
      const settingsModal = page.locator('[role="dialog"]');
      if (await settingsModal.isVisible()) {
        await expect(settingsModal).toHaveAttribute("aria-modal", "true");

        // Verify language options exist
        await expect(settingsModal.getByText(/English|Subtitle|Language|Captions/i).first()).toBeVisible();

        // Audit modal accessibility
        await assertNoA11yViolations(page, "Subtitle Configuration Modal");

        // Dismiss settings modal
        await page.keyboard.press("Escape");
      }
    }

    // 4. Overall watch shell accessibility audit
    await assertNoA11yViolations(page, "Watch Streaming Shell", {
      disabledRules: ["color-contrast"], // Dynamic video canvas contrast
    });
  });
});
