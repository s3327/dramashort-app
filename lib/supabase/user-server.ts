import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase-user";

import { isPlaceholderUrl, isPlaceholderKey } from "@/lib/config/env-validator.mjs";

export function getUserServerCredentials(customEnv?: Record<string, string | undefined>) {
  const env = customEnv || process.env;
  const isProduction = env.NODE_ENV === "production";
  const url = env.NEXT_PUBLIC_USER_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_USER_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (isProduction) {
    const urlVar = env.NEXT_PUBLIC_USER_SUPABASE_URL ? "NEXT_PUBLIC_USER_SUPABASE_URL" : "NEXT_PUBLIC_SUPABASE_URL";
    const keyVar = env.NEXT_PUBLIC_USER_SUPABASE_ANON_KEY ? "NEXT_PUBLIC_USER_SUPABASE_ANON_KEY" : "NEXT_PUBLIC_SUPABASE_ANON_KEY";

    if (!url || isPlaceholderUrl(url)) {
      throw new Error(`Invalid or missing ${urlVar} in production: "${url}"`);
    }
    if (!anonKey || isPlaceholderKey(anonKey)) {
      throw new Error(`Invalid or placeholder ${keyVar} in production.`);
    }
  }

  return {
    url: url || "http://127.0.0.1:54322",
    anonKey: anonKey || "dev-anon-key",
  };
}

type UserServerClientFactory = () => Promise<any> | any;
let testClientFactory: UserServerClientFactory | null = null;
let testServiceRoleClientFactory: UserServerClientFactory | null = null;

/**
 * Test hook allowing unit tests to inject a mock Supabase server client.
 */
export function setTestUserServerClientFactory(factory: UserServerClientFactory | null) {
  testClientFactory = factory;
}

/**
 * Test hook allowing unit tests to inject a mock service role client.
 */
export function setTestUserServiceRoleClientFactory(factory: UserServerClientFactory | null) {
  testServiceRoleClientFactory = factory;
}

/**
 * Server-side Supabase client for User Data & Auth.
 * Reads and sets cookies for session management in Server Components and Route Handlers.
 */
export async function createUserServerClient(customEnv?: Record<string, string | undefined>) {
  if (testClientFactory) {
    return testClientFactory();
  }
  const { url, anonKey } = getUserServerCredentials(customEnv);
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}

/**
 * Privileged service-role client for User Database operations.
 * Strictly used for server-side administrative actions like auth.admin.deleteUser.
 */
export function createUserServiceRoleClient(customEnv?: Record<string, string | undefined>) {
  if (testServiceRoleClientFactory) {
    return testServiceRoleClientFactory();
  }
  const env = customEnv || process.env;
  const { url } = getUserServerCredentials(env);
  const serviceRoleKey = env.USER_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("Missing USER_SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY) environment variable");
  }
  if (env.NODE_ENV === "production" && isPlaceholderKey(serviceRoleKey)) {
    throw new Error("Placeholder USER_SUPABASE_SERVICE_ROLE_KEY detected in production.");
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
