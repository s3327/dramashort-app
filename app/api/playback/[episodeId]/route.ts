import { NextRequest } from "next/server";
import { createUserServerClient } from "@/lib/supabase/user-server";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { isUuid } from "@/lib/validation/drama";
import {
  getEpisodePlaybackInfo,
  canAccessEpisode,
  resolvePlaybackSession,
} from "@/lib/server/playback";

/**
 * GET /api/playback/[episodeId]
 * 
 * Secure server-gated playback endpoint (Task 10.6).
 * Verifies that the episode exists, parent title is Published (or caller is admin/editor),
 * determines access entitlement via canAccessEpisode(), and returns a signed streaming URL
 * with expiration metadata.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const { episodeId } = await params;

  if (!isUuid(episodeId)) {
    return apiError("INVALID_ID", "Episode ID must be a valid UUID.", 400);
  }

  try {
    // 1. Resolve current user session (optional; guests are supported for free episodes)
    let currentUser = null;
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

    // 2. Fetch episode metadata and privileged episode_media via service role
    const episodeInfo = await getEpisodePlaybackInfo(episodeId);
    if (!episodeInfo) {
      return apiError("NOT_FOUND", "Episode not found.", 404);
    }

    // 3. Evaluate access entitlements (published status & future Phase 8 coin paywall)
    const access = await canAccessEpisode(currentUser, episodeInfo);
    if (!access.allowed) {
      if (access.reason === "UNPUBLISHED_TITLE") {
        // Return 404 for draft/archived titles to non-staff to avoid metadata leakage
        return apiError("NOT_FOUND", "Episode not found or unavailable.", 404);
      }
      if (access.reason === "PAYMENT_REQUIRED") {
        return apiError(
          "PAYMENT_REQUIRED",
          access.message || "You must unlock this episode to watch.",
          403
        );
      }
      return apiError(
        "FORBIDDEN",
        access.message || "You do not have access to play this episode.",
        403
      );
    }

    // 4. Resolve stream URL and token expiration
    const session = resolvePlaybackSession(episodeInfo);
    if (!session.url) {
      return apiError(
        "STREAM_UNAVAILABLE",
        "No playable media stream found for this episode.",
        404
      );
    }

    return apiSuccess(session, 200);
  } catch (err: unknown) {
    console.error("[GET /api/playback/:episodeId] Unexpected error:", err);
    return apiError("DATABASE_ERROR", "Failed to retrieve playback session.", 500);
  }
}
