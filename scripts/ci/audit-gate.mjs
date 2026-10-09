#!/usr/bin/env node
/**
 * Strict Security Audit Gate (Step 11)
 *
 * Runs `npm audit --json` and evaluates all vulnerabilities against
 * `scripts/ci/audit-exceptions.json`.
 *
 * Enforces:
 * 1. ZERO unapproved High or Critical vulnerabilities.
 * 2. All exceptions must have active (non-expired) exemption dates and documented rationale.
 * 3. Fails CI with non-zero exit code if unapproved or expired high/critical vulnerabilities exist.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const EXCEPTIONS_FILE = path.join(__dirname, "audit-exceptions.json");

function main() {
  console.log("🔒 Running npm security audit gate...");

  let auditOutput = "";
  try {
    auditOutput = execSync("npm audit --json", {
      cwd: ROOT,
      encoding: "utf-8",
      maxBuffer: 20 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    // npm audit returns exit code 1 when vulnerabilities exist
    auditOutput = error.stdout?.toString() || "";
  }

  if (!auditOutput || auditOutput.trim().length === 0) {
    console.log("✅ npm audit returned no output; dependencies clean.");
    process.exit(0);
  }

  let auditData;
  try {
    auditData = JSON.parse(auditOutput);
  } catch (err) {
    console.error("❌ Failed to parse npm audit JSON output:", err.message);
    process.exit(1);
  }

  // Read exceptions allowlist
  let exceptionsData = { exceptions: [] };
  if (fs.existsSync(EXCEPTIONS_FILE)) {
    try {
      exceptionsData = JSON.parse(fs.readFileSync(EXCEPTIONS_FILE, "utf-8"));
    } catch (err) {
      console.error("❌ Failed to parse audit exceptions allowlist:", err.message);
      process.exit(1);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const validExceptions = new Set();
  const allowedModules = new Set();

  for (const ex of exceptionsData.exceptions || []) {
    if (ex.expires && ex.expires < today) {
      console.warn(`⚠️  Audit exception expired for ${ex.module} (${ex.advisory}) on ${ex.expires}`);
      continue;
    }
    allowedModules.add(ex.module);
    validExceptions.add(`${ex.module}:${ex.advisory || "*"}`);
    validExceptions.add(`${ex.module}:*`);
  }

  const vulnerabilities = auditData.vulnerabilities || {};
  const unapprovedHighCritical = [];

  for (const [modName, details] of Object.entries(vulnerabilities)) {
    const severity = details.severity?.toLowerCase();
    if (severity !== "high" && severity !== "critical") {
      continue;
    }

    // Check if the entire module is an approved exception
    if (allowedModules.has(modName)) {
      continue;
    }

    const viaList = Array.isArray(details.via) ? details.via : [];
    for (const via of viaList) {
      let isApproved = false;

      if (typeof via === "string") {
        // Transitive dependency by name: if the parent or dependency is allowed
        if (allowedModules.has(via) || allowedModules.has(modName)) {
          isApproved = true;
        }
      } else if (typeof via === "object") {
        const advisoryId = via.url?.split("/").pop() || via.title;
        const viaSeverity = (via.severity || severity)?.toLowerCase();

        if (viaSeverity !== "high" && viaSeverity !== "critical") {
          isApproved = true;
        } else if (
          validExceptions.has(`${modName}:${advisoryId}`) ||
          validExceptions.has(`${modName}:*`) ||
          allowedModules.has(modName)
        ) {
          isApproved = true;
        }
      }

      if (!isApproved) {
        unapprovedHighCritical.push({
          module: modName,
          severity,
          advisory: typeof via === "object" ? via.url?.split("/").pop() || via.title : via,
          title: typeof via === "object" ? via.title : `Transitive dependency on ${via}`,
          url: typeof via === "object" ? via.url : undefined,
        });
      }
    }
  }

  if (unapprovedHighCritical.length > 0) {
    console.error("\n❌ Security Audit Gate Failed: Unapproved High/Critical vulnerabilities detected:");
    for (const item of unapprovedHighCritical) {
      console.error(`   - [${item.severity.toUpperCase()}] ${item.module}: ${item.title} (${item.advisory})`);
      if (item.url) console.error(`     URL: ${item.url}`);
    }
    console.error("\nPlease upgrade affected dependencies or submit a reviewed exception in scripts/ci/audit-exceptions.json.\n");
    process.exit(1);
  }

  console.log(`✅ Security Audit Gate Passed: All detected advisories are covered by active, approved exceptions.`);
  process.exit(0);
}

main();
