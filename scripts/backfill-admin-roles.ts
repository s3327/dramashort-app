/**
 * Admin Role Audit & Sanitization Utility (Task 10.1)
 *
 * Scans Supabase User Database for admin accounts and self-elevated accounts.
 *
 * Safety & Security Rules:
 *   1. DEFAULT is DRY RUN. No modifications are applied unless --apply is explicitly passed.
 *   2. Two-Pass Architecture: All accounts and flags are validated first. If ANY requested
 *      email is missing or unconfirmed, the script aborts BEFORE any mutations take place.
 *   3. Guarded Apply: --apply requires either --promote <emails>, --revoke <emails>, or --revoke-unlisted-admins.
 *   4. Mutual Exclusion: The same email cannot appear in both --promote and --revoke.
 *   5. Unlisted Admin Revocation: --revoke-unlisted-admins explicitly strips app_metadata.role = 'admin'
 *      for accounts not present in --promote. It is refused unless --promote names at least one admin to keep.
 *   6. Verified Identity Gate: Accounts in --promote must have email_confirmed_at populated.
 *   7. Role Preservation: Legitimate existing app_metadata.role ('admin' or 'editor') is preserved by default.
 *   8. Single Batch Query: Queries profiles table once upfront, eliminating N+1 DB calls.
 *   9. Checked Mutations: All Supabase auth and profile updates explicitly verify returned errors.
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
 *
 *   # Promote listed admins and revoke all unlisted admins:
 *   npx tsx scripts/backfill-admin-roles.ts --apply --promote admin@dramashort.com --revoke-unlisted-admins
 */

import { createClient, type User } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const userUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

type PlannedActionType =
  | "PROMOTE"
  | "REVOKE"
  | "REVOKE_UNLISTED"
  | "KEEP_ADMIN"
  | "KEEP_EDITOR"
  | "SANITIZE_ROGUE";

interface PlannedAction {
  user: User;
  userEmail: string;
  type: PlannedActionType;
  hasUserMetaRole: boolean;
  hasAppMetaAdmin: boolean;
  hasAppMetaEditor: boolean;
  hasProfileAdmin: boolean;
}

async function main() {
  const isApply = process.argv.includes("--apply");
  const allowRevokeUnlisted = process.argv.includes("--revoke-unlisted-admins");
  const promoteEmails = parseEmailListFlag("--promote");
  const revokeEmails = parseEmailListFlag("--revoke");

  console.log("==================================================================");
  console.log(`🛡️  Admin Role Audit & Sanitization (${isApply ? "LIVE APPLY" : "DRY RUN - No changes will be made"})`);
  console.log("==================================================================");

  // Safety Gate 1: Check mutual exclusion
  const overlappingEmails = Array.from(promoteEmails).filter((e) => revokeEmails.has(e));
  if (overlappingEmails.length > 0) {
    console.error("❌ CONFLICT ERROR: The following email(s) cannot be in both --promote and --revoke:");
    overlappingEmails.forEach((e) => console.error(`   • ${e}`));
    process.exit(1);
  }

  // Safety Gate 2: Prevent accidental execution without instructions
  if (isApply && promoteEmails.size === 0 && !allowRevokeUnlisted && revokeEmails.size === 0) {
    console.error("❌ SAFETY ERROR: --apply was provided without --promote <emails>, --revoke <emails>, or --revoke-unlisted-admins.");
    console.error("   To prevent accidental admin lockouts, please specify authorized admins: ");
    console.error("   npx tsx scripts/backfill-admin-roles.ts --apply --promote admin@example.com\n");
    process.exit(1);
  }

  // Safety Gate 3: Revoking every unlisted admin without naming a keeper would lock everyone out
  if (allowRevokeUnlisted && promoteEmails.size === 0) {
    console.error("❌ SAFETY ERROR: --revoke-unlisted-admins requires at least one --promote <email> to keep as admin.");
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

  if (allowRevokeUnlisted) {
    console.log("⚠️  Flag active: --revoke-unlisted-admins (unlisted existing admins will have admin role revoked)");
  }

  // 1. Batch query profiles table for admin records (eliminates N+1 lookups)
  console.log("\n📡 Querying profiles table for admin records...");
  // Paged so results beyond PostgREST's default 1,000-row cap are not silently dropped
  const adminProfileUserIds = new Set<string>();
  const profilePageSize = 1000;
  for (let from = 0; ; from += profilePageSize) {
    const { data: adminProfiles, error: profQueryError } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .order("id")
      .range(from, from + profilePageSize - 1);

    if (profQueryError) {
      console.error("❌ Failed to query profiles table:", profQueryError.message);
      process.exit(1);
    }

    (adminProfiles || []).forEach((p) => adminProfileUserIds.add(p.id));
    if (!adminProfiles || adminProfiles.length < profilePageSize) break;
  }

  console.log(`✓ Found ${adminProfileUserIds.size} profile rows with role = 'admin'.`);

  // 2. Fetch all auth users with pagination
  console.log("📡 Fetching all accounts from Supabase Auth...");
  const users = await fetchAllUsers();
  console.log(`✓ Fetched ${users.length} total user accounts.\n`);

  // ==================================================================
  // PASS 1: VALIDATION & ACTION PLANNING (Zero mutations performed)
  // ==================================================================
  console.log("🔍 Pass 1: Validating accounts and computing execution plan...");
  const matchedPromoteEmails = new Set<string>();
  const matchedRevokeEmails = new Set<string>();
  const validationErrors: string[] = [];
  const plannedActions: PlannedAction[] = [];

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

    const isRelevant =
      isPromoteRequested ||
      isRevokeRequested ||
      hasUserMetaRole ||
      hasAppMetaAdmin ||
      hasAppMetaEditor ||
      hasProfileAdmin;

    if (!isRelevant) continue;

    // Validate email confirmation for promote candidates
    if (isPromoteRequested && !user.email_confirmed_at) {
      validationErrors.push(
        `User ${user.email} does not have a confirmed email (email_confirmed_at is null). Unverified emails cannot be promoted.`
      );
    }

    let actionType: PlannedActionType;

    if (isRevokeRequested) {
      actionType = "REVOKE";
    } else if (isPromoteRequested) {
      actionType = "PROMOTE";
    } else if (hasAppMetaAdmin) {
      if (allowRevokeUnlisted) {
        actionType = "REVOKE_UNLISTED";
      } else {
        actionType = "KEEP_ADMIN";
      }
    } else if (hasAppMetaEditor) {
      actionType = "KEEP_EDITOR";
    } else {
      actionType = "SANITIZE_ROGUE";
    }

    plannedActions.push({
      user,
      userEmail,
      type: actionType,
      hasUserMetaRole,
      hasAppMetaAdmin,
      hasAppMetaEditor,
      hasProfileAdmin,
    });
  }

  // Check for unmatched promote/revoke emails
  const unmatchedPromote = Array.from(promoteEmails).filter((e) => !matchedPromoteEmails.has(e));
  const unmatchedRevoke = Array.from(revokeEmails).filter((e) => !matchedRevokeEmails.has(e));

  if (unmatchedPromote.length > 0) {
    for (const e of unmatchedPromote) {
      validationErrors.push(`Requested --promote email not found in database: "${e}"`);
    }
  }

  if (unmatchedRevoke.length > 0) {
    console.warn(`\n⚠️  WARNING: The following --revoke email(s) were not found in the database:`);
    for (const e of unmatchedRevoke) {
      console.warn(`   • ${e}`);
    }
  }

  // If there are validation errors, HALT BEFORE ANY MUTATIONS!
  if (validationErrors.length > 0) {
    console.error(`\n❌ Pass 1 Validation Failed with ${validationErrors.length} error(s):`);
    for (const err of validationErrors) {
      console.error(`   • ${err}`);
    }
    if (isApply) {
      console.error(`\n🛑 Aborting execution. Zero database changes were made.`);
      process.exit(1);
    }
  } else {
    console.log(`✓ Pass 1 completed successfully with 0 validation errors.`);
  }

  // Print planned actions
  console.log(`\n📋 Execution Plan (${plannedActions.length} flagged account(s)):`);
  for (const item of plannedActions) {
    console.log(`------------------------------------------------------------------`);
    console.log(`👤 Account: ${item.user.email} (ID: ${item.user.id})`);
    console.log(`   • app_metadata.role:  ${item.user.app_metadata?.role ?? "(none)"}`);
    console.log(`   • user_metadata.role: ${item.user.user_metadata?.role ?? "(none)"}`);
    console.log(`   • profiles.role:      ${item.hasProfileAdmin ? "admin" : "(not admin)"}`);
    console.log(`   • email_confirmed:    ${item.user.email_confirmed_at ? "yes" : "NO"}`);

    switch (item.type) {
      case "PROMOTE":
        console.log(`   👉 Action: CONFIRM / PROMOTE ADMIN (Explicitly matched in --promote)`);
        break;
      case "REVOKE":
        console.log(`   👉 Action: REVOKE ADMIN (Explicitly matched in --revoke)`);
        break;
      case "REVOKE_UNLISTED":
        console.log(`   👉 Action: REVOKE UNLISTED ADMIN (Not in --promote whitelist; --revoke-unlisted-admins active)`);
        break;
      case "KEEP_ADMIN":
        console.log(`   👉 Action: KEEP EXISTING ADMIN (Authoritative app_metadata already set)`);
        break;
      case "KEEP_EDITOR":
        console.log(`   👉 Action: KEEP EXISTING EDITOR (Preserving editor role; cleaning user_metadata)`);
        break;
      case "SANITIZE_ROGUE":
        console.log(`   ⚠️  Action: SANITIZE ROGUE ACCOUNT (Unverified self-elevation)`);
        break;
    }
  }

  // ==================================================================
  // PASS 2: EXECUTION (Only runs when --apply is specified)
  // ==================================================================
  let preservedCount = 0;
  let promotedCount = 0;
  let revokedCount = 0;
  let sanitizedCount = 0;
  let failureCount = 0;

  const fail = (message: string) => {
    failureCount++;
    console.error(`   ❌ ${message}`);
  };

  if (isApply) {
    console.log(`\n🚀 Pass 2: Executing database updates...`);

    for (const item of plannedActions) {
      const { user } = item;
      const sanitizedUserMeta = { ...(user.user_metadata || {}) };
      delete sanitizedUserMeta.role;

      if (item.type === "PROMOTE") {
        const { error: authErr } = await supabase.auth.admin.updateUserById(user.id, {
          app_metadata: {
            ...user.app_metadata,
            role: "admin",
          },
          user_metadata: sanitizedUserMeta,
        });

        if (authErr) {
          fail(`Failed to update auth metadata for ${user.email}: ${authErr.message}`);
          continue;
        }

        // Upsert profile to ensure record exists and has role = 'admin'
        const { data: upsertData, error: profErr } = await supabase
          .from("profiles")
          .upsert(
            {
              id: user.id,
              role: "admin",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          )
          .select();

        if (profErr || !upsertData || upsertData.length === 0) {
          fail(`Failed to update profile record: ${profErr?.message || "No row returned"}`);
        } else {
          console.log(`   ✅ Promoted ${user.email} -> app_metadata.role = 'admin', profiles.role = 'admin'`);
          promotedCount++;
        }
      } else if (item.type === "REVOKE" || item.type === "REVOKE_UNLISTED") {
        const sanitizedAppMeta = { ...(user.app_metadata || {}) };
        delete sanitizedAppMeta.role;

        const { error: authErr } = await supabase.auth.admin.updateUserById(user.id, {
          app_metadata: sanitizedAppMeta,
          user_metadata: sanitizedUserMeta,
        });

        if (authErr) {
          fail(`Failed to revoke auth metadata for ${user.email}: ${authErr.message}`);
          continue;
        }

        const { error: profErr } = await supabase
          .from("profiles")
          .update({ role: "user" })
          .eq("id", user.id);

        if (profErr) {
          fail(`Failed to reset profile role: ${profErr.message}`);
        } else {
          console.log(`   ✅ Revoked ${user.email} -> stripped app_metadata.role, reset profiles.role = 'user'`);
          revokedCount++;
        }
      } else if (item.type === "KEEP_ADMIN") {
        if (item.hasUserMetaRole) {
          const { error: authErr } = await supabase.auth.admin.updateUserById(user.id, {
            user_metadata: sanitizedUserMeta,
          });
          if (authErr) {
            fail(`Failed to sanitize user_metadata for ${user.email}: ${authErr.message}`);
          } else {
            console.log(`   ✅ Cleaned duplicate user_metadata.role for ${user.email}`);
          }
        }

        if (!item.hasProfileAdmin) {
          const { error: profErr } = await supabase
            .from("profiles")
            .upsert(
              { id: user.id, role: "admin", updated_at: new Date().toISOString() },
              { onConflict: "id" }
            );
          if (profErr) {
            fail(`Failed to mirror profiles.role for ${user.email}: ${profErr.message}`);
          }
        }
        preservedCount++;
      } else if (item.type === "KEEP_EDITOR") {
        if (item.hasUserMetaRole) {
          const { error: authErr } = await supabase.auth.admin.updateUserById(user.id, {
            user_metadata: sanitizedUserMeta,
          });
          if (authErr) {
            fail(`Failed to sanitize user_metadata for ${user.email}: ${authErr.message}`);
          } else {
            console.log(`   ✅ Stripped rogue user_metadata.role for editor ${user.email}`);
          }
        }
      } else if (item.type === "SANITIZE_ROGUE") {
        const failuresBefore = failureCount;
        if (item.hasUserMetaRole) {
          const { error: authErr } = await supabase.auth.admin.updateUserById(user.id, {
            user_metadata: sanitizedUserMeta,
          });
          if (authErr) {
            fail(`Failed to sanitize user_metadata for ${user.email}: ${authErr.message}`);
          } else {
            console.log(`   ✅ Stripped rogue user_metadata.role for ${user.email}`);
          }
        }

        if (item.hasProfileAdmin) {
          const { error: profErr } = await supabase
            .from("profiles")
            .update({ role: "user" })
            .eq("id", user.id);
          if (profErr) {
            fail(`Failed to reset profile role for ${user.email}: ${profErr.message}`);
          } else {
            console.log(`   ✅ Reset profiles.role to 'user' for ${user.email}`);
          }
        }
        if (failureCount === failuresBefore) sanitizedCount++;
      }
    }
  }

  const plannedPromoteCount = plannedActions.filter((a) => a.type === "PROMOTE").length;
  const plannedKeepAdminCount = plannedActions.filter((a) => a.type === "KEEP_ADMIN").length;
  const plannedKeepEditorCount = plannedActions.filter((a) => a.type === "KEEP_EDITOR").length;
  const plannedRevokeCount = plannedActions.filter((a) => a.type === "REVOKE" || a.type === "REVOKE_UNLISTED").length;
  const plannedSanitizeCount = plannedActions.filter((a) => a.type === "SANITIZE_ROGUE").length;

  console.log(`\n==================================================================`);
  console.log(`🎉 Audit Summary:`);
  console.log(`   • Total accounts scanned:       ${users.length}`);
  console.log(`   • Flagged accounts:            ${plannedActions.length}`);
  if (isApply) {
    console.log(`   • Preserved existing admins:    ${preservedCount}`);
    console.log(`   • Confirmed / Promoted admins:  ${promotedCount}`);
    console.log(`   • Revoked admins:               ${revokedCount}`);
    console.log(`   • Sanitized rogue accounts:     ${sanitizedCount}`);
    console.log(`   • Failed updates:               ${failureCount}`);
  } else {
    console.log(`   • Existing admins to keep:      ${plannedKeepAdminCount}`);
    if (plannedKeepEditorCount > 0) {
      console.log(`   • Existing editors to keep:     ${plannedKeepEditorCount}`);
    }
    console.log(`   • Admins to promote:            ${plannedPromoteCount}`);
    console.log(`   • Admins to revoke:             ${plannedRevokeCount}`);
    console.log(`   • Rogue accounts to sanitize:   ${plannedSanitizeCount}`);
    console.log(`   • Status:                      Dry run only. 0 modifications performed.`);
  }
  console.log(`==================================================================\n`);

  if (failureCount > 0) {
    console.error(`❌ Finished with ${failureCount} failed update(s). Re-run to retry; completed changes are not rolled back.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error during role audit:", err);
  process.exit(1);
});
