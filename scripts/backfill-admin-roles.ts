/**
 * Admin Role Audit & Sanitization Utility (Task 10.1)
 *
 * Scans Supabase User Database for accounts marked as 'admin' in user_metadata or profiles.
 *
 * Safety Rules:
 *   1. DEFAULT is DRY RUN. No changes are applied unless --apply is explicitly specified.
 *   2. Only accounts whose email is explicitly passed via --promote are granted/confirmed app_metadata.role = 'admin'.
 *   3. Every other flagged account (self-promoted via user_metadata or profiles) has rogue roles stripped
 *      and profiles.role reset to 'user'.
 *   4. Paginates through all auth.users pages rather than stopping at the first page.
 *
 * Usage:
 *   # Audit / Dry run (lists suspicious and existing admin accounts without modifying anything):
 *   npx tsx scripts/backfill-admin-roles.ts
 *
 *   # Live apply: promote verified admins and sanitize rogue accounts:
 *   npx tsx scripts/backfill-admin-roles.ts --apply --promote admin@dramashort.com,staff@dramashort.com
 */

import { createClient, type User } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const userUrl = process.env.NEXT_PUBLIC_USER_SUPABASE_URL;
const serviceKey = process.env.USER_SUPABASE_SERVICE_ROLE_KEY;

if (!userUrl || !serviceKey) {
  console.error("❌ Missing User Supabase environment variables in .env.local");
  process.exit(1);
}

const supabase = createClient(userUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function parsePromoteEmails(): Set<string> {
  const promoteSet = new Set<string>();

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === "--promote" && i + 1 < process.argv.length) {
      const emails = process.argv[i + 1].split(",");
      for (const e of emails) {
        if (e.trim()) promoteSet.add(e.trim().toLowerCase());
      }
      i++;
    } else if (arg.startsWith("--promote=")) {
      const emails = arg.slice("--promote=".length).split(",");
      for (const e of emails) {
        if (e.trim()) promoteSet.add(e.trim().toLowerCase());
      }
    }
  }

  return promoteSet;
}

async function fetchAllUsers(): Promise<User[]> {
  const users: User[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed to list users on page ${page}: ${error.message}`);
    }

    if (!data.users || data.users.length === 0) {
      break;
    }

    users.push(...data.users);

    if (data.users.length < perPage) {
      break;
    }

    page++;
  }

  return users;
}

async function main() {
  const isApply = process.argv.includes("--apply");
  const promoteEmails = parsePromoteEmails();

  console.log("==================================================================");
  console.log(`🛡️  Admin Role Audit & Sanitization (${isApply ? "LIVE APPLY" : "DRY RUN - No changes will be made"})`);
  console.log("==================================================================");

  if (!isApply) {
    console.log("ℹ️  To execute changes, re-run with --apply and specify authorized admins:");
    console.log("   npx tsx scripts/backfill-admin-roles.ts --apply --promote admin@example.com\n");
  }

  if (promoteEmails.size > 0) {
    console.log(`✅ Authorized admin emails to confirm/promote (${promoteEmails.size}):`);
    for (const email of promoteEmails) {
      console.log(`   - ${email}`);
    }
  } else if (isApply) {
    console.warn("⚠️  WARNING: Running with --apply but no --promote emails specified.");
    console.warn("   ALL flagged accounts will have admin privileges stripped!\n");
  }

  console.log("\n📡 Paginating through all auth accounts in Supabase User DB...");
  const users = await fetchAllUsers();
  console.log(`✓ Fetched ${users.length} total user accounts across all pages.\n`);

  let flaggedCount = 0;
  let promotedCount = 0;
  let sanitizedCount = 0;

  for (const user of users) {
    const userEmail = (user.email || "").toLowerCase();
    const hasUserMetaRole = user.user_metadata?.role === "admin";
    const hasAppMetaRole = user.app_metadata?.role === "admin";

    // Query profiles table for role mirror
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const hasProfileRole = profile?.role === "admin";

    // Check if account has any admin flag (legitimate or rogue)
    if (hasUserMetaRole || hasAppMetaRole || hasProfileRole || promoteEmails.has(userEmail)) {
      flaggedCount++;
      const isAuthorized = promoteEmails.has(userEmail);

      console.log(`------------------------------------------------------------------`);
      console.log(`👤 Account: ${user.email} (ID: ${user.id})`);
      console.log(`   • Current app_metadata.role:  ${user.app_metadata?.role ?? "(none)"}`);
      console.log(`   • Current user_metadata.role: ${user.user_metadata?.role ?? "(none)"}`);
      console.log(`   • Current profiles.role:      ${profile?.role ?? "(none)"}`);

      if (isAuthorized) {
        console.log(`   👉 Action: CONFIRM / PROMOTE ADMIN (explicitly whitelisted)`);

        if (isApply) {
          // Prepare sanitized user_metadata (strip user-writable role key)
          const sanitizedUserMeta = { ...(user.user_metadata || {}) };
          delete sanitizedUserMeta.role;

          const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
            app_metadata: {
              ...user.app_metadata,
              role: "admin",
            },
            user_metadata: sanitizedUserMeta,
          });

          if (updateError) {
            console.error(`   ❌ Failed to update auth metadata: ${updateError.message}`);
          } else {
            console.log(`   ✅ Confirmed app_metadata.role = 'admin' & stripped user_metadata.role`);
            promotedCount++;
          }

          // Ensure profiles table has role = 'admin'
          if (profile?.role !== "admin") {
            await supabase.from("profiles").update({ role: "admin" }).eq("id", user.id);
            console.log(`   ✅ Synchronized profiles.role = 'admin' display mirror`);
          }
        }
      } else {
        // Flagged account NOT in --promote whitelist
        console.log(`   ⚠️  Action: SANITIZE / REVOKE (Not in authorized --promote list)`);

        if (isApply) {
          const sanitizedUserMeta = { ...(user.user_metadata || {}) };
          delete sanitizedUserMeta.role;

          const sanitizedAppMeta = { ...(user.app_metadata || {}) };
          delete sanitizedAppMeta.role;

          const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
            app_metadata: sanitizedAppMeta,
            user_metadata: sanitizedUserMeta,
          });

          if (updateError) {
            console.error(`   ❌ Failed to sanitize user: ${updateError.message}`);
          } else {
            console.log(`   ✅ Stripped rogue app_metadata.role and user_metadata.role`);
            sanitizedCount++;
          }

          if (profile?.role === "admin") {
            await supabase.from("profiles").update({ role: "user" }).eq("id", user.id);
            console.log(`   ✅ Reset profiles.role to 'user'`);
          }
        }
      }
    }
  }

  console.log(`\n==================================================================`);
  console.log(`🎉 Audit Summary:`);
  console.log(`   • Total accounts scanned:       ${users.length}`);
  console.log(`   • Flagged accounts:            ${flaggedCount}`);
  if (isApply) {
    console.log(`   • Legitimate admins confirmed:  ${promotedCount}`);
    console.log(`   • Rogue accounts sanitized:     ${sanitizedCount}`);
  } else {
    console.log(`   • Status:                      Dry run only. 0 modifications performed.`);
  }
  console.log(`==================================================================\n`);
}

main().catch((err) => {
  console.error("Fatal error during role audit:", err);
  process.exit(1);
});
