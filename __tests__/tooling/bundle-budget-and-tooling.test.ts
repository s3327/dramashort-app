import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import {
  evaluateBundleBudgets,
  ROUTE_BUDGETS_KB,
} from "@/scripts/check-bundle-budget.mjs";
import { validateEnvironment } from "@/lib/config/env-validator.mjs";

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

  describe("R6. CI Workflow Can Actually Pass", () => {
    const workflow = fs.readFileSync(path.join(ROOT, ".github", "workflows", "ci.yml"), "utf-8");
    const jobBlock = (name: string) => {
      const start = workflow.indexOf(`\n  ${name}:\n`);
      assert.ok(start >= 0, `job ${name} must exist`);
      const next = workflow.slice(start + 1).search(/\n {2}[a-z][\w-]*:\n/);
      return next < 0 ? workflow.slice(start) : workflow.slice(start, start + 1 + next);
    };
    const envOf = (block: string) =>
      Object.fromEntries(
        [...block.matchAll(/^\s+([A-Z][A-Z0-9_]+):\s*(\S+)\s*$/gm)].map((m) => [m[1], m[2]])
      );

    test("the build environment of each job satisfies the production env validator", () => {
      for (const job of ["verify", "playwright-e2e"]) {
        const env = { ...envOf(jobBlock(job)), NODE_ENV: "production" };
        const result = validateEnvironment(env, { throws: false });
        assert.deepEqual(result.errors, [], `${job}: next build would fail at config load`);
      }
    });

    test("unit tests run after the build they depend on", () => {
      const verify = jobBlock("verify");
      const build = verify.indexOf("run: npm run build");
      const tests = verify.indexOf("run: npm test");
      assert.ok(build > 0 && tests > 0, "verify job must build and test");
      assert.ok(build < tests, "bundle-budget tests read .next, so the build must come first");
    });

    test("the Supabase CLI used in CI matches the major version of the dev dependency", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
      const depMajor = String(pkg.devDependencies.supabase).replace(/^[^0-9]*/, "").split(".")[0];
      const ciVersion = workflow.match(/supabase\/setup-cli@v\d+\s+with:\s+version:\s*([\w.]+)/);
      assert.ok(ciVersion, "workflow must pin the Supabase CLI version");
      assert.equal(ciVersion[1].split(".")[0], depMajor);
    });

    test("database verification runs on one local stack and stops on the first failure", () => {
      const db = jobBlock("supabase-rls-verification");
      assert.equal((db.match(/ON_ERROR_STOP=1/g) || []).length, 2, "both psql runs must use ON_ERROR_STOP");
      assert.doesNotMatch(db, /\|\|/, "no fallback may mask a failing verification");
      assert.doesNotMatch(db, /--workdir/, "the repository root is the only Supabase workdir");
      assert.match(db, /supabase start\b/);
      assert.match(db, /supabase_db_dramashort/);
      assert.match(db, /verify-user-side-rls\.sql/);
      assert.match(db, /verify-catalog-rls\.sql/);
    });

    test(".gitattributes keeps text files on LF for every contributor", () => {
      const attrs = fs.readFileSync(path.join(ROOT, ".gitattributes"), "utf-8");
      assert.match(attrs, /^\* text=auto eol=lf$/m);
    });
  });

  describe("R7. Unit Tests Run Against Unmodified Dependencies", () => {
    // The real `server-only` package throws on import. The suite used to pass only
    // on machines where node_modules/server-only had been edited by hand, and failed
    // on every fresh install. The test scripts now preload a stub instead.
    const STUB = "./scripts/test/stub-server-only.cjs";

    test("both test scripts preload the server-only stub", () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
      for (const name of ["test", "test:file"]) {
        assert.ok(
          String(pkg.scripts[name]).includes(`--require ${STUB}`),
          `npm run ${name} must preload ${STUB}`
        );
      }
      assert.ok(fs.existsSync(path.join(ROOT, STUB)), "the stub file must exist");
    });

    test("inside the test process, server-only is an empty module that was never executed", () => {
      const projectRequire = createRequire(path.join(ROOT, "package.json"));
      const entry = projectRequire.resolve("server-only");
      const cached = projectRequire.cache[entry];
      assert.ok(cached, "server-only must be pre-registered; run the suite through `npm test` or `npm run test:file -- <file>`");
      assert.equal(cached.loaded, true);
      assert.deepEqual(cached.exports, {});
      assert.doesNotThrow(() => projectRequire("server-only"));
    });

    test("the stub does not change anything inside node_modules", () => {
      const stub = fs.readFileSync(path.join(ROOT, STUB), "utf-8");
      assert.doesNotMatch(stub, /writeFile|appendFile|copyFile|rename|unlink|rmSync|mkdir/);
    });
  });
});
