import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase-user";

const userUrl =
  process.env.NEXT_PUBLIC_USER_SUPABASE_URL || "https://placeholder.supabase.co";
const userAnonKey =
  process.env.NEXT_PUBLIC_USER_SUPABASE_ANON_KEY || "placeholder-anon-key";

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
 * Server-side Supabase client for the User Database (Project 2).
 * Reads and sets cookies for session management in Server Components and Route Handlers.
 */
export async function createUserServerClient() {
  if (testClientFactory) {
    return testClientFactory();
  }
  const cookieStore = await cookies();

  return createServerClient<Database>(userUrl, userAnonKey, {
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
 * Privileged service-role client for the User Database (Project 2).
 * Strictly used for server-side administrative actions like auth.admin.deleteUser.
 */
export function createUserServiceRoleClient() {
  if (testServiceRoleClientFactory) {
    return testServiceRoleClientFactory();
  }
  const serviceRoleKey = process.env.USER_SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Missing USER_SUPABASE_SERVICE_ROLE_KEY environment variable");
  }
  return createClient<Database>(userUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
