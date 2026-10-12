import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";
import { getSupabaseCredentials } from "@/lib/supabase/credentials";

let testUserClient: any = null;

/** Test hook allowing unit tests to inject a mock browser user client. */
export function setTestUserClient(client: any) {
  testUserClient = client;
}

/** Browser-side Supabase client for auth and user data. */
export function createUserClient(customEnv?: Record<string, string | undefined>): ReturnType<typeof createBrowserClient<Database>> {
  if (testUserClient) {
    return testUserClient as ReturnType<typeof createBrowserClient<Database>>;
  }
  const { url, anonKey } = getSupabaseCredentials(customEnv);
  return createBrowserClient<Database>(url, anonKey);
}
