/**
 * Typed environment variable configuration and validation for DramaShort.
 * Ensures placeholder or missing Supabase credentials fail fast in production.
 */

import {
  validateEnvironment,
  isPlaceholderUrl,
  isPlaceholderKey,
  isValidHttpUrl,
} from "./config/env-validator.mjs";
import { ENABLE_MOCK_FALLBACK } from "./config";

export interface EnvConfig {
  NEXT_PUBLIC_CONTENT_SUPABASE_URL: string;
  NEXT_PUBLIC_CONTENT_SUPABASE_ANON_KEY: string;
  CONTENT_SUPABASE_SERVICE_ROLE_KEY?: string;
  NEXT_PUBLIC_USER_SUPABASE_URL: string;
  NEXT_PUBLIC_USER_SUPABASE_ANON_KEY: string;
  USER_SUPABASE_SERVICE_ROLE_KEY?: string;
  PAYMENT_WEBHOOK_SECRET?: string;
  CRON_SECRET?: string;
  PLAYBACK_SIGNING_SECRET?: string;
  PREVIEW_SECRET?: string;
  REQUIRE_SIGNED_PLAYBACK: boolean;
  ENABLE_SIMULATED_CHECKOUT: boolean;
  ENABLE_MOCK_FALLBACK: boolean;
}

export { isPlaceholderUrl, isPlaceholderKey, isValidHttpUrl, validateEnvironment };

/**
 * Returns validated environment variables.
 * In production, throws immediately if credentials are missing or placeholders.
 */
export function getEnv(): EnvConfig {
  const isProduction = process.env.NODE_ENV === "production";
  const validation = validateEnvironment(process.env, { throws: isProduction });

  if (!validation.valid && isProduction) {
    throw new Error(
      `Cannot initialize application: Environment validation failed:\n${validation.errors.join(
        "\n"
      )}`
    );
  }

  return {
    NEXT_PUBLIC_CONTENT_SUPABASE_URL:
      process.env.NEXT_PUBLIC_CONTENT_SUPABASE_URL || "",
    NEXT_PUBLIC_CONTENT_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_CONTENT_SUPABASE_ANON_KEY || "",
    CONTENT_SUPABASE_SERVICE_ROLE_KEY:
      process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_CONTENT_SERVICE_ROLE_KEY ||
      undefined,
    NEXT_PUBLIC_USER_SUPABASE_URL:
      process.env.NEXT_PUBLIC_USER_SUPABASE_URL || "",
    NEXT_PUBLIC_USER_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_USER_SUPABASE_ANON_KEY || "",
    USER_SUPABASE_SERVICE_ROLE_KEY:
      process.env.USER_SUPABASE_SERVICE_ROLE_KEY || undefined,
    PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET || undefined,
    CRON_SECRET: process.env.CRON_SECRET || undefined,
    PLAYBACK_SIGNING_SECRET: process.env.PLAYBACK_SIGNING_SECRET || undefined,
    PREVIEW_SECRET: process.env.PREVIEW_SECRET || undefined,
    REQUIRE_SIGNED_PLAYBACK: process.env.REQUIRE_SIGNED_PLAYBACK === "true",
    ENABLE_SIMULATED_CHECKOUT: process.env.ENABLE_SIMULATED_CHECKOUT === "true",
    ENABLE_MOCK_FALLBACK,
  };
}
