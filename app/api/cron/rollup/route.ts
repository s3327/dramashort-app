import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { runDailyRollupJob } from "@/lib/services/analytics.service";

/**
 * Validates request authorization against CRON_SECRET.
 * Supports Bearer token authorization header and query parameter ?secret=...
 */
function isCronAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  // If no secret configured in test/development, permit local manual execution
  if (!cronSecret && process.env.NODE_ENV !== "production") {
    return true;
  }

  if (!cronSecret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token === cronSecret) {
      return true;
    }
  }

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  if (querySecret === cronSecret) {
    return true;
  }

  return false;
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
