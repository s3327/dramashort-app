import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getSupabaseCredentials, getServiceRoleKey } from "@/lib/supabase/credentials";

let testContentClient: any = null;

/** Test hook allowing unit tests to inject a mock catalog client. */
export function setTestContentClient(client: any) {
  testContentClient = client;
}

/** Test hook returning the injected mock catalog client. */
export function getTestContentClient() {
  return testContentClient;
}

/**
 * Fresh anon-key client for catalog reads. It never holds a user session: the user clients
 * own sign-in, and in the browser a second client on the default storage key would share
 * their session (ADR-0005: both now target one project).
 */
export function createContentClient(customEnv?: Record<string, string | undefined>): ReturnType<typeof createClient<Database>> {
  const { url, anonKey } = getSupabaseCredentials(customEnv);
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "dramashort-catalog-anon",
    },
  });
}

let defaultClient: ReturnType<typeof createClient<Database>> | null = null;

function getClientInstance() {
  if (!defaultClient) {
    defaultClient = createContentClient();
  }
  return defaultClient;
}

/**
 * Public client for catalog reads (titles, episodes, channels).
 * Safe for use in both Client Components and Server Components.
 */
export const contentClient: ReturnType<typeof createClient<Database>> = new Proxy(
  {} as any,
  {
    get(_target, prop) {
      if (testContentClient) {
        if (prop in testContentClient) {
          const val = testContentClient[prop];
          return typeof val === "function" ? val.bind(testContentClient) : val;
        }
        return undefined;
      }
      const client = getClientInstance();
      const val = Reflect.get(client, prop, client);
      return typeof val === "function" ? val.bind(client) : val;
    },
    has(_target, prop) {
      if (testContentClient) {
        return prop in testContentClient;
      }
      return prop in getClientInstance();
    },
  }
);

type ContentAdminClientFactory = () => any;
let testAdminClientFactory: ContentAdminClientFactory | null = null;

/** Test hook allowing unit tests to inject a mock privileged catalog client. */
export function setTestContentAdminClientFactory(factory: ContentAdminClientFactory | null) {
  testAdminClientFactory = factory;
}

/**
 * Service-role client for catalog writes (admin CMS, seeding).
 * MUST only be invoked from Server Actions, Route Handlers, or backend scripts.
 */
export function getContentAdminClient(customEnv?: Record<string, string | undefined>) {
  if (testAdminClientFactory) {
    return testAdminClientFactory();
  }
  const env = customEnv || process.env;
  const { url } = getSupabaseCredentials(customEnv);
  return createClient<Database>(url, getServiceRoleKey(env), {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;
}
