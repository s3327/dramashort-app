import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase-user";

const userUrl =
  process.env.NEXT_PUBLIC_USER_SUPABASE_URL || "https://placeholder.supabase.co";
const userAnonKey =
  process.env.NEXT_PUBLIC_USER_SUPABASE_ANON_KEY || "placeholder-anon-key";

let testUserClient: any = null;

/**
 * Test hook allowing unit tests to inject a mock browser user client.
 */
export function setTestUserClient(client: any) {
  testUserClient = client;
}

/**
 * Browser-side Supabase client for the User Database (Project 2).
 * Handles user auth state, sessions, and client-side user queries.
 */
export function createUserClient(): ReturnType<typeof createBrowserClient<Database>> {
  if (testUserClient) {
    return testUserClient as ReturnType<typeof createBrowserClient<Database>>;
  }
  return createBrowserClient<Database>(userUrl, userAnonKey);
}
