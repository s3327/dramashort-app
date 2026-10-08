import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import axe from "axe-core";
import {
  getRelativeLuminance,
  getContrastRatio,
  verifyThemeContrast,
  verifyAllThemes,
  THEME_PALETTES,
} from "@/lib/theme/wcag-contrast";

const ROOT = process.cwd();

test("Task 14.9: WCAG 2.1 AA Color Contrast Engine validates standard formulas", () => {
  // Pure black luminance is 0, pure white luminance is 1
  assert.equal(getRelativeLuminance(0, 0, 0), 0, "Pure black relative luminance must be 0");
  assert.equal(getRelativeLuminance(255, 255, 255), 1, "Pure white relative luminance must be 1");

  // Pure black on pure white contrast is exactly 21:1
  const maxContrast = getContrastRatio([0, 0, 0], [255, 255, 255]);
  assert.equal(Number(maxContrast.toFixed(1)), 21, "Black on white contrast ratio must be 21:1");

  // Same color contrast is 1:1
  const minContrast = getContrastRatio([128, 128, 128], [128, 128, 128]);
  assert.equal(Number(minContrast.toFixed(1)), 1, "Identical colors contrast ratio must be 1:1");
});

test("Task 14.9: Theme palettes achieve WCAG AA contrast in light, soft, and dark themes", () => {
  const reports = verifyAllThemes();
  assert.equal(reports.length, 3, "Must report contrast for light, soft, and dark themes");

  for (const report of reports) {
    assert.ok(
      report.textPassesAA,
      `Theme ${report.theme} body text contrast (${report.textContrast}:1) must exceed WCAG AA 4.5:1`
    );
    assert.ok(
      report.mutedTextPassesAA,
      `Theme ${report.theme} muted text contrast (${report.mutedTextContrast}:1) must exceed WCAG AA 4.5:1`
    );
    assert.ok(
      report.linkPassesAA,
      `Theme ${report.theme} link contrast (${report.linkContrast}:1) must exceed WCAG AA 4.5:1`
    );
    assert.ok(
      report.btnPrimaryPassesUI,
      `Theme ${report.theme} primary button contrast (${report.btnPrimaryContrast}:1) must exceed WCAG AA UI 3.0:1`
    );
  }
});

test("Task 14.9: Modal component implements keyboard focus trap, ARIA semantics, and scroll lock", () => {
  const modalPath = path.join(ROOT, "components", "Modal.tsx");
  assert.ok(fs.existsSync(modalPath), "components/Modal.tsx must exist");
  const modalContent = fs.readFileSync(modalPath, "utf-8");

  // Semantics & ARIA dialog attributes
  assert.ok(modalContent.includes('role="dialog"'), "Modal must have role='dialog'");
  assert.ok(modalContent.includes('aria-modal="true"'), "Modal must have aria-modal='true'");
  assert.ok(
    modalContent.includes('aria-labelledby={title ? titleId : undefined}') ||
      modalContent.includes('aria-labelledby="modal-title"'),
    "Modal must have aria-labelledby bound to title"
  );

  // Focus trap implementation
  assert.ok(
    modalContent.includes("focusableElements") && modalContent.includes("querySelectorAll"),
    "Modal must query focusable child elements"
  );
  assert.ok(
    modalContent.includes('e.key === "Tab"') && modalContent.includes("e.shiftKey"),
    "Modal must intercept Tab and Shift+Tab keydown events to trap focus"
  );
  assert.ok(
    modalContent.includes('e.key === "Escape"'),
    "Modal must handle Escape key to dismiss"
  );

  // Focus restoration & background scroll lock
  assert.ok(
    modalContent.includes("previousActiveElementRef") &&
      modalContent.includes("previousActiveElementRef.current.focus()"),
    "Modal must restore focus to opener element upon unmount"
  );
  assert.ok(
    modalContent.includes('document.body.style.overflow = "hidden"'),
    "Modal must lock background body scrolling while open"
  );

  // Close button visible focus & accessible label
  assert.ok(
    modalContent.includes('aria-label="Close dialog"'),
    "Modal close button must have aria-label='Close dialog'"
  );
  assert.ok(
    modalContent.includes("focus-visible:ring-2") && modalContent.includes("focus-visible:ring-primary"),
    "Modal close button must have visible focus ring"
  );
});

test("Task 14.9: Toast components provide polite live region announcements", () => {
  // Global Toast component
  const toastPath = path.join(ROOT, "components", "Toast.tsx");
  assert.ok(fs.existsSync(toastPath), "components/Toast.tsx must exist");
  const toastContent = fs.readFileSync(toastPath, "utf-8");

  assert.ok(toastContent.includes('role="status"'), "Toast must declare role='status'");
  assert.ok(toastContent.includes('aria-live="polite"'), "Toast must declare aria-live='polite'");
  assert.ok(toastContent.includes('aria-atomic="true"'), "Toast must declare aria-atomic='true'");

  // WatchOverlay share toast
  const overlayPath = path.join(ROOT, "components", "player", "WatchOverlay.tsx");
  const overlayContent = fs.readFileSync(overlayPath, "utf-8");
  assert.ok(
    overlayContent.includes('role="status"') &&
      overlayContent.includes('aria-live="polite"') &&
      overlayContent.includes('aria-atomic="true"'),
    "WatchOverlay toast must declare role='status' and aria-live='polite'"
  );
});

test("Task 14.9: Episode sheets and grids declare descriptive accessible names", () => {
  // Mobile EpisodeSheet
  const sheetPath = path.join(ROOT, "components", "player", "EpisodeSheet.tsx");
  const sheetContent = fs.readFileSync(sheetPath, "utf-8");

  assert.ok(
    sheetContent.includes('aria-label={`Episode ${ep}, coming soon`}'),
    "EpisodeSheet unavailable tiles must specify coming soon in aria-label"
  );
  assert.ok(
    sheetContent.includes("currently playing"),
    "EpisodeSheet active tile must specify currently playing in aria-label"
  );
  assert.ok(
    sheetContent.includes('aria-disabled="true"'),
    "EpisodeSheet unavailable tiles must specify aria-disabled='true'"
  );

  // Desktop WatchPlayerIsland sidebar
  const islandPath = path.join(ROOT, "components", "watch", "WatchPlayerIsland.tsx");
  const islandContent = fs.readFileSync(islandPath, "utf-8");

  assert.ok(
    islandContent.includes('aria-label={`Episode ${ep}, coming soon`}'),
    "WatchPlayerIsland sidebar unavailable tiles must specify coming soon in aria-label"
  );
  assert.ok(
    islandContent.includes("currently playing"),
    "WatchPlayerIsland sidebar active tile must specify currently playing in aria-label"
  );

  // Drama details episode grid
  const dramaPagePath = path.join(ROOT, "app", "drama", "[slug]", "page.tsx");
  const dramaPageContent = fs.readFileSync(dramaPagePath, "utf-8");

  assert.ok(
    dramaPageContent.includes('aria-label={`Episode ${ep}`}'),
    "Drama page episode links must declare descriptive aria-label"
  );
});

test("Task 14.9: Controls declare visible focus rings across player, cards, and breadcrumbs", () => {
  // VideoPlayer
  const playerPath = path.join(ROOT, "components", "VideoPlayer.tsx");
  const playerContent = fs.readFileSync(playerPath, "utf-8");

  assert.ok(
    playerContent.includes('role="slider"'),
    "VideoPlayer scrubber must declare role='slider'"
  );
  assert.ok(
    playerContent.includes('aria-label="Seek time slider"'),
    "VideoPlayer scrubber must declare accessible name"
  );
  assert.ok(
    playerContent.includes('e.key === "ArrowLeft"') && playerContent.includes('e.key === "ArrowRight"'),
    "VideoPlayer scrubber must support arrow key scrubbing"
  );
  assert.ok(
    playerContent.includes("focus-visible:ring-2") && playerContent.includes("focus-visible:ring-primary"),
    "VideoPlayer controls must declare visible focus rings"
  );

  // TitleCard
  const cardPath = path.join(ROOT, "components", "TitleCard.tsx");
  const cardContent = fs.readFileSync(cardPath, "utf-8");
  assert.ok(
    cardContent.includes("focus-visible:ring-2") && cardContent.includes("focus-visible:ring-primary"),
    "TitleCard must declare visible focus rings on interactive links"
  );

  // Breadcrumbs
  const breadcrumbsPath = path.join(ROOT, "components", "Breadcrumbs.tsx");
  const breadcrumbsContent = fs.readFileSync(breadcrumbsPath, "utf-8");
  assert.ok(
    breadcrumbsContent.includes("focus-visible:ring-2") && breadcrumbsContent.includes("focus-visible:ring-primary"),
    "Breadcrumbs must declare visible focus rings on navigation links"
  );
});

test("Task 14.9: Axe-core WCAG 2.1 AA rules and automated validation", () => {
  assert.ok(axe && axe.version, "Axe-core must be initialized");
  assert.match(axe.version, /^4\./, "Axe-core version must be 4.x");

  const allRules = axe.getRules();
  assert.ok(allRules.length >= 80, "Axe-core must load accessibility rules");

  const ruleIds = allRules.map((r) => r.ruleId);
  assert.ok(ruleIds.includes("color-contrast"), "Axe must include color-contrast rule");
  assert.ok(ruleIds.includes("button-name"), "Axe must include button-name rule");
  assert.ok(ruleIds.includes("link-name"), "Axe must include link-name rule");
  assert.ok(ruleIds.includes("aria-dialog-name"), "Axe must include aria-dialog-name rule");
  assert.ok(ruleIds.includes("aria-allowed-role"), "Axe must include aria-allowed-role rule");
  assert.ok(ruleIds.includes("aria-allowed-attr"), "Axe must include aria-allowed-attr rule");

  // Validate virtual node execution with axe
  const axeAny = axe as any;
  const validButtonNode = new axeAny.SerialVirtualNode({
    nodeName: "button",
    props: { nodeName: "button" },
    attr: { "aria-label": "Play Episode", type: "button" },
  });

  const buttonResult = axeAny.runVirtualRule("button-name", validButtonNode);
  assert.equal(
    buttonResult.violations.length,
    0,
    "Virtual button with aria-label must have 0 violations in button-name rule"
  );
});
