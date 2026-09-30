import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase-user";

const userUrl =
  process.env.NEXT_PUBLIC_USER_SUPABASE_URL || "https://placeholder.supabase.co";
const userAnonKey =
  process.env.NEXT_PUBLIC_USER_SUPABASE_ANON_KEY || "placeholder-anon-key";

/**
 * Browser-side Supabase client for the User Database (Project 2).
 * Handles user auth state, sessions, and client-side user queries.
 */
export function createUserClient() {
  return createBrowserClient<Database>(userUrl, userAnonKey);
}
