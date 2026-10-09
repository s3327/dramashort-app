import { Page, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export interface AccessibilityCheckOptions {
  include?: string[];
  exclude?: string[];
  disabledRules?: string[];
}

/**
 * Executes automated WCAG 2.1 AA accessibility audit on the active page or container.
 */
export async function assertNoA11yViolations(
  page: Page,
  contextLabel: string,
  options: AccessibilityCheckOptions = {}
) {
  let builder = new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag21aa",
  ]);

  if (options.include && options.include.length > 0) {
    for (const sel of options.include) {
      builder = builder.include(sel);
    }
  }

  if (options.exclude && options.exclude.length > 0) {
    for (const sel of options.exclude) {
      builder = builder.exclude(sel);
    }
  }

  const disabledRules = Array.from(
    new Set(["color-contrast", ...(options.disabledRules || [])])
  );
  builder = builder.disableRules(disabledRules);

  const results = await builder.analyze();

  const criticalOrSerious = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  );

  if (criticalOrSerious.length > 0) {
    const summary = criticalOrSerious
      .map(
        (v) =>
          `[${v.impact?.toUpperCase()}] ${v.id}: ${v.help} (${v.nodes.length} occurrences)`
      )
      .join("\n");
    expect(
      criticalOrSerious,
      `Accessibility violations detected on ${contextLabel}:\n${summary}`
    ).toHaveLength(0);
  }

  return results;
}
