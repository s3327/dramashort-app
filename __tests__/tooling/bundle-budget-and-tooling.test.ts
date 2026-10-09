import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  evaluateBundleBudgets,
  ROUTE_BUDGETS_KB,
} from "@/scripts/check-bundle-budget.mjs";

const ROOT = process.cwd();

describe("Task 17.3: Tooling Upgrades & Performance Budgets", () => {
  describe("R1. ESLint Flat Config Architecture", () => {
    test("verifies eslint.config.mjs exists and legacy .eslintrc is removed", () => {
      const flatConfigPath = path.join(ROOT, "eslint.config.mjs");
      const legacyConfigPath = path.join(ROOT, ".eslintrc.json");

      assert.ok(fs.existsSync(flatConfigPath), "eslint.config.mjs must exist");
      assert.equal(
        fs.existsSync(legacyConfigPath),
        false,
        "Legacy .eslintrc.json must be removed"
      );

      const flatContent = fs.readFileSync(flatConfigPath, "utf-8");
      assert.ok(
        flatContent.includes("FlatCompat"),
        "Must use FlatCompat for Next.js configuration compatibility"
      );
      assert.ok(
        flatContent.includes("next/core-web-vitals"),
        "Must extend next/core-web-vitals"
      );
      assert.ok(
        flatContent.includes(".next/**"),
        "Must ignore .next build directory"
      );
      assert.ok(
        flatContent.includes("node_modules/**"),
        "Must ignore node_modules"
      );
    });

    test("verifies package.json lint script executes ESLint CLI directly", () => {
      const pkgPath = path.join(ROOT, "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

      assert.equal(
        pkg.scripts.lint,
        "eslint .",
        "npm run lint must execute 'eslint .' rather than deprecated 'next lint'"
      );
    });
  });

  describe("R2. Automated Dependency Management (Dependabot)", () => {
    test("verifies .github/dependabot.yml exists and configures weekly npm and GitHub Actions updates", () => {
      const dependabotPath = path.join(ROOT, ".github", "dependabot.yml");
      assert.ok(fs.existsSync(dependabotPath), ".github/dependabot.yml must exist");

      const content = fs.readFileSync(dependabotPath, "utf-8");
      assert.ok(content.includes("version: 2"), "Dependabot version must be 2");
      assert.ok(
        content.includes('package-ecosystem: "npm"'),
        "Must configure npm package ecosystem"
      );
      assert.ok(
        content.includes('package-ecosystem: "github-actions"'),
        "Must configure github-actions package ecosystem"
      );
      assert.ok(
        content.includes('interval: "weekly"'),
        "Must schedule weekly updates"
      );
    });
  });

  describe("R3. Bundle Analyzer Integration", () => {
    test("verifies next.config.mjs integrates @next/bundle-analyzer conditionally", () => {
      const nextConfigPath = path.join(ROOT, "next.config.mjs");
      assert.ok(fs.existsSync(nextConfigPath), "next.config.mjs must exist");

      const content = fs.readFileSync(nextConfigPath, "utf-8");
      assert.ok(
        content.includes("@next/bundle-analyzer"),
        "next.config.mjs must import @next/bundle-analyzer"
      );
      assert.ok(
        content.includes("process.env.ANALYZE === \"true\""),
        "Bundle analyzer must be gated by ANALYZE environment variable"
      );
    });
  });

  describe("R4. First-Load JavaScript Bundle Budget Evaluation", () => {
    test("verifies route budget thresholds configuration", () => {
      assert.ok(ROUTE_BUDGETS_KB["/"] !== undefined, "Must define budget for home route");
      assert.ok(ROUTE_BUDGETS_KB["/drama/[slug]"] !== undefined, "Must define budget for drama detail route");
      assert.ok(ROUTE_BUDGETS_KB["/watch/[slug]"] !== undefined, "Must define budget for watch route");

      assert.ok(ROUTE_BUDGETS_KB["/"] <= 250, "Home route budget must be reasonable");
      assert.ok(ROUTE_BUDGETS_KB["/watch/[slug]"] <= 500, "Watch route budget must be reasonable");
    });

    test("evaluates real Next.js build bundle sizes against production budgets", () => {
      const results = evaluateBundleBudgets();
      assert.ok(results.length >= 3, "Must evaluate at least 3 key routes");

      for (const res of results) {
        assert.ok(res.actualGzipKb > 0, `Route ${res.route} must have positive chunk size`);
        assert.ok(
          res.passed,
          `Route ${res.route} (${res.actualGzipKb} kB) must satisfy budget (${res.maxBudgetKb} kB)`
        );
      }
    });

    test("deliberate failure contract: fails when budget is exceeded", () => {
      const artificialStrictBudgets = {
        ...ROUTE_BUDGETS_KB,
        "/": 5, // Unrealistically low budget of 5 kB
      };

      const results = evaluateBundleBudgets(
        undefined,
        undefined,
        artificialStrictBudgets
      );

      const homeResult = results.find((r) => r.route === "/");
      assert.ok(homeResult);
      assert.equal(
        homeResult.passed,
        false,
        "Route must fail when actual size exceeds artificial strict budget"
      );
    });
  });

  describe("R5. Lighthouse CI & Mobile Profile Configuration", () => {
    test("verifies .lighthouserc.json and bundle-budget.json configurations", () => {
      const lighthousercPath = path.join(ROOT, ".lighthouserc.json");
      const budgetPath = path.join(ROOT, "bundle-budget.json");

      assert.ok(fs.existsSync(lighthousercPath), ".lighthouserc.json must exist");
      assert.ok(fs.existsSync(budgetPath), "bundle-budget.json must exist");

      const lighthouserc = JSON.parse(fs.readFileSync(lighthousercPath, "utf-8"));
      assert.ok(Array.isArray(lighthouserc.ci.collect.url), "Must configure target URLs");
      assert.ok(
        lighthouserc.ci.collect.url.some((u: string) => u.includes("/watch/")),
        "Must include /watch/ route in Lighthouse targets"
      );
      assert.equal(
        lighthouserc.ci.collect.settings.preset,
        "mobile",
        "Must configure mobile preset"
      );
      assert.ok(
        lighthouserc.ci.assert.assertions["categories:accessibility"],
        "Must assert accessibility category"
      );

      const budget = JSON.parse(fs.readFileSync(budgetPath, "utf-8"));
      assert.ok(Array.isArray(budget), "bundle-budget.json must be an array");
      assert.ok(
        budget[0].resourceSizes.some((r: any) => r.resourceType === "script"),
        "Must specify script budget"
      );
    });
  });
});
