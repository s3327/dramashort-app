/**
 * Admin User Provisioning & Promotion Utility (Task 10.7)
 *
 * Hardened CLI tool to safely create, promote, or revoke administrator and editor accounts.
 *
 * Safety & Security Policies:
 * 1. Explicit email required via --email <email>. No dangerous defaults.
 * 2. High-entropy random password generated automatically on creation unless explicitly passed.
 *    Generated passwords are printed once; user-supplied passwords are NEVER printed to stdout.
 * 3. Existing user credentials are NEVER overwritten unless --reset-password is explicitly passed.
 * 4. Single source of truth: writes app_metadata.role ('admin' or 'editor') and mirrors
 *    it to profiles.role via the service role. Drops any client-forged user_metadata.role.
 * 5. Full pagination: scans all pages of listUsers() to guarantee existing users are found.
 * 6. Production Safety Gate: requires --confirm-production when targeting the production User DB.
 *
 * Usage:
 *   # Create new admin with auto-generated secure password:
 *   npx tsx scripts/create-admin.ts --email staff@dramashort.com
 *
 *   # Promote existing user to editor without modifying their password:
 *   npx tsx scripts/create-admin.ts --email staff@dramashort.com --role editor
 *
 *   # Revoke privileges from an account:
 *   npx tsx scripts/create-admin.ts --email staff@dramashort.com --revoke
 *
 *   # Reset password on an existing admin:
 *   npx tsx scripts/create-admin.ts --email staff@dramashort.com --reset-password
 *
 *   # Run against production:
 *   npx tsx scripts/create-admin.ts --email admin@dramashort.com --confirm-production
 */

import { createClient, type User } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase-user";
import * as crypto from "crypto";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

export type SupabaseUserClient = ReturnType<typeof createClient<Database>>;

export const PRODUCTION_USER_PROJECT_REF = "bpidsbcrvpkavvdvtpgh";

export type AdminRole = "admin" | "editor";

export interface AdminCliOptions {
  email: string;
  role: AdminRole;
  password?: string;
  resetPassword: boolean;
  revoke: boolean;
  confirmProduction: boolean;
  fullName?: string;
}

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isProductionProject(url: string | undefined): boolean {
  if (!url) return false;
  return url.toLowerCase().includes(PRODUCTION_USER_PROJECT_REF.toLowerCase());
}

export function generateSecurePassword(length = 20): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*()-_=+[]{}";
  const all = upper + lower + numbers + special;

  // Ensure at least one character from each set
  const pick = (set: string) => set[crypto.randomInt(0, set.length)];
  const chars: string[] = [pick(upper), pick(lower), pick(numbers), pick(special)];

  while (chars.length < length) {
    chars.push(pick(all));
  }

  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

export function parseAdminCliArgs(args: string[]): AdminCliOptions {
  let email = "";
  let role: AdminRole = "admin";
  let password: string | undefined;
  let resetPassword = false;
  let revoke = false;
  let confirmProduction = false;
  let fullName: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg === "--email" && i + 1 < args.length) {
      email = args[++i].trim();
    } else if (arg.startsWith("--email=")) {
      email = arg.slice("--email=".length).trim();
    } else if (arg === "--role" && i + 1 < args.length) {
      const rawRole = args[++i].trim().toLowerCase();
      if (rawRole !== "admin" && rawRole !== "editor") {
        throw new Error(`Invalid --role "${rawRole}". Role must be "admin" or "editor".`);
      }
      role = rawRole as AdminRole;
    } else if (arg.startsWith("--role=")) {
      const rawRole = arg.slice("--role=".length).trim().toLowerCase();
      if (rawRole !== "admin" && rawRole !== "editor") {
        throw new Error(`Invalid --role "${rawRole}". Role must be "admin" or "editor".`);
      }
      role = rawRole as AdminRole;
    } else if (arg === "--password" && i + 1 < args.length) {
      password = args[++i];
    } else if (arg.startsWith("--password=")) {
      password = arg.slice("--password=".length);
    } else if (arg === "--reset-password") {
      resetPassword = true;
    } else if (arg === "--revoke") {
      revoke = true;
    } else if (arg === "--confirm-production") {
      confirmProduction = true;
    } else if (arg === "--name" && i + 1 < args.length) {
      fullName = args[++i];
    } else if (!arg.startsWith("--") && !email) {
      // Allow positional email for backward compatibility: tsx scripts/create-admin.ts <email>
      email = arg.trim();
    }
  }

  if (!email) {
    throw new Error(
      "Missing required --email argument.\nUsage: npx tsx scripts/create-admin.ts --email <email> [--role admin|editor] [--confirm-production]"
    );
  }

  if (!isValidEmail(email)) {
    throw new Error(`Invalid email address: "${email}".`);
  }

  return {
    email,
    role,
    password,
    resetPassword,
    revoke,
    confirmProduction,
    fullName,
  };
}

function printUsage() {
  console.log(`
Admin User Provisioning & Promotion Utility (Task 10.7)

Options:
  --email <email>            Target user email address (required)
  --role <admin|editor>      Role to assign (default: "admin")
  --password <password>      Specify password for new user or password reset
  --reset-password           Explicit flag required to reset an existing user's password
  --revoke                   Revoke admin/editor privileges from the target account
  --confirm-production       Required when executing against production User DB
  --name <full_name>         Display name for new accounts (default: DramaShort Staff)
  --help, -h                 Show this help message
`);
}

/**
 * Searches all pages of Supabase Auth users to locate the target email.
 */
export async function findUserByEmail(
  supabase: SupabaseUserClient,
  email: string
): Promise<User | null> {
  const target = email.toLowerCase();
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed to query Supabase Auth users: ${error.message}`);
    }

    const users = data?.users || [];
    if (users.length === 0) break;

    const match = users.find((u) => u.email?.trim().toLowerCase() === target);
    if (match) return match;

    if (users.length < perPage) break;
    page++;
  }

  return null;
}

export async function executeAdminProvisioning(
  supabase: SupabaseUserClient,
  options: AdminCliOptions,
  isProduction: boolean
) {
  const { email, role, password, resetPassword, revoke, confirmProduction } = options;

  if (isProduction && !confirmProduction) {
    console.error("\n❌ SAFETY REFUSAL: Target database is the PRODUCTION User DB.");
    console.error("Project ref: " + PRODUCTION_USER_PROJECT_REF);
    console.error("To proceed, you must pass the --confirm-production flag explicitly.\n");
    process.exit(1);
  }

  console.log(`\n==============================================`);
  console.log(`🔐 Admin Provisioning Tool (Task 10.7)`);
  console.log(`📧 Target Email:  ${email}`);
  console.log(`🏷️  Operation:     ${revoke ? "REVOKE PRIVILEGES" : `ASSIGN ROLE (${role.toUpperCase()})`}`);
  console.log(`🌍 Environment:   ${isProduction ? "PRODUCTION ⚠️" : "DEVELOPMENT / LOCAL"}`);
  console.log(`==============================================\n`);

  // 1. Look up existing user across all pages
  console.log("🔍 Searching for existing user account...");
  const existingUser = await findUserByEmail(supabase, email);

  let userId: string;
  let wasGeneratedPassword = false;
  let effectivePassword = "";

  if (existingUser) {
    userId = existingUser.id;
    console.log(`👤 Found existing user account (ID: ${userId})`);

    // Clean client-writable user_metadata.role
    const sanitizedUserMeta = { ...(existingUser.user_metadata || {}) };
    delete sanitizedUserMeta.role;

    if (revoke) {
      console.log(`🔻 Revoking role privileges from ${email}...`);

      const { error: revokeAuthErr } = await supabase.auth.admin.updateUserById(userId, {
        user_metadata: sanitizedUserMeta,
        app_metadata: {
          ...existingUser.app_metadata,
          role: null,
        },
      });

      if (revokeAuthErr) {
        throw new Error(`Failed to revoke user role in Auth: ${revokeAuthErr.message}`);
      }

      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ role: "user", updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (profileErr) {
        console.warn(`⚠️ Warning: Failed to reset profiles.role: ${profileErr.message}`);
      } else {
        console.log(`✅ Synced profiles.role = 'user' in profiles table.`);
      }

      console.log(`\n🎉 Role revoked successfully! ${email} is now a standard user.`);
      return;
    }

    // Role Promotion / Confirmation
    const updates: Parameters<typeof supabase.auth.admin.updateUserById>[1] = {
      email_confirm: true,
      user_metadata: sanitizedUserMeta,
      app_metadata: {
        ...existingUser.app_metadata,
        role,
      },
    };

    if (resetPassword) {
      effectivePassword = password || generateSecurePassword(20);
      wasGeneratedPassword = !password;
      updates.password = effectivePassword;
      console.log("🔑 Resetting existing user password (requested via --reset-password)...");
    } else if (password) {
      console.log("ℹ️  Password provided on existing user ignored. Pass --reset-password to overwrite password.");
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, updates);
    if (updateError) {
      throw new Error(`Failed to update Auth user: ${updateError.message}`);
    }

    console.log(`✅ Assigned app_metadata.role = '${role}' in Supabase Auth.`);
  } else {
    // New User Creation
    if (revoke) {
      console.log(`ℹ️ User ${email} does not exist. Nothing to revoke.`);
      return;
    }

    console.log(`✨ Creating new user in Supabase Auth...`);
    effectivePassword = password || generateSecurePassword(20);
    wasGeneratedPassword = !password;

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: effectivePassword,
      email_confirm: true,
      user_metadata: {
        full_name: options.fullName || "DramaShort Staff",
      },
      app_metadata: {
        role,
      },
    });

    if (createError || !newUser?.user) {
      throw new Error(`Failed to create Auth user: ${createError?.message}`);
    }

    userId = newUser.user.id;
    console.log(`✅ Created user (ID: ${userId}) with app_metadata.role = '${role}'.`);
  }

  // 2. Sync to profiles table via service role
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      display_name: options.fullName || "DramaShort Administrator",
      role,
      updated_at: new Date().toISOString(),
    });

  if (profileError) {
    console.warn(`⚠️ Warning syncing to profiles table: ${profileError.message}`);
  } else {
    console.log(`✅ Confirmed profiles.role = '${role}' in profiles table.`);
  }

  console.log("\n==============================================");
  console.log("🎉 Account provisioning complete!");
  console.log(`📧 Email:    ${email}`);
  console.log(`🏷️  Role:     ${role.toUpperCase()}`);
  if (wasGeneratedPassword) {
    console.log(`🔑 Generated Password: ${effectivePassword}`);
    console.log("⚠️  Save this password securely. It will not be shown again.");
  } else if (effectivePassword) {
    console.log("🔑 Password: [Custom password configured]");
  } else {
    console.log("🔑 Password: [Existing password preserved]");
  }
  console.log("==============================================\n");
}

async function main() {
  const userUrl = process.env.NEXT_PUBLIC_USER_SUPABASE_URL;
  const serviceKey = process.env.USER_SUPABASE_SERVICE_ROLE_KEY;

  if (!userUrl || !serviceKey) {
    console.error("❌ Missing User Supabase environment variables in .env.local");
    process.exit(1);
  }

  const supabase = createClient<Database>(userUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const options = parseAdminCliArgs(process.argv.slice(2));
  const isProduction = isProductionProject(userUrl);

  await executeAdminProvisioning(supabase, options, isProduction);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("\n❌ Fatal error:", err.message || err);
    process.exit(1);
  });
}
