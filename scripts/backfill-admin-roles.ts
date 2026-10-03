/**
 * Admin Role Audit & Backfill Utility (Task 10.1)
 *
 * Scans Supabase User Database for accounts marked as 'admin' in user_metadata or profiles.
 * Backfills authoritative app_metadata.role = 'admin' and strips user-writable user_metadata.role.
 *
 * Usage:
 *   npx tsx scripts/backfill-admin-roles.ts [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
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

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  console.log(`🔍 Starting Admin Role Audit & Backfill (${isDryRun ? "DRY RUN" : "LIVE APPLY"})...\n`);

  // 1. Fetch all users from Supabase Auth
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    console.error("❌ Failed to query auth users:", listError.message);
    process.exit(1);
  }

  const users = listData.users;
  console.log(`Found ${users.length} total user accounts in Supabase Auth.`);

  let auditedCount = 0;
  let updatedCount = 0;

  for (const user of users) {
    const hasUserMetaRole = user.user_metadata?.role === "admin";
    const hasAppMetaRole = user.app_metadata?.role === "admin";

    // Query profiles table
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const hasProfileRole = profile?.role === "admin";

    if (hasUserMetaRole || hasAppMetaRole || hasProfileRole) {
      auditedCount++;
      console.log(`\n👤 User: ${user.email} (ID: ${user.id})`);
      console.log(`   - app_metadata.role:  ${user.app_metadata?.role ?? "(none)"}`);
      console.log(`   - user_metadata.role: ${user.user_metadata?.role ?? "(none)"}`);
      console.log(`   - profiles.role:      ${profile?.role ?? "(none)"}`);

      if (!isDryRun) {
        // Prepare sanitized user_metadata (strip user-writable role)
        const updatedUserMeta = { ...(user.user_metadata || {}) };
        delete updatedUserMeta.role;

        const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
          app_metadata: {
            ...user.app_metadata,
            role: "admin",
          },
          user_metadata: updatedUserMeta,
        });

        if (updateError) {
          console.error(`   ❌ Failed to update auth metadata: ${updateError.message}`);
        } else {
          console.log(`   ✅ Backfilled app_metadata.role = 'admin' & stripped user_metadata.role`);
          updatedCount++;
        }

        // Mirror in profiles for display purposes
        if (profile?.role !== "admin") {
          await supabase.from("profiles").update({ role: "admin" }).eq("id", user.id);
          console.log(`   ✅ Synced profiles.role = 'admin' mirror`);
        }
      }
    }
  }

  console.log(`\n🎉 Audit complete:`);
  console.log(`   - Admin accounts audited: ${auditedCount}`);
  if (!isDryRun) {
    console.log(`   - Accounts backfilled & sanitized: ${updatedCount}`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
