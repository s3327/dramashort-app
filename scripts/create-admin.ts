/**
 * Admin User Provisioning & Promotion Utility
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts <email> <password>
 *
 * Examples:
 *   npx tsx scripts/create-admin.ts staff@dramashort.com MySecurePass123!
 *   npx tsx scripts/create-admin.ts admin@dramashort.com Admin123456!
 *
 * If the user already exists in Supabase, this script promotes their role to 'admin'.
 * If the user is new, it creates them with auto-confirmed email and admin privileges.
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const userUrl = process.env.NEXT_PUBLIC_USER_SUPABASE_URL;
const serviceKey = process.env.USER_SUPABASE_SERVICE_ROLE_KEY;

if (!userUrl || !serviceKey) {
  console.error(
    "❌ Missing NEXT_PUBLIC_USER_SUPABASE_URL or USER_SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(userUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const email = process.argv[2] || "admin@dramashort.com";
  const password = process.argv[3] || "Admin123456!";

  console.log(`🔐 Setting up Admin Account for: ${email}`);

  // 1. Check if user already exists
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("❌ Failed to query users:", listError.message);
    process.exit(1);
  }

  const existingUser = listData?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  let userId: string;

  if (existingUser) {
    console.log(`👤 User exists (ID: ${existingUser.id}). Promoting to admin...`);
    userId = existingUser.id;

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: {
        ...existingUser.user_metadata,
        full_name: existingUser.user_metadata?.full_name || "DramaShort Administrator",
      },
      app_metadata: {
        ...existingUser.app_metadata,
        role: "admin",
      },
    });

    if (updateError) {
      console.error("❌ Failed to update user metadata:", updateError.message);
      process.exit(1);
    }
  } else {
    console.log(`✨ Creating new confirmed admin user in Supabase Auth...`);
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "DramaShort Administrator" },
      app_metadata: { role: "admin" },
    });

    if (createError || !newUser?.user) {
      console.error("❌ Failed to create user:", createError?.message);
      process.exit(1);
    }
    userId = newUser.user.id;
  }

  // 2. Ensure profiles table row has role = 'admin'
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      display_name: "DramaShort Administrator",
      role: "admin",
      updated_at: new Date().toISOString(),
    });

  if (profileError) {
    console.warn("⚠️ Warning updating profiles table:", profileError.message);
  } else {
    console.log("✅ Profile record confirmed with role = 'admin' in profiles table.");
  }

  console.log("\n==============================================");
  console.log("🎉 Admin credentials ready!");
  console.log(`👉 Login URL: http://localhost:3000/admin/login`);
  console.log(`📧 Email:    ${email}`);
  console.log(`🔑 Password: ${password}`);
  console.log("==============================================\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
