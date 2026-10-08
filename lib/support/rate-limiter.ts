/**
 * Support Ticket Rate Limiting Facade (Refactored in Task 13.6)
 *
 * Delegates to the shared scalable rate limiter (lib/security/rate-limiter.ts)
 * using the pre-configured 'support' profile (5 requests / hour / IP).
 */

import { checkRateLimit, resetRateLimits } from "@/lib/security/rate-limiter";

/**
 * Reset helper for test suites to ensure isolated test runs.
 */
export function _resetSupportRateLimits() {
  resetRateLimits();
}

/**
 * Check and advance the sliding window rate limit for support submissions.
 */
export function checkSupportRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const result = checkRateLimit(key, "support");
  return {
    allowed: result.allowed,
    retryAfterSeconds: result.retryAfterSeconds,
  };
}
