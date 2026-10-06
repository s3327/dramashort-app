import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase-content";

import { isPlaceholderUrl, isPlaceholderKey } from "@/lib/config/env-validator.mjs";

export type TopologyMode = "unified" | "dual";

/**
 * Detects whether the current environment operates in unified single-project mode
 * (querying the 'content' schema) or legacy dual-database mode ('public' schema).
 */
export function isUnifiedContentMode(env: Record<string, string | undefined> = process.env): boolean {
  if (env.SUPABASE_DATABASE_TOPOLOGY === "unified" || env.NEXT_PUBLIC_SUPABASE_TOPOLOGY === "unified") {
    return true;
  }
  if (env.SUPABASE_DATABASE_TOPOLOGY === "dual" || env.SUPABASE_DATABASE_TOPOLOGY === "split") {
    return false;
  }
  // If unified URL is explicitly provided
  if (env.NEXT_PUBLIC_SUPABASE_URL) {
    return true;
  }
  // If content URL matches user URL, it is a unified project
  if (
    env.NEXT_PUBLIC_CONTENT_SUPABASE_URL &&
    env.NEXT_PUBLIC_USER_SUPABASE_URL &&
    env.NEXT_PUBLIC_CONTENT_SUPABASE_URL.trim() === env.NEXT_PUBLIC_USER_SUPABASE_URL.trim()
  ) {
    return true;
  }
  // If content URL is omitted but user URL exists, default to unified
  if (!env.NEXT_PUBLIC_CONTENT_SUPABASE_URL && env.NEXT_PUBLIC_USER_SUPABASE_URL) {
    return true;
  }
  // Default to legacy dual-database mode for backward compatibility
  return false;
}

/**
 * Returns the target schema name ('content' for unified mode, 'public' for legacy dual mode).
 */
export function getContentSchemaName(env: Record<string, string | undefined> = process.env): "content" | "public" {
  return isUnifiedContentMode(env) ? "content" : "public";
}

/**
 * Resolves Supabase credentials and schema according to the active topology mode.
 */
export function getContentCredentials(env: Record<string, string | undefined> = process.env) {
  const isProduction = env.NODE_ENV === "production";
  const unified = isUnifiedContentMode(env);

  let url: string | undefined;
  let anonKey: string | undefined;

  if (unified) {
    url =
      env.NEXT_PUBLIC_SUPABASE_URL ||
      env.NEXT_PUBLIC_USER_SUPABASE_URL ||
      env.NEXT_PUBLIC_CONTENT_SUPABASE_URL;
    anonKey =
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      env.NEXT_PUBLIC_USER_SUPABASE_ANON_KEY ||
      env.NEXT_PUBLIC_CONTENT_SUPABASE_ANON_KEY;
  } else {
    url = env.NEXT_PUBLIC_CONTENT_SUPABASE_URL;
    anonKey = env.NEXT_PUBLIC_CONTENT_SUPABASE_ANON_KEY;
  }

  if (isProduction) {
    const varNameUrl = unified && !env.NEXT_PUBLIC_CONTENT_SUPABASE_URL
      ? (env.NEXT_PUBLIC_SUPABASE_URL ? "NEXT_PUBLIC_SUPABASE_URL" : "NEXT_PUBLIC_USER_SUPABASE_URL")
      : "NEXT_PUBLIC_CONTENT_SUPABASE_URL";
    const varNameKey = unified && !env.NEXT_PUBLIC_CONTENT_SUPABASE_ANON_KEY
      ? (env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : "NEXT_PUBLIC_USER_SUPABASE_ANON_KEY")
      : "NEXT_PUBLIC_CONTENT_SUPABASE_ANON_KEY";

    if (!url || isPlaceholderUrl(url)) {
      throw new Error(`Invalid or missing ${varNameUrl} in production: "${url}"`);
    }
    if (!anonKey || isPlaceholderKey(anonKey)) {
      throw new Error(`Invalid or placeholder ${varNameKey} in production.`);
    }
  }

  return {
    url: url || "http://127.0.0.1:54321",
    anonKey: anonKey || "dev-anon-key",
    schema: unified ? ("content" as const) : ("public" as const),
    isUnified: unified,
  };
}

let testContentClient: any = null;

/**
 * Test hook allowing unit tests to inject a mock Content DB client.
 */
export function setTestContentClient(client: any) {
  testContentClient = client;
}

/**
 * Factory creating a fresh Supabase client configured for the content schema or dual fallback.
 */
export function createContentClient(customEnv?: Record<string, string | undefined>): ReturnType<typeof createClient<Database>> {
  const env = customEnv || process.env;
  const creds = getContentCredentials(env);

  return createClient<Database>(creds.url, creds.anonKey, {
    db: {
      schema: creds.schema as any,
    },
  }) as any;
}

let defaultClient: ReturnType<typeof createClient<Database>> | null = null;

function getClientInstance() {
  if (!defaultClient) {
    defaultClient = createContentClient();
  }
  return defaultClient;
}

/**
 * Resets the cached content client instance (useful during unit tests when switching modes).
 */
export function resetContentClient() {
  defaultClient = null;
}

/**
 * Public client for querying Content Database (titles, episodes, channels).
 * Automatically queries 'content' schema in unified mode, or 'public' in dual mode.
 * Safe for use in both Client Components and Server Components.
 */
export const contentClient: ReturnType<typeof createClient<Database>> = new Proxy(
  {} as any,
  {
    get(_target, prop, receiver) {
      if (testContentClient && prop in testContentClient) {
        const val = testContentClient[prop];
        if (typeof val === "function") {
          return val.bind(testContentClient);
        }
        return val;
      }
      const client = getClientInstance();
      const val = Reflect.get(client, prop, client);
      if (typeof val === "function") {
        return val.bind(client);
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
 * Operates in 'content' schema in unified mode, or 'public' in dual mode.
 * MUST only be invoked from Server Actions, Route Handlers, or backend scripts.
 */
export function getContentAdminClient(customEnv?: Record<string, string | undefined>) {
  if (testAdminClientFactory) {
    return testAdminClientFactory();
  }

  const env = customEnv || process.env;
  const creds = getContentCredentials(env);
  const isProduction = env.NODE_ENV === "production";

  let serviceKey: string | undefined;
  if (creds.isUnified) {
    serviceKey =
      env.SUPABASE_SERVICE_ROLE_KEY ||
      env.USER_SUPABASE_SERVICE_ROLE_KEY ||
      env.CONTENT_SUPABASE_SERVICE_ROLE_KEY ||
      env.SUPABASE_CONTENT_SERVICE_ROLE_KEY;
  } else {
    serviceKey =
      env.CONTENT_SUPABASE_SERVICE_ROLE_KEY ||
      env.SUPABASE_CONTENT_SERVICE_ROLE_KEY;
  }

  if (!serviceKey) {
    throw new Error(
      creds.isUnified
        ? "SUPABASE_SERVICE_ROLE_KEY (or USER/CONTENT service role key) is required for privileged operations."
        : "CONTENT_SUPABASE_SERVICE_ROLE_KEY is required for privileged content operations."
    );
  }

  if (isProduction && isPlaceholderKey(serviceKey)) {
    throw new Error("Placeholder service role key detected in production.");
  }

  return createClient<Database>(creds.url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: creds.schema as any,
    },
  }) as any;
}
