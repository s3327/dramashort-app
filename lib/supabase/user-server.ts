import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase-user";

import { getSupabaseCredentials, getServiceRoleKey } from "@/lib/supabase/credentials";

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
  const { url, anonKey } = getSupabaseCredentials(customEnv);
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
  const { url } = getSupabaseCredentials(customEnv);
  return createClient<Database>(url, getServiceRoleKey(env), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
