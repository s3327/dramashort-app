import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase-user";

import { isPlaceholderUrl, isPlaceholderKey } from "@/lib/config/env-validator.mjs";

function getUserClientCredentials() {
  const isProduction = process.env.NODE_ENV === "production";
  const url = process.env.NEXT_PUBLIC_USER_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_USER_SUPABASE_ANON_KEY;

  if (isProduction) {
    if (!url || isPlaceholderUrl(url)) {
      throw new Error(`Invalid or missing NEXT_PUBLIC_USER_SUPABASE_URL in production: "${url}"`);
    }
    if (!anonKey || isPlaceholderKey(anonKey)) {
      throw new Error("Invalid or placeholder NEXT_PUBLIC_USER_SUPABASE_ANON_KEY in production.");
    }
  }

  return {
    url: url || "http://127.0.0.1:54322",
    anonKey: anonKey || "dev-anon-key",
  };
}

const { url: userUrl, anonKey: userAnonKey } = getUserClientCredentials();

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
