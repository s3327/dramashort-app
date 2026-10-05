import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase-content";

const contentUrl =
  process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL || "https://placeholder.supabase.co";
const contentAnonKey =
  process.env.NEXT_PUBLIC_CONTENT_SUPABASE_ANON_KEY || "placeholder-anon-key";

const realContentClient = createClient<Database>(contentUrl, contentAnonKey);

let testContentClient: any = null;

/**
 * Test hook allowing unit tests to inject a mock Content DB client.
 */
export function setTestContentClient(client: any) {
  testContentClient = client;
}

/**
 * Public client for querying Content Database (titles, episodes, channels).
 * Safe for use in both Client Components and Server Components.
 */
export const contentClient: ReturnType<typeof createClient<Database>> = new Proxy(
  realContentClient as any,
  {
    get(target, prop, receiver) {
      if (testContentClient && prop in testContentClient) {
        const val = testContentClient[prop];
        if (typeof val === "function") {
          return val.bind(testContentClient);
        }
        return val;
      }
      const val = Reflect.get(target, prop, receiver);
      if (typeof val === "function") {
        return val.bind(target);
      }
      return val;
    },
  }
);

type ContentAdminClientFactory = () => any;
let testAdminClientFactory: ContentAdminClientFactory | null = null;

/**
 * Test hook allowing unit tests to inject a mock Content DB admin client.
 */
export function setTestContentAdminClientFactory(factory: ContentAdminClientFactory | null) {
  testAdminClientFactory = factory;
}

/**
 * Privileged client for Content Database operations (e.g. Seeding, Admin CMS writes).
 * MUST only be invoked from Server Actions, Route Handlers, or backend scripts.
 */
export function getContentAdminClient() {
  if (testAdminClientFactory) {
    return testAdminClientFactory();
  }
  const serviceKey = process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "CONTENT_SUPABASE_SERVICE_ROLE_KEY is required for privileged content operations."
    );
  }
  return createClient<Database>(contentUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
