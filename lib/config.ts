/**
 * Application feature flags and configuration settings.
 */

/**
 * Determines whether services and components should fall back to mock data
 * when the database is unreachable or returns an error.
 *
 * In production, this MUST remain false so that database outages, network drops,
 * or misconfigured environment variables do not silently serve fake content to users.
 * Set NEXT_PUBLIC_ENABLE_MOCK_FALLBACK="true" in .env.local strictly for offline local development.
 */
export const ENABLE_MOCK_FALLBACK: boolean =
  process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === "true";
