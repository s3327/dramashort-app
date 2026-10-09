#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

/**
 * First-Load JavaScript Bundle Budget Validator (Task 17.3).
 * Enforces mobile profile performance budgets on key routes.
 */

const ROOT = process.cwd();
const NEXT_DIR = path.join(ROOT, ".next");
const APP_MANIFEST_PATH = path.join(NEXT_DIR, "app-build-manifest.json");

// First Load JS (Gzip transfer) Budget thresholds in Kilobytes (kB)
export const ROUTE_BUDGETS_KB = {
  "/": 220, // Home catalog page (target <= 220 kB)
  "/drama/[slug]": 225, // Drama detail view (target <= 225 kB)
  "/watch/[slug]": 450, // Immersive video streaming player shell with HLS (target <= 450 kB)
};

export function evaluateBundleBudgets(
  manifestPath = APP_MANIFEST_PATH,
  nextDir = NEXT_DIR,
  budgets = ROUTE_BUDGETS_KB
) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Build manifest not found at ${manifestPath}. Run "npm run build" first.`
    );
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const pages = manifest.pages || {};
  const results = [];

  for (const [routePattern, maxBudgetKb] of Object.entries(budgets)) {
    const manifestKey = routePattern === "/" ? "/page" : `${routePattern}/page`;
    const chunkFiles = pages[manifestKey] || pages[`/${manifestKey}`] || [];

    if (chunkFiles.length === 0) {
      const foundKey = Object.keys(pages).find(
        (k) =>
          k.replace(/\/page$/, "") === routePattern || k === manifestKey
      );
      if (foundKey) {
        chunkFiles.push(...pages[foundKey]);
      }
    }

    const uniqueFiles = Array.from(new Set(chunkFiles));
    let rawBytes = 0;
    let gzippedBytes = 0;

    for (const relFile of uniqueFiles) {
      const fullPath = path.join(nextDir, relFile);
      if (fs.existsSync(fullPath)) {
        const fileBuf = fs.readFileSync(fullPath);
        rawBytes += fileBuf.length;
        gzippedBytes += zlib.gzipSync(fileBuf).length;
      }
    }

    const actualGzipKb = Number((gzippedBytes / 1024).toFixed(1));
    const rawKb = Number((rawBytes / 1024).toFixed(1));
    const passed = actualGzipKb <= maxBudgetKb;

    results.push({
      route: routePattern,
      actualGzipKb,
      rawKb,
      maxBudgetKb,
      passed,
      chunksCount: uniqueFiles.length,
    });
  }

  return results;
}

// CLI execution
if (process.argv[1] && process.argv[1].endsWith("check-bundle-budget.mjs")) {
  try {
    console.log("Checking Next.js First-Load JavaScript Bundle Budgets (Gzip Transfer)...\n");
    const results = evaluateBundleBudgets();
    let hasFailure = false;

    for (const r of results) {
      const statusIcon = r.passed ? "✔ PASS" : "✖ FAIL";
      console.log(
        ` ${statusIcon} [${r.route}] First Load JS: ${r.actualGzipKb} kB (raw: ${r.rawKb} kB) / Budget: ${r.maxBudgetKb} kB (${r.chunksCount} chunks)`
      );
      if (!r.passed) {
        hasFailure = true;
      }
    }

    if (hasFailure) {
      console.error(
        "\n❌ Error: One or more routes exceeded their First-Load JavaScript budget!"
      );
      process.exit(1);
    } else {
      console.log(
        "\n✅ All routes satisfied their First-Load JavaScript bundle budgets."
      );
    }
  } catch (err) {
    console.error("Failed to evaluate bundle budgets:", err.message);
    process.exit(1);
  }
}
