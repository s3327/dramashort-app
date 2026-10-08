import { NextRequest } from "next/server";
import { createUserServerClient } from "@/lib/supabase/user-server";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { checkRateLimit, createRateLimitResponse, applyRateLimitHeaders, getClientIp } from "@/lib/security/rate-limiter";
import { reportError } from "@/lib/observability/error-reporter";

export interface WatchProgressPayload {
  titleSlug: string;
  episodeNumber: number;
  progress?: number;
  positionSeconds?: number;
  durationSeconds?: number;
}

/**
 * POST /api/progress
 * Reliable background beacon endpoint for flushing watch progress (Task 12.3).
 * Invoked on visibilitychange (hidden) and pagehide with fetch(..., { keepalive: true }).
 * Rate-limited via shared rate limiter (Task 13.6).
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const ipRateLimit = checkRateLimit(`ip:${ip}`, "progress");
  if (!ipRateLimit.allowed) {
    return createRateLimitResponse(ipRateLimit);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  if (!body || typeof body !== "object") {
    return apiError("VALIDATION_ERROR", "Request body must be an object.", 400);
  }

  const payload = body as Partial<WatchProgressPayload>;

  if (typeof payload.titleSlug !== "string" || !payload.titleSlug.trim()) {
    return apiError("VALIDATION_ERROR", "titleSlug is required.", 400);
  }

  const titleSlug = payload.titleSlug.trim();
  if (titleSlug.length > 200) {
    return apiError("VALIDATION_ERROR", "titleSlug exceeds 200 characters.", 400);
  }

  const ep = Number(payload.episodeNumber);
  if (!Number.isInteger(ep) || ep < 1) {
    return apiError("VALIDATION_ERROR", "episodeNumber must be a positive integer.", 400);
  }

  const posSec = Math.max(0, Math.floor(Number(payload.positionSeconds) || 0));
  const durSec = Math.max(0, Math.floor(Number(payload.durationSeconds) || 0));

  let ratio = Number(payload.progress) || 0;
  if (durSec > 0) {
    ratio = Math.min(1.0, Math.max(0.0, posSec / durSec));
  } else {
    ratio = Math.min(1.0, Math.max(0.0, ratio));
  }

  try {
    const supabase = await createUserServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      // Unauthenticated guest: progress saved to client-side localStorage
      const guestRes = apiSuccess({ saved: false, guest: true });
      applyRateLimitHeaders(guestRes, ipRateLimit);
      return guestRes;
    }

    const userRateLimit = checkRateLimit(`user:${user.id}`, "progress");
    if (!userRateLimit.allowed) {
      return createRateLimitResponse(userRateLimit);
    }

    const { error: upsertErr } = await supabase.from("watch_history").upsert(
      {
        user_id: user.id,
        title_slug: titleSlug,
        episode_number: ep,
        progress: ratio,
        position_seconds: posSec,
        duration_seconds: durSec,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,title_slug" }
    );

    if (upsertErr) {
      console.error("[POST /api/progress] Supabase upsert error:", upsertErr);
      reportError(upsertErr, {
        route: "/api/progress",
        method: "POST",
        userId: user.id,
        requestId: request.headers.get("x-request-id") || undefined,
      });
      return apiError("DATABASE_ERROR", "Failed to persist watch progress.", 500);
    }

    const successRes = apiSuccess({ saved: true });
    applyRateLimitHeaders(successRes, userRateLimit);
    return successRes;
  } catch (err) {
    console.error("[POST /api/progress] Unexpected error:", err);
    reportError(err, {
      route: "/api/progress",
      method: "POST",
      requestId: request.headers.get("x-request-id") || undefined,
    });
    return apiError("INTERNAL_ERROR", "Failed to process progress update.", 500);
  }
}
