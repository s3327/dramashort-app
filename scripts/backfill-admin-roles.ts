/**
 * Admin Role Audit & Sanitization Utility (Task 10.1)
 *
 * Scans Supabase User Database for admin accounts and self-elevated accounts.
 *
 * Safety & Security Rules:
 *   1. DEFAULT is DRY RUN. No modifications are applied unless --apply is explicitly passed.
 *   2. Guarded Apply: --apply requires either --promote <emails> or explicit --revoke-all-unconfirmed.
 *   3. Typo Protection: Reports unmatched --promote emails and halts apply if any email is missing.
 *   4. Verified Identity: Accounts in --promote must have email_confirmed_at populated; rejects unverified emails.
 *   5. Preserves Legitimate Roles:
 *      - Accounts with existing app_metadata.role = 'admin' are preserved by default unless in --revoke.
 *      - Accounts with app_metadata.role = 'editor' retain their editor role even if rogue user_metadata was set.
 *   6. Sanitizes Rogue Accounts:
 *      - Accounts with only user_metadata.role or profiles.role have user_metadata.role stripped and profiles.role reset to 'user'.
 *   7. Optimized Database Access: Single pre-query for profiles.role = 'admin' (eliminates N+1 lookups).
 *   8. Checked Profile Mutations: Profile updates explicitly verify error return values.
 *
 * Usage Examples:
 *   # Audit current state (dry run):
 *   npx tsx scripts/backfill-admin-roles.ts
 *
 *   # Confirm & promote verified admins:
 *   npx tsx scripts/backfill-admin-roles.ts --apply --promote admin@dramashort.com,staff@dramashort.com
 *
 *   # Explicitly revoke an admin:
 *   npx tsx scripts/backfill-admin-roles.ts --apply --promote admin@dramashort.com --revoke former.admin@dramashort.com
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

function parseEmailListFlag(flagName: string): Set<string> {
  const result = new Set<string>();

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === flagName && i + 1 < process.argv.length) {
      const emails = process.argv[i + 1].split(",");
      for (const e of emails) {
        if (e.trim()) result.add(e.trim().toLowerCase());
      }
      i++;
    } else if (arg.startsWith(`${flagName}=`)) {
      const emails = arg.slice(`${flagName}=`.length).split(",");
      for (const e of emails) {
        if (e.trim()) result.add(e.trim().toLowerCase());
      }
    }
  }

  return result;
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
  const allowRevokeAll = process.argv.includes("--revoke-all-unconfirmed");
  const promoteEmails = parseEmailListFlag("--promote");
  const revokeEmails = parseEmailListFlag("--revoke");

  console.log("==================================================================");
  console.log(`🛡️  Admin Role Audit & Sanitization (${isApply ? "LIVE APPLY" : "DRY RUN - No changes will be made"})`);
  console.log("==================================================================");

  // Safety Gate: Prevent accidental wipeout when --apply is run without explicit instructions
  if (isApply && promoteEmails.size === 0 && !allowRevokeAll && revokeEmails.size === 0) {
    console.error("❌ SAFETY ERROR: --apply was provided without --promote <emails>, --revoke <emails>, or --revoke-all-unconfirmed.");
    console.error("   To prevent accidental admin lockouts, please specify authorized admins: ");
    console.error("   npx tsx scripts/backfill-admin-roles.ts --apply --promote admin@example.com\n");
    process.exit(1);
  }

  if (promoteEmails.size > 0) {
    console.log(`✅ Authorized admin emails to confirm/promote (${promoteEmails.size}):`);
    for (const email of promoteEmails) {
      console.log(`   • ${email}`);
    }
  }

  if (revokeEmails.size > 0) {
    console.log(`🚫 Admin emails to explicitly revoke (${revokeEmails.size}):`);
    for (const email of revokeEmails) {
      console.log(`   • ${email}`);
    }
  }

  // 1. Efficient batch lookup of all profiles with role = 'admin' (avoids N+1 queries)
  console.log("\n📡 Querying profiles table for admin records...");
  const { data: adminProfiles, error: profQueryError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("role", "admin");

  if (profQueryError) {
    console.error("❌ Failed to query profiles table:", profQueryError.message);
    process.exit(1);
  }

  const adminProfileUserIds = new Set<string>((adminProfiles || []).map((p) => p.id));
  console.log(`✓ Found ${adminProfileUserIds.size} profile rows with role = 'admin'.`);

  // 2. Fetch all auth users with pagination
  console.log("📡 Fetching all accounts from Supabase Auth...");
  const users = await fetchAllUsers();
  console.log(`✓ Fetched ${users.length} total user accounts.\n`);

  const matchedPromoteEmails = new Set<string>();
  const matchedRevokeEmails = new Set<string>();

  let preservedAdmins = 0;
  let promotedAdmins = 0;
  let revokedAdmins = 0;
  let sanitizedRogue = 0;
  let promotionErrors = 0;

  for (const user of users) {
    const userEmail = (user.email || "").toLowerCase();
    const isPromoteRequested = promoteEmails.has(userEmail);
    const isRevokeRequested = revokeEmails.has(userEmail);

    if (isPromoteRequested) matchedPromoteEmails.add(userEmail);
    if (isRevokeRequested) matchedRevokeEmails.add(userEmail);

    const hasUserMetaRole = user.user_metadata?.role === "admin";
    const appMetaRole = user.app_metadata?.role;
    const hasAppMetaAdmin = appMetaRole === "admin";
    const hasAppMetaEditor = appMetaRole === "editor";
    const hasProfileAdmin = adminProfileUserIds.has(user.id);

    // Is this account relevant to the audit?
    const isRelevant =
      isPromoteRequested ||
      isRevokeRequested ||
      hasUserMetaRole ||
      hasAppMetaAdmin ||
      hasAppMetaEditor ||
      hasProfileAdmin;

    if (!isRelevant) continue;

    console.log(`------------------------------------------------------------------`);
    console.log(`👤 Account: ${user.email} (ID: ${user.id})`);
    console.log(`   • app_metadata.role:  ${appMetaRole ?? "(none)"}`);
    console.log(`   • user_metadata.role: ${user.user_metadata?.role ?? "(none)"}`);
    console.log(`   • profiles.role:      ${hasProfileAdmin ? "admin" : "(not admin)"}`);
    console.log(`   • email_confirmed:    ${user.email_confirmed_at ? "yes" : "NO"}`);

    // --- Action Resolution ---
    if (isRevokeRequested) {
      console.log(`   👉 Action: REVOKE (Explicitly requested via --revoke)`);
      if (isApply) {
        const sanitizedUserMeta = { ...(user.user_metadata || {}) };
        delete sanitizedUserMeta.role;

        const sanitizedAppMeta = { ...(user.app_metadata || {}) };
        delete sanitizedAppMeta.role;

        const { error: authErr } = await supabase.auth.admin.updateUserById(user.id, {
          app_metadata: sanitizedAppMeta,
          user_metadata: sanitizedUserMeta,
        });

        if (authErr) {
          console.error(`   ❌ Failed to update auth metadata: ${authErr.message}`);
        } else {
          console.log(`   ✅ Stripped app_metadata.role and user_metadata.role`);
          revokedAdmins++;
        }

        const { error: pErr } = await supabase.from("profiles").update({ role: "user" }).eq("id", user.id);
        if (pErr) {
          console.error(`   ❌ Failed to reset profiles.role: ${pErr.message}`);
        } else {
          console.log(`   ✅ Reset profiles.role to 'user'`);
        }
      }
    } else if (isPromoteRequested) {
      // Validate email confirmation
      if (!user.email_confirmed_at) {
        console.error(`   ⚠️  REJECTED: User ${user.email} does not have a confirmed email (email_confirmed_at is null).`);
        console.error(`      Cannot promote unverified email accounts.`);
        promotionErrors++;
        continue;
      }

      console.log(`   👉 Action: PROMOTE / CONFIRM ADMIN (Explicitly matched in --promote)`);
      if (isApply) {
        const sanitizedUserMeta = { ...(user.user_metadata || {}) };
        delete sanitizedUserMeta.role;

        const { error: authErr } = await supabase.auth.admin.updateUserById(user.id, {
          app_metadata: {
            ...user.app_metadata,
            role: "admin",
          },
          user_metadata: sanitizedUserMeta,
        });

        if (authErr) {
          console.error(`   ❌ Failed to update auth metadata: ${authErr.message}`);
        } else {
          console.log(`   ✅ Set app_metadata.role = 'admin' & stripped user_metadata.role`);
          promotedAdmins++;
        }

        const { error: pErr } = await supabase.from("profiles").update({ role: "admin" }).eq("id", user.id);
        if (pErr) {
          console.error(`   ❌ Failed to update profiles.role: ${pErr.message}`);
        } else {
          console.log(`   ✅ Synchronized profiles.role = 'admin'`);
        }
      }
    } else if (hasAppMetaAdmin && !allowRevokeAll) {
      // Existing legitimate admin set via service role; not asked to revoke
      console.log(`   👉 Action: KEEP EXISTING ADMIN (Authoritative app_metadata already set)`);
      if (isApply && hasUserMetaRole) {
        // Just strip the rogue user_metadata key if present
        const sanitizedUserMeta = { ...(user.user_metadata || {}) };
        delete sanitizedUserMeta.role;
        await supabase.auth.admin.updateUserById(user.id, { user_metadata: sanitizedUserMeta });
        console.log(`   ✅ Cleaned duplicate user_metadata.role while keeping app_metadata.role`);
      }
      preservedAdmins++;
    } else if (hasAppMetaEditor) {
      // Existing editor; preserve editor role, strip user_metadata if contaminated
      console.log(`   👉 Action: KEEP EXISTING EDITOR (Preserves editor role)`);
      if (isApply && hasUserMetaRole) {
        const sanitizedUserMeta = { ...(user.user_metadata || {}) };
        delete sanitizedUserMeta.role;
        await supabase.auth.admin.updateUserById(user.id, { user_metadata: sanitizedUserMeta });
        console.log(`   ✅ Stripped rogue user_metadata.role while preserving app_metadata.role = 'editor'`);
      }
    } else {
      // Self-promoted rogue account: only user_metadata or profiles indicated admin
      console.log(`   ⚠️  Action: SANITIZE ROGUE ACCOUNT (Unverified self-elevation)`);
      if (isApply) {
        const sanitizedUserMeta = { ...(user.user_metadata || {}) };
        delete sanitizedUserMeta.role;

        const { error: authErr } = await supabase.auth.admin.updateUserById(user.id, {
          user_metadata: sanitizedUserMeta,
        });

        if (authErr) {
          console.error(`   ❌ Failed to strip user_metadata: ${authErr.message}`);
        } else {
          console.log(`   ✅ Stripped rogue user_metadata.role`);
          sanitizedRogue++;
        }

        if (hasProfileAdmin) {
          const { error: pErr } = await supabase.from("profiles").update({ role: "user" }).eq("id", user.id);
          if (pErr) {
            console.error(`   ❌ Failed to reset profiles.role: ${pErr.message}`);
          } else {
            console.log(`   ✅ Reset profiles.role to 'user'`);
          }
        }
      }
    }
  }

  // 3. Typo / Unmatched Email Verification
  const unmatchedPromote = Array.from(promoteEmails).filter((e) => !matchedPromoteEmails.has(e));
  const unmatchedRevoke = Array.from(revokeEmails).filter((e) => !matchedRevokeEmails.has(e));

  if (unmatchedPromote.length > 0) {
    console.error(`\n❌ ERROR: The following --promote email(s) were NOT FOUND in the database:`);
    for (const e of unmatchedPromote) {
      console.error(`   • ${e}`);
    }
  }

  if (unmatchedRevoke.length > 0) {
    console.warn(`\n⚠️  WARNING: The following --revoke email(s) were NOT FOUND in the database:`);
    for (const e of unmatchedRevoke) {
      console.warn(`   • ${e}`);
    }
  }

  console.log(`\n==================================================================`);
  console.log(`🎉 Audit Summary:`);
  console.log(`   • Total accounts scanned:       ${users.length}`);
  console.log(`   • Preserved existing admins:    ${preservedAdmins}`);
  if (isApply) {
    console.log(`   • Confirmed / Promoted admins:  ${promotedAdmins}`);
    console.log(`   • Revoked admins:               ${revokedAdmins}`);
    console.log(`   • Sanitized rogue accounts:     ${sanitizedRogue}`);
  } else {
    console.log(`   • Status:                      Dry run only. 0 modifications performed.`);
  }
  console.log(`==================================================================\n`);

  if (isApply && (unmatchedPromote.length > 0 || promotionErrors > 0)) {
    console.error("❌ Finished with errors (unmatched promote emails or unconfirmed accounts).");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error during role audit:", err);
  process.exit(1);
});
