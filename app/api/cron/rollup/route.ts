import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { runDailyRollupJob } from "@/lib/services/analytics.service";

import { timingSafeEqual } from "node:crypto";

/**
 * Validates request authorization against CRON_SECRET.
 * Security Hardening (Step 8):
 * - Accepts secret ONLY from `Authorization: Bearer <CRON_SECRET>`
 * - Query parameter `?secret=` is strictly disallowed to prevent secret leakage in logs and history
 * - Uses `crypto.timingSafeEqual` on equal-length buffers to eliminate timing side-channel attacks
 * - Permits bypass without secret strictly when `process.env.NODE_ENV === "development"`
 */
function isCronAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // Only permit unauthenticated manual trigger strictly in local development environment
  if (!cronSecret && process.env.NODE_ENV === "development") {
    return true;
  }

  if (!cronSecret || cronSecret.trim().length === 0) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7).trim();
  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(cronSecret);

  if (tokenBuf.length !== secretBuf.length) {
    return false;
  }

  return timingSafeEqual(tokenBuf, secretBuf);
}

/**
 * Common handler for GET and POST cron requests.
 */
async function handleRollup(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return apiError("UNAUTHORIZED", "Unauthorized: invalid or missing cron secret.", 401);
  }

  const url = new URL(request.url);
  const targetDate = url.searchParams.get("date") || undefined;

  // Validate optional date format if provided: YYYY-MM-DD
  if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return apiError(
      "VALIDATION_ERROR",
      "Invalid date format. Expected YYYY-MM-DD.",
      400
    );
  }

  const result = await runDailyRollupJob({ targetDate });

  if (!result.ok) {
    return apiError(
      "DATABASE_ERROR",
      result.error || "Analytics rollup aggregation failed.",
      500,
      result
    );
  }

  return apiSuccess(result);
}

/**
 * GET /api/cron/rollup
 * Vercel Cron invocation entry point (Task 15.3).
 */
export async function GET(request: NextRequest) {
  return handleRollup(request);
}

/**
 * POST /api/cron/rollup
 * Manual trigger and webhook entry point.
 */
export async function POST(request: NextRequest) {
  return handleRollup(request);
}
