/**
 * Shared Scalable Rate Limiter (Task 13.6)
 *
 * Sliding-window in-memory rate limiter supporting IP and user keys,
 * custom windows, request thresholds, and RFC-standard rate limit headers:
 * - X-RateLimit-Limit
 * - X-RateLimit-Remaining
 * - X-RateLimit-Reset
 * - Retry-After
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError, type ApiErrorCode } from "@/lib/api/responses";

export interface RateLimitPolicy {
  maxRequests: number;
  windowMs: number;
}

export const RATE_LIMIT_POLICIES = {
  support: { maxRequests: 5, windowMs: 60 * 60 * 1000 },  // 5 req / hour
  progress: { maxRequests: 60, windowMs: 60 * 1000 },     // 60 req / min
  playback: { maxRequests: 30, windowMs: 60 * 1000 },     // 30 req / min
  auth: { maxRequests: 10, windowMs: 60 * 1000 },         // 10 req / min
  events: { maxRequests: 120, windowMs: 60 * 1000 },       // 120 req / min (Task 15.1)
  checkout: { maxRequests: 10, windowMs: 5 * 60 * 1000 },  // 10 req / 5 min per user/IP (P1 Step 9)
  webhook: { maxRequests: 60, windowMs: 60 * 1000 },      // 60 req / min per provider/IP
  generalApi: { maxRequests: 120, windowMs: 60 * 1000 },  // 120 req / min
} as const;

export type RateLimitProfile = keyof typeof RATE_LIMIT_POLICIES;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // epoch ms
  resetSeconds: number; // epoch seconds for X-RateLimit-Reset header
  retryAfterSeconds: number;
}

export class SlidingWindowRateLimiter {
  private store = new Map<string, number[]>();
  private lastPruneTime = 0;

  private maybePrune(now: number): void {
    if (this.store.size > 2000 && now - this.lastPruneTime > 60 * 1000) {
      this.lastPruneTime = now;
      for (const [k, timestamps] of this.store.entries()) {
        const hasRecent = timestamps.some((t) => t > now - 2 * 60 * 60 * 1000);
        if (!hasRecent) {
          this.store.delete(k);
        }
      }
    }
  }

  public check(
    key: string,
    policyOrProfile: RateLimitPolicy | RateLimitProfile,
    customNow?: number
  ): RateLimitResult {
    const policy: RateLimitPolicy =
      typeof policyOrProfile === "string"
        ? (RATE_LIMIT_POLICIES[policyOrProfile as RateLimitProfile] ?? RATE_LIMIT_POLICIES.generalApi)
        : (policyOrProfile ?? RATE_LIMIT_POLICIES.generalApi);

    const profileName = typeof policyOrProfile === "string" ? policyOrProfile : "custom";
    const bucketKey = `${profileName}:${key}`;
    const now = customNow ?? Date.now();
    this.maybePrune(now);

    const windowStart = now - policy.windowMs;

    const existing = this.store.get(bucketKey) || [];
    const timestamps = existing.filter((t) => t > windowStart);

    if (policy.maxRequests > 0 && timestamps.length < policy.maxRequests) {
      timestamps.push(now);
      this.store.set(bucketKey, timestamps);
      const remaining = Math.max(0, policy.maxRequests - timestamps.length);
      const oldest = timestamps[0] ?? now;
      const resetAt = oldest + policy.windowMs;
      const resetSeconds = Math.ceil(resetAt / 1000);

      return {
        allowed: true,
        limit: policy.maxRequests,
        remaining,
        resetAt,
        resetSeconds,
        retryAfterSeconds: 0,
      };
    }

    // Limit reached or exceeded
    this.store.set(bucketKey, timestamps);
    const oldest = timestamps.length > 0 ? timestamps[0] : now;
    const resetAt = oldest + policy.windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
    const resetSeconds = Math.ceil(resetAt / 1000);

    return {
      allowed: false,
      limit: Math.max(0, policy.maxRequests),
      remaining: 0,
      resetAt,
      resetSeconds,
      retryAfterSeconds,
    };
  }

  public resetKey(key: string, profile?: RateLimitProfile): void {
    if (profile) {
      this.store.delete(`${profile}:${key}`);
    } else {
      for (const k of Array.from(this.store.keys())) {
        const colonIdx = k.indexOf(":");
        const storedKey = colonIdx >= 0 ? k.slice(colonIdx + 1) : k;
        if (storedKey === key) {
          this.store.delete(k);
        }
      }
    }
  }

  public reset(): void {
    this.store.clear();
  }
}

// Global shared singleton
export const sharedRateLimiter = new SlidingWindowRateLimiter();

/**
 * Checks rate limit against shared in-memory limiter.
 */
export function checkRateLimit(
  key: string,
  policyOrProfile: RateLimitPolicy | RateLimitProfile,
  customNow?: number
): RateLimitResult {
  return sharedRateLimiter.check(key, policyOrProfile, customNow);
}

/**
 * Resets shared rate limits (useful in unit testing).
 */
export function resetRateLimits(): void {
  sharedRateLimiter.reset();
}

function isValidIpFormat(ip: string): boolean {
  if (!ip || typeof ip !== "string") return false;
  const trimmed = ip.trim();
  // Valid IPv4 or IPv6
  const ipv4 = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
  const ipv6 = /^[0-9a-fA-F:]+$/;
  return ipv4.test(trimmed) || ipv6.test(trimmed);
}

/**
 * Extracts verified client IP address.
 * Security Hardening (Step 9):
 * Prioritizes non-spoofed edge-proxy headers (`x-real-ip`, `cf-connecting-ip`, `x-vercel-forwarded-for`)
 * over easily spoofable raw client `x-forwarded-for` prefixes.
 */
export function getClientIp(req: NextRequest | Request): string {
  // 1. Edge-set headers that reverse proxies overwrite with verified client connection IP
  const realIp = req.headers.get("x-real-ip");
  if (realIp && isValidIpFormat(realIp)) {
    return realIp.trim();
  }

  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp && isValidIpFormat(cfIp)) {
    return cfIp.trim();
  }

  const vercelIp = req.headers.get("x-vercel-forwarded-for");
  if (vercelIp && isValidIpFormat(vercelIp)) {
    return vercelIp.trim();
  }

  // 2. Parsed x-forwarded-for fallback
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      if (isValidIpFormat(part)) {
        return part;
      }
    }
  }

  const nextReqIp = (req as any).ip;
  if (nextReqIp && typeof nextReqIp === "string" && isValidIpFormat(nextReqIp)) {
    return nextReqIp.trim();
  }

  return "127.0.0.1";
}

/**
 * Generates standard rate limit key: `user:${userId}` if authenticated, else `ip:${ip}`.
 */
export function getRateLimitKey(req: NextRequest | Request, userId?: string | null): string {
  if (userId) return `user:${userId}`;
  return `ip:${getClientIp(req)}`;
}

/**
 * Applies standard HTTP rate limiting headers onto a NextResponse.
 */
export function applyRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(result.resetSeconds));
  if (!result.allowed) {
    response.headers.set("Retry-After", String(result.retryAfterSeconds));
  }
  return response;
}

/**
 * Standardized HTTP 429 response formatter returning apiError("RATE_LIMITED", ...).
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  message = "Too many requests. Please try again later.",
  code: ApiErrorCode = "RATE_LIMITED",
  details?: unknown
): NextResponse {
  const errorDetails = details !== undefined ? details : { retryAfter: result.retryAfterSeconds };
  const response = apiError(code, message, 429, errorDetails);
  applyRateLimitHeaders(response, result);
  return response;
}
