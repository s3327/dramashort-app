import { NextRequest } from "next/server";
import { createUserServerClient } from "@/lib/supabase/user-server";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { isUuid } from "@/lib/validation/drama";
import {
  getEpisodePlaybackInfo,
  canAccessEpisode,
  resolvePlaybackSession,
} from "@/lib/server/playback";
import { checkRateLimit, createRateLimitResponse, applyRateLimitHeaders, getClientIp } from "@/lib/security/rate-limiter";
import { reportError } from "@/lib/observability/error-reporter";

/**
 * GET /api/playback/[episodeId]
 * 
 * Secure server-gated playback endpoint (Task 10.6).
 * Verifies that the episode exists, parent title is Published (or caller is admin/editor),
 * determines access entitlement via canAccessEpisode(), and returns a signed streaming URL
 * with expiration metadata.
 * Rate-limited via shared rate limiter (Task 13.6).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const ip = getClientIp(_request);
  const ipRateLimit = checkRateLimit(`ip:${ip}`, "playback");
  if (!ipRateLimit.allowed) {
    return createRateLimitResponse(ipRateLimit);
  }

  const { episodeId } = await params;

  if (!isUuid(episodeId)) {
    return apiError("INVALID_ID", "Episode ID must be a valid UUID.", 400);
  }

  let currentUser: any = null;
  try {
    // 1. Resolve current user session (optional; guests are supported for free episodes)
    try {
      const userSupabase = await createUserServerClient();
      const {
        data: { user },
      } = await userSupabase.auth.getUser();
      currentUser = user;
    } catch {
      // Guest or session read error; proceed as guest
      currentUser = null;
    }

    let userRateLimit: ReturnType<typeof checkRateLimit> | null = null;
    if (currentUser) {
      userRateLimit = checkRateLimit(`user:${currentUser.id}`, "playback");
      if (!userRateLimit.allowed) {
        return createRateLimitResponse(userRateLimit);
      }
    }

    const activeRateLimit = userRateLimit || ipRateLimit;

    // 2. Fetch episode metadata and privileged episode_media via service role
    const episodeInfo = await getEpisodePlaybackInfo(episodeId);
    if (!episodeInfo) {
      const notFoundRes = apiError("NOT_FOUND", "Episode not found.", 404);
      applyRateLimitHeaders(notFoundRes, activeRateLimit);
      return notFoundRes;
    }

    // 3. Evaluate access entitlements (published status & future Phase 8 coin paywall)
    const access = await canAccessEpisode(currentUser, episodeInfo);
    if (!access.allowed) {
      if (access.reason === "UNPUBLISHED_TITLE") {
        // Return 404 for draft/archived titles to non-staff to avoid metadata leakage
        const unpubRes = apiError("NOT_FOUND", "Episode not found or unavailable.", 404);
        applyRateLimitHeaders(unpubRes, activeRateLimit);
        return unpubRes;
      }
      if (access.reason === "PAYMENT_REQUIRED") {
        const payRes = apiError(
          "PAYMENT_REQUIRED",
          access.message || "You must unlock this episode to watch.",
          403
        );
        applyRateLimitHeaders(payRes, activeRateLimit);
        return payRes;
      }
      const forbidRes = apiError(
        "FORBIDDEN",
        access.message || "You do not have access to play this episode.",
        403
      );
      applyRateLimitHeaders(forbidRes, activeRateLimit);
      return forbidRes;
    }

    // 4. Resolve stream URL and token expiration
    const session = resolvePlaybackSession(episodeInfo);
    if (!session.url) {
      const unavailRes = apiError(
        "STREAM_UNAVAILABLE",
        "No playable media stream found for this episode.",
        404
      );
      applyRateLimitHeaders(unavailRes, activeRateLimit);
      return unavailRes;
    }

    const successRes = apiSuccess(session, 200);
    applyRateLimitHeaders(successRes, activeRateLimit);
    return successRes;
  } catch (err: unknown) {
    console.error("[GET /api/playback/:episodeId] Unexpected error:", err);
    reportError(err, {
      route: `/api/playback/${episodeId}`,
      method: "GET",
      userId: currentUser?.id,
      requestId: _request.headers.get("x-request-id") || undefined,
    });
    return apiError("DATABASE_ERROR", "Failed to retrieve playback session.", 500);
  }
}
