import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase-user";

import { isPlaceholderUrl, isPlaceholderKey } from "@/lib/config/env-validator.mjs";

export function getUserClientCredentials(customEnv?: Record<string, string | undefined>) {
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

let testUserClient: any = null;

/**
 * Test hook allowing unit tests to inject a mock browser user client.
 */
export function setTestUserClient(client: any) {
  testUserClient = client;
}

/**
 * Browser-side Supabase client for User Data & Auth.
 * Connects to unified project or User Database (Project 2).
 * Handles user auth state, sessions, and client-side user queries.
 */
export function createUserClient(customEnv?: Record<string, string | undefined>): ReturnType<typeof createBrowserClient<Database>> {
  if (testUserClient) {
    return testUserClient as ReturnType<typeof createBrowserClient<Database>>;
  }
  const { url, anonKey } = getUserClientCredentials(customEnv);
  return createBrowserClient<Database>(url, anonKey);
}
