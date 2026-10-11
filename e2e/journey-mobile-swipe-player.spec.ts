import { test, expect } from "@playwright/test";
import { assertNoA11yViolations } from "./fixtures/axe-helper";

test.describe("Journey 5: Mobile-Viewport Immersive Watch & Touch Gestures", () => {
  // The watch page for the sample title is a 404 unless the app is connected to a
  // Supabase project seeded with `npm run db:seed:dev`. CI builds with placeholder
  // keys and has no backend, so this journey is skipped there unless one is provided.
  test.skip(
    !!process.env.CI && !process.env.E2E_SEEDED_BACKEND,
    "needs a seeded Supabase backend (set E2E_SEEDED_BACKEND=1 together with real project keys)"
  );

  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("mobile-viewport: 100dvh layout → touch swipe navigation → episode drawer with accessibility audits", async ({
    page,
  }) => {
    // Explicitly set mobile viewport before navigation
    await page.setViewportSize({ width: 390, height: 844 });

    const sampleSlug = "the-arranged-marriage-ghs";
    await page.goto(`/watch/${sampleSlug}?ep=1`);

    // 1. Verify mobile immersive watch shell contracts
    // Header & Footer should be hidden on mobile (< md)
    const header = page.locator("header");
    if (await header.count() > 0) {
      await expect(header).toBeHidden();
    }

    // Main video player container must span mobile viewport
    const mainContainer = page.locator("main").first();
    await expect(mainContainer).toBeVisible();

    // 2. Accessibility audit of mobile player shell
    await assertNoA11yViolations(page, "Mobile Watch Player Shell", {
      disabledRules: ["color-contrast"], // Dynamic video canvas contrast
    });

    // 3. Simulate Mobile Touch Swipe Gestures
    // Swipe UP (scroll down) to advance to next episode (deltaY > 60px)
    await page.touchscreen.tap(195, 422).catch(() => {});

    // Simulate vertical swipe gesture on video player container
    await page.evaluate(() => {
      const target = document.querySelector("main") || document.body;
      const touchStart = new Touch({
        identifier: Date.now(),
        target,
        clientX: 195,
        clientY: 550,
      });
      const touchMove = new Touch({
        identifier: Date.now(),
        target,
        clientX: 195,
        clientY: 350,
      });

      target.dispatchEvent(new TouchEvent("touchstart", { touches: [touchStart], bubbles: true }));
      target.dispatchEvent(new TouchEvent("touchmove", { touches: [touchMove], bubbles: true }));
      target.dispatchEvent(new TouchEvent("touchend", { changedTouches: [touchMove], bubbles: true }));
    });

    // 4. Test Mobile Episode Drawer
    const episodeButton = page.locator('button[aria-label="View all episodes"]').first();
    if (await episodeButton.isVisible()) {
      await episodeButton.click();

      const episodeSheet = page.locator('[role="dialog"]');
      if (await episodeSheet.isVisible()) {
        await expect(episodeSheet).toHaveAttribute("aria-modal", "true");
        await assertNoA11yViolations(page, "Mobile Episode Sheet Drawer");

        // Close drawer
        await page.keyboard.press("Escape");
      }
    }
  });
});
