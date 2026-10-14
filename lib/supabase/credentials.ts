import { isPlaceholderUrl, isPlaceholderKey } from "@/lib/config/env-validator.mjs";

type Env = Record<string, string | undefined>;

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_ANON_KEY = "dev-anon-key";

// Literal process.env expressions: Next.js inlines only these into browser bundles.
// Reading them through a variable leaves the browser with undefined values.
function publicEnv(): Env {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NODE_ENV: process.env.NODE_ENV,
  };
}

/** URL and anon key of the single Supabase project (ADR-0005). */
export function getSupabaseCredentials(env: Env = publicEnv()): { url: string; anonKey: string } {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (env.NODE_ENV === "production") {
    if (!url || isPlaceholderUrl(url)) {
      throw new Error(`Invalid or missing NEXT_PUBLIC_SUPABASE_URL in production: "${url ?? ""}"`);
    }
    if (!anonKey || isPlaceholderKey(anonKey)) {
      throw new Error("Invalid or placeholder NEXT_PUBLIC_SUPABASE_ANON_KEY in production.");
    }
  }

  return { url: url || LOCAL_URL, anonKey: anonKey || LOCAL_ANON_KEY };
}

/** Service role key of the single project. Server-only callers. */
export function getServiceRoleKey(env: Env = process.env): string {
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
  }
  if (env.NODE_ENV === "production" && isPlaceholderKey(key)) {
    throw new Error("Placeholder SUPABASE_SERVICE_ROLE_KEY detected in production.");
  }
  return key;
}
